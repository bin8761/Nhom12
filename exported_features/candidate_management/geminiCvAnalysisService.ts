import { promises as fs } from 'fs';
import https from 'https';
import { randomUUID } from 'crypto';
import logger from '../../utils/logger';
import type { ParsedEducationEntry, ParsedExperienceEntry, ParsedFields } from '../../contracts/cv.types';
import type { GeminiConfig } from '../../config/appConfig';

export interface CvAnalysisInput {
  candidateId: string;
  filePath: string;
  fileName: string;
  requestId?: string;
}

export interface CvAnalysisResult {
  parsedFields: ParsedFields;
}

interface GeminiUploadApiResponse {
  file?: {
    name?: string;
    uri?: string;
  };
}

interface GeminiUploadResult {
  name: string;
  uri: string;
}

interface GeminiCandidateContent {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiGenerateContentResponse {
  candidates?: Array<GeminiCandidateContent>;
}

export class GeminiCvAnalysisService {
  constructor(private readonly config: GeminiConfig) {
    if (!config.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }

  async analyzeCv(input: CvAnalysisInput): Promise<CvAnalysisResult> {
    logger.info({
      event: 'gemini_cv_analysis_started',
      candidateId: input.candidateId,
      fileName: input.fileName,
      requestId: input.requestId,
    });

    const fileBuffer = await fs.readFile(input.filePath);
    
    logger.info({
      event: 'gemini_cv_upload_started',
      candidateId: input.candidateId,
      fileSize: fileBuffer.length,
    });

    const upload = await this.uploadFile(fileBuffer, input.fileName);
    
    logger.info({
      event: 'gemini_cv_upload_completed',
      candidateId: input.candidateId,
      fileId: upload.name,
    });

    try {
      logger.info({
        event: 'gemini_cv_content_generation_started',
        candidateId: input.candidateId,
      });

      const response = await this.generateContent(upload, input);
      const jsonPayload = this.extractPayload(response);
      const parsedFields = this.mapToParsedFields(jsonPayload);

      logger.info({
        event: 'gemini_cv_analysis_completed',
        candidateId: input.candidateId,
        requestId: input.requestId,
        hasAiFeedback: !!parsedFields.aiFeedback,
        skillsCount: parsedFields.skills?.length || 0,
        educationCount: parsedFields.education?.length || 0,
        experienceCount: parsedFields.experience?.length || 0,
      });

      return { parsedFields };
    } finally {
      logger.info({
        event: 'gemini_cv_cleanup_started',
        candidateId: input.candidateId,
      });
      await this.deleteFile(upload.name).catch(() => undefined);
    }
  }

  private async uploadFile(buffer: Buffer, fileName: string): Promise<GeminiUploadResult> {
    const boundary = `----GeminiCvBoundary${randomUUID()}`;
    const metadataPart = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
        file: { displayName: fileName },
      })}\r\n`,
      'utf-8',
    );
    const filePartHeader = Buffer.from(
      `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      'utf-8',
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const payload = Buffer.concat([metadataPart, filePartHeader, buffer, footer]);

    const raw = await this.performHttpRequest(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/upload/v1beta/files?uploadType=multipart&key=${this.config.apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      payload,
    );

    const rawText = raw.toString('utf-8');
    let parsed: GeminiUploadApiResponse | null = null;
    try {
      parsed = JSON.parse(rawText) as GeminiUploadApiResponse;
    } catch (error) {
      logger.error(
        {
          event: 'gemini_upload_parse_failed',
          fileName,
          responseSnippet: rawText.slice(0, 500),
        },
        'Failed to parse Gemini upload response',
      );
      throw new Error('Gemini upload response invalid JSON');
    }

    const fileNameResponse = parsed?.file?.name;
    const fileUriResponse = parsed?.file?.uri;
    if (!fileNameResponse || !fileUriResponse) {
      logger.error({
        event: 'gemini_upload_missing_file_id',
        fileName,
        responseSnippet: rawText.slice(0, 500),
      });
      throw new Error('Gemini upload response missing file id');
    }
    return { name: fileNameResponse, uri: fileUriResponse };
  }

  private async generateContent(upload: GeminiUploadResult, input: CvAnalysisInput): Promise<GeminiGenerateContentResponse> {
    const promptInstructions = [
      'Bạn là trợ lý AI đọc CV tiếng Việt cho hệ thống tuyển dụng.',
      'Hãy đọc nội dung CV trong file PDF đính kèm và trả về JSON với cấu trúc sau:',
      JSON.stringify(
        {
          fullName: 'string | null',
          email: 'string | null',
          phone: 'string | null',
          skills: 'string[] | null',
          yearsExperience: 'number | null',
          education: [
            {
              institution: 'string | null',
              degree: 'string | null',
              graduationYear: 'number | null',
            },
          ],
          experience: [
            {
              position: 'string | null',
              company: 'string | null',
              duration: 'string | null',
              description: 'string | null',
            },
          ],
          certificates: 'string[] | null',
          activities: 'string[] | null',
          summary: 'string | null',
          objective: 'string | null',
          rawText: 'string - toàn bộ nội dung CV, tối đa 4000 ký tự',
          aiFeedback: 'string - nhận xét chi tiết của AI về CV (tiếng Việt)',
          aiSummary: 'string - 1 câu tóm tắt ngắn gọn về CV này (tối đa 150 ký tự)',
        },
        null,
        2,
      ),
      'Nếu thiếu thông tin, hãy trả về null cho trường tương ứng.',
      '',
      '📋 YÊU CẦU CHO aiFeedback (chi tiết):',
      '1. Phân tích điểm mạnh của CV (2-3 điểm)',
      '2. Phân tích điểm yếu hoặc cần cải thiện (2-3 điểm)',
      '3. Đánh giá tổng quan về kinh nghiệm và kỹ năng',
      '',
      '🎯 YÊU CẦU CHO aiSummary (TÓM TẮT NGẮN GỌN):',
      '- Chỉ 1 câu duy nhất, tối đa 150 ký tự',
      '- Đánh giá tổng thể về ứng viên và vị trí phù hợp',
      '- Giúp nhà tuyển dụng nhanh chóng đánh giá ứng viên',
      '- VD: "CV mạnh cho vị trí Nhân viên Kinh doanh, 3 năm kinh nghiệm, kỹ năng giao tiếp tốt"',
      '- VD: "Phù hợp vị trí Developer Junior, có nền tảng lập trình vững, thiếu kinh nghiệm thực tế"',
      '- VD: "Ứng viên Senior Marketing, 5 năm kinh nghiệm, chuyên về Digital Marketing"',
      '',
      'Bắt buộc rawText <= 4000 ký tự.',
      'aiSummary phải ngắn gọn, súc tích, dễ hiểu.',
      `Candidate ID: ${input.candidateId}`,
      `Tên file: ${input.fileName}`,
    ].join('\n');

    const payload = Buffer.from(
      JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptInstructions },
              {
                fileData: {
                  fileUri: upload.uri,
                  mimeType: 'application/pdf',
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
      'utf-8',
    );

    const raw = await this.performHttpRequest(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${this.resolveModelId()}:generateContent?key=${this.config.apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      payload,
    );

    return JSON.parse(raw.toString('utf-8')) as GeminiGenerateContentResponse;
  }

  private async deleteFile(fileId: string): Promise<void> {
    await this.performHttpRequest(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/${encodeURIComponent(fileId)}?key=${this.config.apiKey}`,
        method: 'DELETE',
      },
      null,
    );
  }

  private performHttpRequest(options: https.RequestOptions, body: Buffer | null): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const request = https.request(
        { ...options, timeout: this.config.requestTimeoutMs },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const raw = Buffer.concat(chunks);
            if (response.statusCode && response.statusCode >= 400) {
              const message = raw.length ? raw.toString('utf-8') : response.statusMessage ?? '';
              reject(new Error(`Gemini API error (${response.statusCode}): ${message}`));
              return;
            }
            resolve(raw);
          });
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error('Gemini API request timed out'));
      });
      request.on('error', (error) => reject(error));

      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  private extractPayload(response: GeminiGenerateContentResponse): any {
    const textPart =
      response.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text ?? '';
    const cleaned = textPart.trim();
    if (!cleaned) {
      throw new Error('Gemini response was empty');
    }

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      logger.error(
        {
          event: 'gemini_cv_analysis_parse_failed',
          rawText: cleaned.slice(0, 200),
        },
        'Failed to parse Gemini JSON payload',
      );
      throw new Error('Gemini response format invalid');
    }
  }

  private mapToParsedFields(payload: any): ParsedFields {
    const normalizeStrings = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) {
        return undefined;
      }
      const result = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0);
      return result.length ? result : undefined;
    };

    const normalizeEducation = (value: unknown): ParsedEducationEntry[] | undefined => {
      if (!Array.isArray(value)) {
        return undefined;
      }
      const entries: ParsedEducationEntry[] = [];
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const institution = typeof entry.institution === 'string' ? entry.institution.trim() : '';
        const degree =
          typeof entry.degree === 'string' && entry.degree.trim().length > 0
            ? entry.degree.trim()
            : undefined;
        const graduationYear =
          typeof entry.graduationYear === 'number' ? entry.graduationYear : undefined;
        if (!institution && !degree && !graduationYear) {
          return;
        }
        entries.push({ institution, degree, graduationYear });
      });
      return entries.length ? entries : undefined;
    };

    const normalizeExperience = (value: unknown): ParsedExperienceEntry[] | undefined => {
      if (!Array.isArray(value)) {
        return undefined;
      }
      const entries: ParsedExperienceEntry[] = [];
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const normalized: ParsedExperienceEntry = {};
        if (typeof entry.position === 'string' && entry.position.trim()) {
          normalized.position = entry.position.trim();
        }
        if (typeof entry.company === 'string' && entry.company.trim()) {
          normalized.company = entry.company.trim();
        }
        if (typeof entry.duration === 'string' && entry.duration.trim()) {
          normalized.duration = entry.duration.trim();
        }
        if (typeof entry.description === 'string' && entry.description.trim()) {
          normalized.description = entry.description.trim();
        }
        if (Object.keys(normalized).length > 0) {
          entries.push(normalized);
        }
      });
      return entries.length ? entries : undefined;
    };

    return {
      fullName: typeof payload.fullName === 'string' ? payload.fullName.trim() : undefined,
      email: typeof payload.email === 'string' ? payload.email.trim() : undefined,
      phone: typeof payload.phone === 'string' ? payload.phone.trim() : undefined,
      skills: normalizeStrings(payload.skills),
      yearsExperience:
        typeof payload.yearsExperience === 'number' ? payload.yearsExperience : undefined,
      education: normalizeEducation(payload.education),
      experience: normalizeExperience(payload.experience),
      certificates: normalizeStrings(payload.certificates),
      activities: normalizeStrings(payload.activities),
      summary: typeof payload.summary === 'string' ? payload.summary.trim() : undefined,
      objective: typeof payload.objective === 'string' ? payload.objective.trim() : undefined,
      rawText: typeof payload.rawText === 'string' ? payload.rawText.trim() : undefined,
      aiFeedback:
        typeof payload.aiFeedback === 'string' ? payload.aiFeedback.trim() : undefined,
      aiSummary:
        typeof payload.aiSummary === 'string' ? payload.aiSummary.trim() : undefined,
    };
  }

  private resolveModelId(): string {
    const trimmed = this.config.model.trim();
    if (!trimmed) {
      throw new Error('Gemini model configuration is empty');
    }
    if (trimmed.startsWith('models/')) {
      return trimmed.slice('models/'.length);
    }
    return trimmed;
  }
}
