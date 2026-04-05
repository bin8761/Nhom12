// Shared CV-related TypeScript interfaces used across the CV pipeline
export interface ParsedEducationEntry {
  institution: string;
  degree?: string;
  graduationYear?: number;
}

export interface ParsedExperienceEntry {
  position?: string;
  company?: string;
  duration?: string;
  description?: string;
}

export interface ParsedFields {
  fullName?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  yearsExperience?: number;
  education?: ParsedEducationEntry[];
  experience?: ParsedExperienceEntry[];
  certificates?: string[];
  activities?: string[];
  summary?: string;
  objective?: string;
  rawText?: string;
  aiFeedback?: string;
  aiSummary?: string;
  [key: string]: unknown; // Index signature for parseJsonObject compatibility
}

export type CandidateCvStatusLiteral = 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED';
export type ApplicationStatusLiteral = 'SUBMITTED' | 'REVIEWED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
export type CvReviewStatusLiteral = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CandidateCvDTO {
  id: string;
  candidateId: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: CandidateCvStatusLiteral;
  parsedFields?: ParsedFields | null;
  errorMessage?: string | null;
  uploadedAt: Date;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationWithCvDTO {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatusLiteral;
  cvFileId?: string | null;
  cvSnapshot?: ParsedFields | null;
  cvStatus: CvReviewStatusLiteral;
  cvDecisionNote?: string | null;
  cvReviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
