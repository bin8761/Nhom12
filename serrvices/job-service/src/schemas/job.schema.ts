import { z } from 'zod';

export const jobTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'REMOTE']);
export const experienceLevelEnum = z.enum(['ENTRY', 'JUNIOR', 'MIDDLE', 'SENIOR', 'LEAD']);

const trimString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseSkills = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  return [];
};

const jobCreateBaseSchema = z.object({
  title: z
    .string({ required_error: 'Tiêu đề là bắt buộc' })
    .min(10, 'Tiêu đề phải có ít nhất 10 ký tự')
    .max(160, 'Tiêu đề không được vượt quá 160 ký tự'),
  description: z
    .string({ required_error: 'Mô tả là bắt buộc' })
    .min(50, 'Mô tả phải có ít nhất 50 ký tự')
    .max(10_000, 'Mô tả không được vượt quá 10,000 ký tự'),
  skills: z
    .array(
      z
        .string()
        .min(1, 'Kỹ năng không được để trống')
        .max(60, 'Kỹ năng không được vượt quá 60 ký tự'),
    )
    .max(20, 'Tối đa 20 kỹ năng')
    .default([]),
  salary: z
    .number({ required_error: 'Mức lương là bắt buộc' })
    .nonnegative('Mức lương phải bằng hoặc lớn hơn 0'),
  currency: z
    .string()
    .length(3, 'Đơn vị tiền tệ phải là mã ISO 3 ký tự')
    .transform((val) => val.toUpperCase()),
  location: z
    .string({ required_error: 'Địa điểm là bắt buộc' })
    .min(2, 'Địa điểm phải có ít nhất 2 ký tự')
    .max(160, 'Địa điểm không được vượt quá 160 ký tự'),
  jobType: jobTypeEnum,
  experienceLevel: experienceLevelEnum.optional(),
  provinceCode: z
    .string({ required_error: 'Tỉnh/Thành phố là bắt buộc' })
    .trim()
    .min(2, 'Mã tỉnh phải có ít nhất 2 ký tự')
    .max(64, 'Mã tỉnh không được vượt quá 64 ký tự'),
  addressLine: z
    .string({ required_error: 'Địa chỉ cụ thể là bắt buộc' })
    .min(5, 'Địa chỉ cụ thể phải có ít nhất 5 ký tự')
    .max(255, 'Địa chỉ không được vượt quá 255 ký tự'),
});

export const jobCreateSchema = jobCreateBaseSchema.transform((data) => ({
  ...data,
  currency: data.currency.toUpperCase(),
}));

export type JobCreateRequestInput = z.infer<typeof jobCreateSchema>;

export function normalizeJobCreatePayload(body: Record<string, unknown>): Record<string, unknown> {
  const salaryValue = typeof body.salary === 'string' ? Number(body.salary) : Number(body.salary ?? NaN);

  return {
    title: trimString(body.title),
    description: trimString(body.description),
    skills: parseSkills(body.skills),
    salary: Number.isFinite(salaryValue) ? salaryValue : undefined,
    currency: trimString(body.currency) ?? 'VND',
    location: trimString(body.location),
    jobType: typeof body.jobType === 'string' ? body.jobType.trim().toUpperCase() : body.jobType,
    experienceLevel: typeof body.experienceLevel === 'string' ? body.experienceLevel.trim().toUpperCase() : body.experienceLevel,
    provinceCode: trimString(body.provinceCode),
    addressLine: trimString(body.addressLine),
  };
}

export const jobUpdateSchema = jobCreateBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Phải cung cấp ít nhất một trường' });

export type JobUpdateRequestInput = z.infer<typeof jobUpdateSchema>;

export function normalizeJobUpdatePayload(body: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  if (body.title !== undefined) {
    normalized.title = trimString(body.title);
  }
  if (body.description !== undefined) {
    normalized.description = trimString(body.description);
  }
  if (body.skills !== undefined) {
    normalized.skills = parseSkills(body.skills);
  }
  if (body.salary !== undefined) {
    const salaryValue = typeof body.salary === 'string' ? Number(body.salary) : Number(body.salary ?? NaN);
    normalized.salary = Number.isFinite(salaryValue) ? salaryValue : Number.NaN;
  }
  if (body.currency !== undefined) {
    normalized.currency = trimString(body.currency)?.toUpperCase();
  }
  if (body.location !== undefined) {
    normalized.location = trimString(body.location);
  }
  if (body.jobType !== undefined) {
    normalized.jobType = typeof body.jobType === 'string' ? body.jobType.trim().toUpperCase() : body.jobType;
  }
  if (body.experienceLevel !== undefined) {
    normalized.experienceLevel = typeof body.experienceLevel === 'string' ? body.experienceLevel.trim().toUpperCase() : body.experienceLevel;
  }
  if (body.provinceCode !== undefined) {
    normalized.provinceCode = trimString(body.provinceCode);
  }
  if (body.addressLine !== undefined) {
    normalized.addressLine = trimString(body.addressLine);
  }

  return normalized;
}

export function parseRemoveImageIds(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  return [];
}

export const adminApproveSchema = z.object({
  note: z.string().optional(),
});

export type AdminApproveInput = z.infer<typeof adminApproveSchema>;

export const adminRejectSchema = z.object({
  note: z
    .string({ required_error: 'Lý do từ chối là bắt buộc' })
    .trim()
    .min(5, 'Lý do từ chối phải có ít nhất 5 ký tự'),
});

export type AdminRejectInput = z.infer<typeof adminRejectSchema>;


