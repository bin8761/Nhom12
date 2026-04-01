import type { NextFunction, Request, Response } from 'express';
interface RequestWithUser extends Request {
    user?: {
        id?: string;
        role?: string;
        emailVerified?: boolean;
    };
}
export declare function getMyProfile(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;
export declare function updateMyProfile(req: RequestWithUser, res: Response, next: NextFunction): Promise<void>;
export declare function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Get public user profile (for chat display names)
 * Returns minimal public info: company name or full name
 */
export declare function getPublicUserProfile(req: Request, res: Response): Promise<void>;
export {};
//# sourceMappingURL=profile.controller.d.ts.map