"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileResponseSchema = exports.employerProfileResponseSchema = exports.candidateProfileResponseSchema = exports.employerProfileRequestSchema = exports.candidateProfileRequestSchema = void 0;
const zod_1 = require("zod");
const profileValidation_1 = require("../utils/profileValidation");
const stringTagSchema = zod_1.z
    .string()
    .transform((value) => (0, profileValidation_1.sanitizeText)(value))
    .refine((value) => value.length > 0, 'Giá trị không được để trống')
    .refine((value) => value.length <= profileValidation_1.PROFILE_TAG_MAX_LENGTH, {
    message: `Giá trị không được vượt quá ${profileValidation_1.PROFILE_TAG_MAX_LENGTH} ký tự`,
});
const stringTagListSchema = zod_1.z
    .array(stringTagSchema)
    .transform((items) => (0, profileValidation_1.sanitizeTagList)(items))
    .refine((items) => !(0, profileValidation_1.isTagListTooLong)(items), {
    message: `Danh sách không được vượt quá ${profileValidation_1.PROFILE_TAG_MAX_ITEMS} mục`,
});
const phoneNumberSchema = zod_1.z
    .string()
    .transform((value) => (0, profileValidation_1.sanitizeText)(value))
    .refine((value) => (0, profileValidation_1.isValidVietnamPhoneNumber)(value), {
    message: 'Số điện thoại phải là số điện thoại Việt Nam hợp lệ',
});
const urlSchema = zod_1.z
    .string()
    .transform((value) => (0, profileValidation_1.sanitizeText)(value))
    .pipe(zod_1.z.string().url('Giá trị phải là URL hợp lệ'));
const relativePdfPathSchema = zod_1.z
    .string()
    .transform((value) => (0, profileValidation_1.sanitizeText)(value))
    .refine((value) => (0, profileValidation_1.isValidRelativePdfPath)(value), {
    message: 'Đường dẫn CV phải là file PDF hợp lệ',
});
const candidateProfileCoreSchema = zod_1.z.object({
    fullName: zod_1.z
        .string()
        .transform((value) => (0, profileValidation_1.sanitizeText)(value))
        .refine((value) => value.length > 0, 'Họ và tên không được để trống')
        .refine((value) => value.length <= 120, 'Họ và tên quá dài')
        .optional(),
    phoneNumber: phoneNumberSchema.optional(),
    dateOfBirth: zod_1.z
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
    location: zod_1.z
        .string()
        .transform((value) => (0, profileValidation_1.sanitizeText)(value))
        .refine((value) => value.length > 0, 'Địa chỉ không được để trống')
        .refine((value) => value.length <= 120, 'Địa chỉ quá dài')
        .optional(),
});
const companySizeSchema = zod_1.z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);
const employerProfileCoreSchema = zod_1.z.object({
    companyName: zod_1.z
        .string({ required_error: 'Tên công ty là bắt buộc' })
        .transform((value) => (0, profileValidation_1.sanitizeText)(value))
        .refine((value) => value.length > 0, 'Tên công ty là bắt buộc')
        .refine((value) => value.length <= 160, 'Tên công ty quá dài'),
    companyWebsite: urlSchema.nullish(),
    headquartersLocation: zod_1.z
        .string()
        .transform((value) => (0, profileValidation_1.sanitizeText)(value))
        .refine((value) => value.length > 0, 'Địa chỉ trụ sở không được để trống')
        .refine((value) => value.length <= 160, 'Địa chỉ trụ sở quá dài')
        .optional(),
    contactEmail: zod_1.z
        .string()
        .transform((value) => (0, profileValidation_1.sanitizeText)(value))
        .pipe(zod_1.z.string().email('Email liên hệ phải hợp lệ'))
        .optional(),
    contactPhone: phoneNumberSchema.optional(),
});
exports.candidateProfileRequestSchema = candidateProfileCoreSchema;
exports.employerProfileRequestSchema = employerProfileCoreSchema;
exports.candidateProfileResponseSchema = zod_1.z.object({
    fullName: zod_1.z.string().nullable(),
    phoneNumber: zod_1.z.string().nullable(),
    dateOfBirth: zod_1.z.string().datetime().nullable().optional(),
    location: zod_1.z.string().nullable(),
    updatedAt: zod_1.z.string().datetime().nullable(),
});
exports.employerProfileResponseSchema = zod_1.z.object({
    companyName: zod_1.z.string().nullable(),
    companyWebsite: zod_1.z.string().nullable(),
    headquartersLocation: zod_1.z.string().nullable(),
    contactEmail: zod_1.z.string().nullable(),
    contactPhone: zod_1.z.string().nullable(),
    updatedAt: zod_1.z.string().datetime().nullable(),
});
exports.profileResponseSchema = zod_1.z.object({
    role: zod_1.z.enum(['CANDIDATE', 'EMPLOYER']),
    profile: zod_1.z.union([exports.candidateProfileResponseSchema, exports.employerProfileResponseSchema]),
});
//# sourceMappingURL=profile.schema.js.map