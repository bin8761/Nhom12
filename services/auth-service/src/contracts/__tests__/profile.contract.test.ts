import { candidateProfileResponseSchema, employerProfileResponseSchema, profileResponseSchema } from '../../schemas/profile.schema';

describe('profile contract schemas', () => {
  it('accepts valid candidate profile response', () => {
    const payload = {
      role: 'CANDIDATE' as const,
      profile: {
        fullName: 'Jane Doe',
        phoneNumber: '+84901234567',
        location: 'Ho Chi Minh City',
        headline: 'Frontend Engineer',
        summary: '5 years experience in React',
        skills: ['React', 'TypeScript'],
        yearsExperience: 5,
        portfolioUrl: 'https://janedoe.dev',
        cvUrl: 'files/cv/jane-doe.pdf',
        preferredJobTypes: ['FULL_TIME'],
        updatedAt: new Date().toISOString(),
      },
    };

    expect(() => profileResponseSchema.parse(payload)).not.toThrow();
    expect(() => candidateProfileResponseSchema.parse(payload.profile)).not.toThrow();
  });

  it('rejects invalid candidate profile response', () => {
    const payload = {
      role: 'CANDIDATE' as const,
      profile: {
        fullName: 123 as unknown as string,
        phoneNumber: '+84901234567',
        location: 'Ho Chi Minh City',
        headline: 'Engineer',
        summary: 'Summary',
        skills: 'React' as unknown as string[],
        yearsExperience: 5,
        portfolioUrl: 'https://janedoe.dev',
        cvUrl: 'files/cv/jane-doe.pdf',
        preferredJobTypes: [] as unknown as string,
        updatedAt: 'not-a-date',
      },
    };

    const parseCandidate = candidateProfileResponseSchema.safeParse(payload.profile);
    expect(parseCandidate.success).toBe(false);
  });

  it('accepts valid employer profile response', () => {
    const payload = {
      role: 'EMPLOYER' as const,
      profile: {
        companyName: 'Acme Inc',
        companyWebsite: 'https://acme.example.com',
        industry: 'Technology',
        companySize: 'SMALL' as const,
        headquartersLocation: 'Hanoi',
        companyDescription: 'We build awesome products',
        contactEmail: 'hr@acme.example.com',
        contactPhone: '+84901112223',
        updatedAt: new Date().toISOString(),
      },
    };

    expect(() => profileResponseSchema.parse(payload)).not.toThrow();
    expect(() => employerProfileResponseSchema.parse(payload.profile)).not.toThrow();
  });

  it('rejects invalid employer profile response', () => {
    const payload = {
      role: 'EMPLOYER' as const,
      profile: {
        companyName: 789 as unknown as string,
        companyWebsite: 'https://acme.example.com',
        industry: 'Technology',
        companySize: 'UNKNOWN' as unknown as 'SMALL',
        headquartersLocation: 'Hanoi',
        companyDescription: 'We build awesome products',
        contactEmail: 'hr@acme.example.com',
        contactPhone: '+84901112223',
        updatedAt: 'not-a-date',
      },
    };

    const parseEmployer = employerProfileResponseSchema.safeParse(payload.profile);
    expect(parseEmployer.success).toBe(false);
  });
});
