import { z } from 'zod';
import { jobTypeEnum } from '../schemas/job.schema';

const jobStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DELETED']);

export const jobImageSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  slot: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const jobApprovalLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  performedBy: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const jobSummarySchema = z.object({
  id: z.string(),
  employerId: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  salary: z.number(),
  currency: z.string(),
  location: z.string(),
  addressLine: z.string().nullable(),
  provinceCode: z.string(),
  provinceName: z.string(),
  jobType: jobTypeEnum,
  status: jobStatusEnum,
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  images: z.array(jobImageSchema),
});

export const jobDetailSchema = jobSummarySchema.extend({
  approvalLogs: z.array(jobApprovalLogSchema),
});

const paginationSchema = z.object({
  page: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const jobListingResponseSchema = z.object({
  data: z.array(jobSummarySchema),
  pagination: paginationSchema,
});

export const jobDetailResponseSchema = z.object({
  data: jobDetailSchema,
});

export const candidateRecommendationMetaSchema = z.object({
  limit: z.number().int().positive(),
  sort: z.enum(['publishedAt_desc', 'salary_desc', 'salary_asc']),
  filters: z.object({
    provinceCode: z.string().nullable(),

  }),
  reason: z.enum(['missing_location', 'province', 'global']),
});

export const candidateRecommendationsResponseSchema = z.object({
  data: z.array(jobSummarySchema),
  meta: candidateRecommendationMetaSchema,
});
