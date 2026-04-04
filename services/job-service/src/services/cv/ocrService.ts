import pdfParseModule, { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';
import type { OcrConfig } from '../../config/appConfig';
import logger from '../../utils/logger';
import type { Metadata } from 'pdfjs-dist/types/src/display/metadata.js';

const execFileAsync = promisify(execFile);

export interface OcrExtractionResult {
  text: string;
  source: 'text' | 'ocr';
  isScanned: boolean;
}

type PdfParseResult = {
  text?: string;
  numpages?: number;
  metadata?: Metadata | null;
  info?: Record<string, unknown> | null;
};

type PdfParseCtor =
  | (new (options?: Record<string, unknown>) => PDFParse)
  | undefined;

const PdfParseClass = (pdfParseModule as { PDFParse?: PdfParseCtor }).PDFParse;

export class OCRService {
  private readonly languages: string;

  constructor(private readonly config: OcrConfig) {
    this.languages =
      config.languages.length > 0 ? config.languages.join('+') : 'eng';
  }

  async extractText(pdfPath: string): Promise<OcrExtractionResult> {
    const pdfResult = await this.parsePdfText(pdfPath);
    const scanned = isLikelyScannedPdf(pdfResult);
    const trimmed = pdfResult.text?.trim() ?? '';

    if (!scanned && trimmed.length > 0) {
      return {
        text: trimmed,
        source: 'text',
        isScanned: false,
      };
    }

    const ocrText = await this.performOcr(pdfPath);
    return {
      text: ocrText,
      source: 'ocr',
      isScanned: true,
    };
  }

  private async parsePdfText(pdfPath: string): Promise<PdfParseResult> {
    if (!PdfParseClass) {
      throw new Error('PDFParse class not available in pdf-parse module');
    }
    const buffer = await fs.readFile(pdfPath);
    const parser = new PdfParseClass({
      data: buffer,
    } as any);
    const infoResult = await parser.getInfo();
    const textResult = await parser.getText();
    await parser.destroy().catch(() => undefined);
    return {
      text: textResult.text,
      numpages: textResult.total,
      metadata: infoResult.metadata ?? null,
      info: infoResult.info ?? null,
    };
  }

  private async performOcr(pdfPath: string): Promise<string> {
    const workingDir = path.join(tmpdir(), `cv-ocr-${randomUUID()}`);
    await fs.mkdir(workingDir, { recursive: true });
    const outputBase = path.join(workingDir, 'page');

    try {
      await execFileAsync('pdftoppm', [
        '-r',
        String(this.config.dpi),
        '-png',
        pdfPath,
        outputBase,
      ]);
    } catch (error: any) {
      await fs.rm(workingDir, { recursive: true, force: true });
      if (error?.code === 'ENOENT') {
        throw new Error(
          'pdftoppm binary not found. Install poppler-utils or update Dockerfile per TDD.',
        );
      }
      throw error;
    }

    try {
      const files = await fs.readdir(workingDir);
      const imageFiles = files
        .filter((file) => file.startsWith('page-') && file.endsWith('.png'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((file) => path.join(workingDir, file));

      if (imageFiles.length === 0) {
        throw new Error('Failed to render PDF pages for OCR');
      }

      const texts: string[] = [];
      for (const file of imageFiles) {
        const { data } = await Tesseract.recognize(file, this.languages);
        texts.push(data.text.trim());
      }

      const raw = texts.join('\n').trim();
      return normalizeOcrText(raw);
    } finally {
      await fs.rm(workingDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function isLikelyScannedPdf(result: PdfParseResult): boolean {
  const totalChars = (result.text ?? '').replace(/\s+/g, '').length;
  const pages = Math.max(result.numpages ?? 1, 1);
  const avgCharsPerPage = totalChars / pages;
  let hasCreator = false;
  if (result.metadata && typeof result.metadata.get === 'function') {
    const creator = result.metadata.get('Creator');
    const producer = result.metadata.get('Producer');
    hasCreator = Boolean(creator || producer);
  } else if (result.info) {
    hasCreator =
      typeof result.info.Creator === 'string' ||
      typeof result.info.Producer === 'string';
  }
  return totalChars < 200 || avgCharsPerPage < 50 || !hasCreator;
}

function normalizeOcrText(input: string): string {
  // Collapse sequences of single-letter tokens (e.g. "P H A N") into proper words.
  const collapsed = input.replace(/(?:\b\p{L}\b\s*){2,}/gu, (match) =>
    match.replace(/\s+/g, ''),
  );
  // Normalize excessive spaces but keep newlines.
  return collapsed
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}
