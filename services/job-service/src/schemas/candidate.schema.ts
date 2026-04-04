import { z } from 'zod';

const trimString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const candidateLocationUpdateSchema = z.object({
  provinceCode: z
    .string()
    .trim()
    .min(2, 'Mã tỉnh phải có ít nhất 2 ký tự')
    .max(64, 'Mã tỉnh không được vượt quá 64 ký tự')
    .optional(),
  addressLine: z
    .string({ required_error: 'Địa chỉ là bắt buộc' })
    .trim()
    .min(3, 'Địa chỉ phải có ít nhất 3 ký tự')
    .max(255, 'Địa chỉ không được vượt quá 255 ký tự'),
  note: z
    .string()
    .trim()
    .max(255, 'Ghi chú không được vượt quá 255 ký tự')
    .optional(),
});

export type CandidateLocationUpdateInput = z.infer<typeof candidateLocationUpdateSchema>;

export function normalizeCandidateLocationPayload(body: Record<string, unknown>): Record<string, unknown> {
  return {
    provinceCode: trimString(body.provinceCode),
    addressLine: trimString(body.addressLine),
    note: trimString(body.note),
  };
}

