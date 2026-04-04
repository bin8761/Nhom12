import { ParsedExperienceEntry, ParsedFields } from '../../contracts/cv.types';

const DEFAULT_SKILLS = [
  'javascript',
  'typescript',
  'node.js',
  'nodejs',
  'react',
  'angular',
  'vue',
  'java',
  'python',
  'c#',
  'php',
  'golang',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
  'sql',
  'mongodb',
  'mysql',
  'postgresql',
  'redis',
  'rabbitmq',
  'graphql',
  'rest api',
];

const EDUCATION_KEYWORDS = [
  'đại học',
  'cử nhân',
  'thạc sĩ',
  'kỹ sư',
  'bachelor',
  'master',
  'phd',
  'university',
  'college',
  'institute',
];

const SECTION_KEYWORDS = {
  experience: [
    'kinh nghiệm',
    'experience',
    'work history',
    'employment',
    'professional experience',
  ],
  certificates: ['chứng chỉ', 'certificate', 'certification'],
  activities: ['hoạt động', 'activities', 'community', 'volunteer'],
  objective: ['mục tiêu', 'objective', 'career goal', 'career objective'],
  education: ['học vấn', 'education', 'academic', 'studies'],
} as const;

type SectionKey = keyof typeof SECTION_KEYWORDS;

const DURATION_REGEX =
  /(\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|đến|to|tới|until|–)\s*(nay|present|\d{1,2}\/\d{4}|\d{4})/i;

export class CVParserService {
  constructor(private readonly skillDictionary: string[] = DEFAULT_SKILLS) {}

  parse(rawText: string): ParsedFields {
    const normalized = this.normalizeWhitespace(rawText || '');
    const email = this.extractEmail(normalized);
    const phone = this.extractPhone(normalized);
    const skills = this.extractSkills(normalized);
    const yearsExperience = this.extractYearsOfExperience(normalized);
    const educationLines = this.extractEducation(normalized);
    const summary = this.extractSummary(normalized);
    const sections = this.detectSections(normalized);
    const experience = this.extractExperienceEntries(sections.experience);
    const certificates = this.extractListSection(sections.certificates);
    const activities = this.extractListSection(sections.activities);
    const objective = this.extractObjective(sections.objective);

    return {
      email: email ?? undefined,
      phone: phone ?? undefined,
      skills: skills.length > 0 ? skills : undefined,
      yearsExperience: yearsExperience ?? undefined,
      education:
        educationLines.length > 0
          ? educationLines.map((line) => ({ institution: line }))
          : undefined,
      summary: summary ?? undefined,
      experience: experience.length > 0 ? experience : undefined,
      certificates: certificates.length > 0 ? certificates : undefined,
      activities: activities.length > 0 ? activities : undefined,
      objective: objective ?? undefined,
    };
  }

  private extractEmail(text: string): string | null {
    const match =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null;
    return match;
  }

  private extractPhone(text: string): string | null {
    const phoneRegex = /(\+?84|0)(\s|\.)?(\d[\s.\-]?){8,10}/g;
    const matches = text.match(phoneRegex);
    if (!matches?.length) {
      return null;
    }

    const sanitized = matches[0]
      .replace(/[\s.\-]/g, '')
      .replace(/^0/, '+84');
    return sanitized.length >= 11 ? sanitized : null;
  }

  private extractSkills(text: string): string[] {
    const lower = text.toLowerCase();
    const unique = new Set<string>();
    for (const skill of this.skillDictionary) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase();
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(lower)) {
        unique.add(this.normalizeSkillDisplay(skill));
      }
    }
    return Array.from(unique);
  }

  private extractYearsOfExperience(text: string): number | null {
    const regex = /(\d+(?:[.,]\d+)?)\s*\+?\s*(years?|yrs?|năm)/i;
    const match = text.match(regex);
    if (!match) {
      return null;
    }
    const value = parseFloat(match[1].replace(',', '.'));
    if (Number.isNaN(value)) {
      return null;
    }
    return Math.round(value * 10) / 10;
  }

  private extractEducation(text: string): string[] {
    const lines = text.split(/\n+/);
    const results: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (EDUCATION_KEYWORDS.some((keyword) => lower.includes(keyword))) {
        results.push(trimmed);
      }
    }
    return results;
  }

  private extractSummary(text: string): string | null {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) {
      return null;
    }
    const summary = paragraphs[0];
    return summary.length > 600 ? `${summary.slice(0, 597)}...` : summary;
  }

  private normalizeWhitespace(input: string): string {
    const cleaned = input
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/\s{2,}/g, ' ').trim())
      .join('\n');

    const withDateBreaks = cleaned.replace(
      /((?:0[1-9]|1[0-2])\/\d{4}\s*[-–—]\s*(?:Nay|Hiện tại|Present|\d{4}|0[1-9]\/\d{4}))/gi,
      '\n$1\n',
    );

    const noWatermark = withDateBreaks
      .replace(/©\s*topcv\.vn/gi, '')
      .replace(/\b\d+\s+of\s+\d+\s*--?/gi, '');

    return noWatermark.trim();
  }

  private normalizeSkillDisplay(skill: string): string {
    if (skill.toLowerCase() === 'nodejs') {
      return 'Node.js';
    }
    if (skill.toLowerCase() === 'c#') {
      return 'C#';
    }
    if (skill.toLowerCase() === 'sql') {
      return 'SQL';
    }
    return skill.replace(/^\w/, (c) => c.toUpperCase());
  }

  private detectSections(text: string): Partial<Record<SectionKey, string[]>> {
    const lines = text.split('\n');
    const sections: Partial<Record<SectionKey, string[]>> = {};
    let currentSection: SectionKey | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const matchedSection = this.matchSectionHeading(line);
      if (matchedSection) {
        currentSection = matchedSection;
        if (!sections[currentSection]) {
          sections[currentSection] = [];
        }
        const inlineContent = this.extractInlineContent(line, matchedSection);
        if (inlineContent) {
          sections[currentSection]?.push(inlineContent);
        }
        continue;
      }

      if (currentSection) {
        if (!this.isNoiseLine(line)) {
          sections[currentSection]?.push(line);
        }
      }
    }

    return sections;
  }

  private matchSectionHeading(line: string): SectionKey | null {
    if (/^[-*•·]/.test(line)) {
      return null;
    }

    const normalizedLine = this.stripDiacritics(line)
      .toLowerCase()
      .replace(/[:\-–—]+$/, '')
      .trim();

    for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
      if (
        keywords.some((keyword) =>
          normalizedLine.includes(this.stripDiacritics(keyword).toLowerCase()),
        )
      ) {
        const keyword = keywords.find((kw) =>
          normalizedLine.includes(this.stripDiacritics(kw).toLowerCase()),
        );
        if (!keyword) {
          continue;
        }
        const idx = normalizedLine.indexOf(this.stripDiacritics(keyword).toLowerCase());
        if (idx > 6) {
          continue;
        }
        return section as SectionKey;
      }
    }
    return null;
  }

  private extractExperienceEntries(lines?: string[]): ParsedFields['experience'] {
    if (!lines?.length) {
      return [];
    }

    const entries: NonNullable<ParsedFields['experience']> = [];
    let current: ParsedExperienceEntry | null = null;

    const pushCurrent = () => {
      if (
        current &&
        (current.position || current.company || current.duration || current.description)
      ) {
        entries.push(current);
      }
      current = null;
    };

    const queue = [...lines];

    while (queue.length > 0) {
      const rawLine = queue.shift() ?? '';
      const line = rawLine.trim();
      if (!line || this.isNoiseLine(line)) {
        continue;
      }

      if (this.isDescriptionLine(line)) {
        const desc = line.replace(/^[-*•·]+\s*/, '').trim();
        if (!desc) continue;
        const target =
          current ??
          (entries.length > 0 ? entries[entries.length - 1] : undefined);
        if (!target) continue;
        target.description = target.description
          ? `${target.description} ${desc}`
          : desc;
        continue;
      }

      if (line.includes('|')) {
        const [left, right] = line.split('|');
        const leftPart = left?.trim();
        const rightPart = right?.trim();
        current = current ?? {};

        if (leftPart) {
          if (!current.company && current.position) {
            current.company = leftPart;
          } else if (!current.position) {
            current.position = leftPart;
          } else if (!current.company) {
            current.company = leftPart;
          } else {
            pushCurrent();
            current = { position: leftPart };
          }
        }

        if (rightPart) {
          if (this.isLikelyDuration(rightPart)) {
            current.duration = rightPart;
          } else if (!current.company) {
            current.company = rightPart;
          } else {
            current.description = current.description
              ? `${current.description} ${rightPart}`
              : rightPart;
          }
        }
        continue;
      }

      const durationMatch = line.match(DURATION_REGEX);
      if (durationMatch) {
        const durationValue = durationMatch[0].trim();
        const matchIndex = durationMatch.index ?? 0;
        const prefix = line.slice(0, matchIndex).trim();
        const suffix = line.slice(matchIndex + durationValue.length).trim();

        if (prefix) {
          const recombined = [durationValue, suffix].filter(Boolean).join(' ');
          queue.unshift(recombined);
          queue.unshift(prefix);
          continue;
        }

        if (
          current &&
          this.entryHasContent(current) &&
          current.duration &&
          current.duration !== durationValue
        ) {
          pushCurrent();
        }

        current = current ?? {};
        current.duration = durationValue;

        if (suffix) {
          queue.unshift(suffix);
        }
        continue;
      }

      if (current && !current.position) {
        current.position = line;
        continue;
      }

      if (current && !current.company && current.position) {
        current.company = line;
        continue;
      }

      pushCurrent();
      current = { position: line };
    }

    pushCurrent();

    return this.mergeFragmentedExperience(entries);
  }

  private extractListSection(lines?: string[]): string[] {
    if (!lines?.length) {
      return [];
    }
    return lines
      .map((line) => line.replace(/^[-*•·]+\s*/, '').trim())
      .filter((line) => line.length > 0 && !this.isNoiseLine(line));
  }

  private extractObjective(lines?: string[]): string | null {
    if (!lines?.length) {
      return null;
    }
    const text = lines
      .map((line) => line.replace(/^[-*•·]+\s*/, '').trim())
      .filter((line) => line.length > 0)
      .join(' ');
    return text.length > 0 ? text : null;
  }

  private stripDiacritics(input: string): string {
    return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private extractInlineContent(line: string, section: SectionKey): string | null {
    const normalizedLine = this.stripDiacritics(line).toLowerCase();
    for (const keyword of SECTION_KEYWORDS[section]) {
      const normalizedKeyword = this.stripDiacritics(keyword).toLowerCase();
      const idx = normalizedLine.indexOf(normalizedKeyword);
      if (idx === -1) {
        continue;
      }
      const tailStart = idx + normalizedKeyword.length;
      const rawTail = line.slice(tailStart);
      const separatorMatch = rawTail.match(/^[:\-–—\s]+/);
      const hasExplicitSeparator = Boolean(separatorMatch && /[:\-–—]/.test(separatorMatch[0]));
      const tail = rawTail.replace(/^[:\-–—\s]+/, '').trim();
      if (
        tail.length > 0 &&
        !this.isNoiseLine(tail) &&
        this.shouldAttachInlineContent(tail, hasExplicitSeparator)
      ) {
        return tail;
      }
    }
    return null;
  }

  private isNoiseLine(line: string): boolean {
    const normalized = this.stripDiacritics(line).toLowerCase().trim();
    return (
      normalized.startsWith('©') ||
      normalized.includes('topcv.vn') ||
      normalized === 'topcv' ||
      normalized.startsWith('page ') ||
      /^\d+\s+of\s+\d+/.test(normalized) ||
      normalized === '--' ||
      normalized === '-' ||
      normalized === '—'
    );
  }

  private shouldAttachInlineContent(content: string, hasExplicitSeparator: boolean): boolean {
    if (!content) {
      return false;
    }
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (hasExplicitSeparator && wordCount >= 1) {
      return true;
    }
    if (wordCount >= 4) {
      return true;
    }
    if (content.length >= 20) {
      return true;
    }
    if (/[.,!?]/.test(content)) {
      return true;
    }
    return false;
  }

  private isDescriptionLine(line: string): boolean {
    if (/^[-*•·]/.test(line)) {
      return true;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }
    const stripped = this.stripDiacritics(trimmed);
    const firstAlphaMatch = stripped.match(/[A-Za-z]/);
    const startsLower =
      firstAlphaMatch !== null &&
      firstAlphaMatch[0] === firstAlphaMatch[0].toLowerCase();
    if (/^[()]/.test(trimmed)) {
      return true;
    }
    if (startsLower && trimmed.length >= 30) {
      return true;
    }
    if (trimmed.length >= 90 && /[,.;]/.test(trimmed)) {
      return true;
    }
    return false;
  }

  private isLikelyDuration(line: string): boolean {
    return DURATION_REGEX.test(line);
  }

  private entryHasContent(entry: ParsedExperienceEntry | null): boolean {
    if (!entry) {
      return false;
    }
    return Boolean(entry.position || entry.company || entry.description);
  }

  private mergeFragmentedExperience(
    entries: NonNullable<ParsedFields['experience']>,
  ): NonNullable<ParsedFields['experience']> {
    if (entries.length === 0) {
      return entries;
    }

    const merged: NonNullable<ParsedFields['experience']> = [];

    for (const entry of entries) {
      const last = merged[merged.length - 1];
      const looksLikeFragment =
        !entry.duration &&
        (!entry.company || entry.company.length <= 10) &&
        (!entry.position || entry.position.length <= 10);

      if (last && looksLikeFragment) {
        const fragmentText = [entry.position, entry.company, entry.description]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (fragmentText.length > 0) {
          last.description = last.description
            ? `${last.description} ${fragmentText}`
            : fragmentText;
        }
        continue;
      }

      merged.push(entry);
    }

    return merged;
  }
}
