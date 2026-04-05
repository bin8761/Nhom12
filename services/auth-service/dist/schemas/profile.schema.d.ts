import { z } from 'zod';
export declare const candidateProfileRequestSchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>>;
    phoneNumber: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    location: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>>;
}, "strip", z.ZodTypeAny, {
    phoneNumber?: string;
    dateOfBirth?: string;
    fullName?: string;
    location?: string;
}, {
    phoneNumber?: string;
    dateOfBirth?: string;
    fullName?: string;
    location?: string;
}>;
export declare const employerProfileRequestSchema: z.ZodObject<{
    companyName: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    companyWebsite: z.ZodOptional<z.ZodNullable<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>>;
    headquartersLocation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>>;
    contactEmail: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    contactPhone: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, "strip", z.ZodTypeAny, {
    companyName?: string;
    companyWebsite?: string;
    headquartersLocation?: string;
    contactEmail?: string;
    contactPhone?: string;
}, {
    companyName?: string;
    companyWebsite?: string;
    headquartersLocation?: string;
    contactEmail?: string;
    contactPhone?: string;
}>;
export declare const candidateProfileResponseSchema: z.ZodObject<{
    fullName: z.ZodNullable<z.ZodString>;
    phoneNumber: z.ZodNullable<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    updatedAt?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    fullName?: string;
    location?: string;
}, {
    updatedAt?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    fullName?: string;
    location?: string;
}>;
export declare const employerProfileResponseSchema: z.ZodObject<{
    companyName: z.ZodNullable<z.ZodString>;
    companyWebsite: z.ZodNullable<z.ZodString>;
    headquartersLocation: z.ZodNullable<z.ZodString>;
    contactEmail: z.ZodNullable<z.ZodString>;
    contactPhone: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    updatedAt?: string;
    companyName?: string;
    companyWebsite?: string;
    headquartersLocation?: string;
    contactEmail?: string;
    contactPhone?: string;
}, {
    updatedAt?: string;
    companyName?: string;
    companyWebsite?: string;
    headquartersLocation?: string;
    contactEmail?: string;
    contactPhone?: string;
}>;
export declare const profileResponseSchema: z.ZodObject<{
    role: z.ZodEnum<["CANDIDATE", "EMPLOYER"]>;
    profile: z.ZodUnion<[z.ZodObject<{
        fullName: z.ZodNullable<z.ZodString>;
        phoneNumber: z.ZodNullable<z.ZodString>;
        dateOfBirth: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        location: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        updatedAt?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        fullName?: string;
        location?: string;
    }, {
        updatedAt?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        fullName?: string;
        location?: string;
    }>, z.ZodObject<{
        companyName: z.ZodNullable<z.ZodString>;
        companyWebsite: z.ZodNullable<z.ZodString>;
        headquartersLocation: z.ZodNullable<z.ZodString>;
        contactEmail: z.ZodNullable<z.ZodString>;
        contactPhone: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        updatedAt?: string;
        companyName?: string;
        companyWebsite?: string;
        headquartersLocation?: string;
        contactEmail?: string;
        contactPhone?: string;
    }, {
        updatedAt?: string;
        companyName?: string;
        companyWebsite?: string;
        headquartersLocation?: string;
        contactEmail?: string;
        contactPhone?: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    role?: "CANDIDATE" | "EMPLOYER";
    profile?: {
        updatedAt?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        fullName?: string;
        location?: string;
    } | {
        updatedAt?: string;
        companyName?: string;
        companyWebsite?: string;
        headquartersLocation?: string;
        contactEmail?: string;
        contactPhone?: string;
    };
}, {
    role?: "CANDIDATE" | "EMPLOYER";
    profile?: {
        updatedAt?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        fullName?: string;
        location?: string;
    } | {
        updatedAt?: string;
        companyName?: string;
        companyWebsite?: string;
        headquartersLocation?: string;
        contactEmail?: string;
        contactPhone?: string;
    };
}>;
export type CandidateProfileRequestInput = z.infer<typeof candidateProfileRequestSchema>;
export type EmployerProfileRequestInput = z.infer<typeof employerProfileRequestSchema>;
export type CandidateProfileResponse = z.infer<typeof candidateProfileResponseSchema>;
export type EmployerProfileResponse = z.infer<typeof employerProfileResponseSchema>;
//# sourceMappingURL=profile.schema.d.ts.map