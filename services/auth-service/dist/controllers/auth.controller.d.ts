import type { NextFunction, Request, Response } from 'express';
export declare function register(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function login(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function refresh(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function logout(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function me(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function verifyPhone(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function resendPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function changePassword(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map