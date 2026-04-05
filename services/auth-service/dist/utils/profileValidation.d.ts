export declare const PHONE_NUMBER_REGEX: RegExp;
export declare const PROFILE_TAG_MAX_ITEMS = 20;
export declare const PROFILE_TAG_MAX_LENGTH = 40;
/**
 * Trims surrounding whitespace from user-provided text.
 */
export declare function sanitizeText(value: string): string;
export declare function isValidVietnamPhoneNumber(value: string): boolean;
export declare function sanitizeTagList(items: readonly string[]): string[];
export declare function isTagListTooLong(items: readonly string[], maxItems?: number): boolean;
export declare function isValidRelativePdfPath(value: string): boolean;
//# sourceMappingURL=profileValidation.d.ts.map