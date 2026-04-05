"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const profile_schema_1 = require("../../schemas/profile.schema");
describe('profile contract schemas', () => {
    it('accepts valid candidate profile response', () => {
        const payload = {
            role: 'CANDIDATE',
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
        expect(() => profile_schema_1.profileResponseSchema.parse(payload)).not.toThrow();
        expect(() => profile_schema_1.candidateProfileResponseSchema.parse(payload.profile)).not.toThrow();
    });
    it('rejects invalid candidate profile response', () => {
        const payload = {
            role: 'CANDIDATE',
            profile: {
                fullName: 123,
                phoneNumber: '+84901234567',
                location: 'Ho Chi Minh City',
                headline: 'Engineer',
                summary: 'Summary',
                skills: 'React',
                yearsExperience: 5,
                portfolioUrl: 'https://janedoe.dev',
                cvUrl: 'files/cv/jane-doe.pdf',
                preferredJobTypes: [],
                updatedAt: 'not-a-date',
            },
        };
        const parseCandidate = profile_schema_1.candidateProfileResponseSchema.safeParse(payload.profile);
        expect(parseCandidate.success).toBe(false);
    });
    it('accepts valid employer profile response', () => {
        const payload = {
            role: 'EMPLOYER',
            profile: {
                companyName: 'Acme Inc',
                companyWebsite: 'https://acme.example.com',
                industry: 'Technology',
                companySize: 'SMALL',
                headquartersLocation: 'Hanoi',
                companyDescription: 'We build awesome products',
                contactEmail: 'hr@acme.example.com',
                contactPhone: '+84901112223',
                updatedAt: new Date().toISOString(),
            },
        };
        expect(() => profile_schema_1.profileResponseSchema.parse(payload)).not.toThrow();
        expect(() => profile_schema_1.employerProfileResponseSchema.parse(payload.profile)).not.toThrow();
    });
    it('rejects invalid employer profile response', () => {
        const payload = {
            role: 'EMPLOYER',
            profile: {
                companyName: 789,
                companyWebsite: 'https://acme.example.com',
                industry: 'Technology',
                companySize: 'UNKNOWN',
                headquartersLocation: 'Hanoi',
                companyDescription: 'We build awesome products',
                contactEmail: 'hr@acme.example.com',
                contactPhone: '+84901112223',
                updatedAt: 'not-a-date',
            },
        };
        const parseEmployer = profile_schema_1.employerProfileResponseSchema.safeParse(payload.profile);
        expect(parseEmployer.success).toBe(false);
    });
});
//# sourceMappingURL=profile.contract.test.js.map