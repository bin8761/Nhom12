import { z } from 'zod';
import {
  PROFILE_TAG_MAX_ITEMS,
  PROFILE_TAG_MAX_LENGTH,
  sanitizeTagList,
  sanitizeText,
  isTagListTooLong,
  isValidRelativePdfPath,
  isValidVietnamPhoneNumber,
} from '../utils/profileValidation';

const stringTagSchema = z
  .string()
  .transform((value) => sanitizeText(value))
  .refine((value) => value.length > 0, 'Giá trị không được để trống')
  .refine((value) => value.length <= PROFILE_TAG_MAX_LENGTH, {
    message: `Giá trị không được vượt quá ${PROFILE_TAG_MAX_LENGTH} ký tự`,
  });

const stringTagListSchema = z
  .array(stringTagSchema)
  .transform((items) => sanitizeTagList(items))
  .refine((items) => !isTagListTooLong(items), {
    message: `Danh sách không được vượt quá ${PROFILE_TAG_MAX_ITEMS} mục`,
  });

const phoneNumberSchema = z
  .string()
  .transform((value) => sanitizeText(value))
  .refine((value) => isValidVietnamPhoneNumber(value), {
    message: 'Số điện thoại phải là số điện thoại Việt Nam hợp lệ',
  });

const urlSchema = z
  .string()
  .transform((value) => sanitizeText(value))
  .pipe(z.string().url('Giá trị phải là URL hợp lệ'));

const relativePdfPathSchema = z
  .string()
  .transform((value) => sanitizeText(value))
  .refine((value) => isValidRelativePdfPath(value), {
    message: 'Đường dẫn CV phải là file PDF hợp lệ',
  });

const candidateProfileCoreSchema = z.object({
  fullName: z
    .string()
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length > 0, 'Họ và tên không được để trống')
    .refine((value) => value.length <= 120, 'Họ và tên quá dài')
    .optional(),
  phoneNumber: phoneNumberSchema.optional(),
  dateOfBirth: z
    .string()
    .transform((val) => {
      // Accept both yyyy-MM-dd and ISO datetime formats
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return val;
      }
      // If ISO format, extract date part
      if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
        return val.split('T')[0];
      }
      return val;
    })
    .refine((val) => /^\d{4}-\d{2}-\d{2}$/.test(val), 'Ngày sinh phải có định dạng yyyy-MM-dd')
    .optional(),
  location: z
    .string()
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length > 0, 'Địa chỉ không được để trống')
    .refine((value) => value.length <= 120, 'Địa chỉ quá dài')
    .optional(),
});

const companySizeSchema = z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);

const employerProfileCoreSchema = z.object({
  companyName: z
    .string({ required_error: 'Tên công ty là bắt buộc' })
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length > 0, 'Tên công ty là bắt buộc')
    .refine((value) => value.length <= 160, 'Tên công ty quá dài'),
  companyWebsite: urlSchema.nullish(),
  headquartersLocation: z
    .string()
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length > 0, 'Địa chỉ trụ sở không được để trống')
    .refine((value) => value.length <= 160, 'Địa chỉ trụ sở quá dài')
    .optional(),
  contactEmail: z
    .string()
    .transform((value) => sanitizeText(value))
    .pipe(z.string().email('Email liên hệ phải hợp lệ'))
    .optional(),
  contactPhone: phoneNumberSchema.optional(),
});

export const candidateProfileRequestSchema = candidateProfileCoreSchema;

export const employerProfileRequestSchema = employerProfileCoreSchema;

export const candidateProfileResponseSchema = z.object({
  fullName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  location: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const employerProfileResponseSchema = z.object({
  companyName: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  headquartersLocation: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const profileResponseSchema = z.object({
  role: z.enum(['CANDIDATE', 'EMPLOYER']),
  profile: z.union([candidateProfileResponseSchema, employerProfileResponseSchema]),
});

export type CandidateProfileRequestInput = z.infer<typeof candidateProfileRequestSchema>;
export type EmployerProfileRequestInput = z.infer<typeof employerProfileRequestSchema>;
export type CandidateProfileResponse = z.infer<typeof candidateProfileResponseSchema>;
export type EmployerProfileResponse = z.infer<typeof employerProfileResponseSchema>;
