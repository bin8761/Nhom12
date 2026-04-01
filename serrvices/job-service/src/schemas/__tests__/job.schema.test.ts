import {
  jobCreateSchema,
  jobUpdateSchema,
  normalizeJobCreatePayload,
  normalizeJobUpdatePayload,
} from '../job.schema';

describe('job schema validations', () => {
  const basePayload = {
    title: 'Great backend engineer role',
    description: 'x'.repeat(60),
    skills: ['node', 'ts'],
    salary: 1200,
    currency: 'vnd',
    location: 'Ha Noi',
    jobType: 'FULL_TIME',
    provinceCode: 'VN-HN',
    districtCode: 'VN-HN-BA-DINH',
    addressLine: '123 Doi Can',
  };

  it('accepts valid create payload with region codes and address line', () => {
    const normalized = normalizeJobCreatePayload(basePayload);
    const parsed = jobCreateSchema.parse(normalized);
    expect(parsed.provinceCode).toBe('VN-HN');
    expect(parsed.addressLine).toBe('123 Doi Can');
    expect(parsed.currency).toBe('VND');
  });

  it('accepts update with province code', () => {
    const normalized = normalizeJobUpdatePayload({
      provinceCode: 'VN-HCM',
      addressLine: '  456 Nguyen Hue  ',
    });
    const parsed = jobUpdateSchema.parse(normalized);
    expect(parsed.addressLine).toBe('456 Nguyen Hue');
    expect(parsed.provinceCode).toBe('VN-HCM');
  });
});
