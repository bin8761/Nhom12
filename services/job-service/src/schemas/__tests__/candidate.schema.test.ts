import { candidateLocationUpdateSchema, normalizeCandidateLocationPayload } from '../candidate.schema';

describe('candidateLocationUpdateSchema', () => {
  it('accepts valid payload', () => {
    const normalized = normalizeCandidateLocationPayload({
      provinceCode: '  VN-HCM  ',
      addressLine: ' 12 Nguyen Dinh Chieu ',
      note: ' Prefer remote ',
    });

    const result = candidateLocationUpdateSchema.parse(normalized);

    expect(result).toEqual({
      provinceCode: 'VN-HCM',
      addressLine: '12 Nguyen Dinh Chieu',
      note: 'Prefer remote',
    });
  });

  it('rejects missing required fields', () => {
    const normalized = normalizeCandidateLocationPayload({
      provinceCode: ' ',
    });

    const result = candidateLocationUpdateSchema.safeParse(normalized);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toEqual(
        expect.arrayContaining([
          'Address line is required',
        ]),
      );
    }
  });

  it('caps note length at 255 characters', () => {
    const normalized = normalizeCandidateLocationPayload({
      provinceCode: 'VN-HN',
      addressLine: '123 Doi Can',
      note: 'x'.repeat(300),
    });

    const result = candidateLocationUpdateSchema.safeParse(normalized);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Note must be at most 255 characters');
    }
  });
});

