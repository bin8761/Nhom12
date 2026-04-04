import { z } from 'zod';

export const parsedEducationEntrySchema = z
  .object({
    institution: z.string().min(1),
    degree: z.string().min(1).optional(),
    graduationYear: z.number().int().min(1900).max(2100).optional(),
  })
  .strict();

export const parsedFieldsSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).optional(),
    skills: z.array(z.string().min(1)).optional(),
    yearsExperience: z.number().min(0).optional(),
    education: z.array(parsedEducationEntrySchema).optional(),
    summary: z.string().min(1).optional(),
    rawText: z.string().min(1).optional(),
    aiFeedback: z.string().min(1).optional(),
  })
  .strict();

export const candidateCvStatusEnum = z.enum(['PENDING', 'PARSING', 'PARSED', 'FAILED']);

export const cvReviewStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const applicationStatusEnum = z.enum([
  'SUBMITTED',
  'REVIEWED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
]);

export const cvUploadResponseSchema = z.object({
  data: z.object({
    cvId: z.string().min(1),
    status: candidateCvStatusEnum,
    uploadedAt: z.string().datetime(),
  }),
});

export const applicationListItemSchema = z.object({
  id: z.string().min(1),
  candidateId: z.string().min(1),
  status: applicationStatusEnum,
  cvStatus: cvReviewStatusEnum.nullable(),
  cvDecisionNote: z.string().nullable(),
  cvReviewedAt: z.string().datetime().nullable(),
  cvSnapshot: parsedFieldsSchema.nullable(),
  createdAt: z.string().datetime(),
  cvDownloadUrl: z.string().min(1).nullable(),
  cvDownloadUrlExpiresAt: z.string().datetime().nullable(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const applicationListResponseSchema = z.object({
  data: z.array(applicationListItemSchema),
  meta: paginationSchema,
});

export type CvUploadResponse = z.infer<typeof cvUploadResponseSchema>;
export type ApplicationListResponse = z.infer<typeof applicationListResponseSchema>;
