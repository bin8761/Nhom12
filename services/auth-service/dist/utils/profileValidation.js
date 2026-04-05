"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFILE_TAG_MAX_LENGTH = exports.PROFILE_TAG_MAX_ITEMS = exports.PHONE_NUMBER_REGEX = void 0;
exports.sanitizeText = sanitizeText;
exports.isValidVietnamPhoneNumber = isValidVietnamPhoneNumber;
exports.sanitizeTagList = sanitizeTagList;
exports.isTagListTooLong = isTagListTooLong;
exports.isValidRelativePdfPath = isValidRelativePdfPath;
exports.PHONE_NUMBER_REGEX = /^(\+?84|0)(\d{9,10})$/;
exports.PROFILE_TAG_MAX_ITEMS = 20;
exports.PROFILE_TAG_MAX_LENGTH = 40;
/**
 * Trims surrounding whitespace from user-provided text.
 */
function sanitizeText(value) {
    return value.trim();
}
function isValidVietnamPhoneNumber(value) {
    return exports.PHONE_NUMBER_REGEX.test(value.trim());
}
function sanitizeTagList(items) {
    const seen = new Set();
    const result = [];
    for (const rawItem of items) {
        const item = rawItem.trim();
        if (!item) {
            continue;
        }
        if (!seen.has(item)) {
            seen.add(item);
            result.push(item);
        }
    }
    return result;
}
function isTagListTooLong(items, maxItems = exports.PROFILE_TAG_MAX_ITEMS) {
    return items.length > maxItems;
}
function isValidRelativePdfPath(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return false;
    }
    if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
        return false;
    }
    if (trimmed.includes('..') || trimmed.includes('\\')) {
        return false;
    }
    return trimmed.toLowerCase().endsWith('.pdf');
}
//# sourceMappingURL=profileValidation.js.map