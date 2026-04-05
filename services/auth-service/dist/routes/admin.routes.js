"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController = __importStar(require("../controllers/admin.controller"));
const authAccess_1 = require("../middlewares/authAccess");
const requireRole_1 = require("../middlewares/requireRole");
const adminRouter = (0, express_1.Router)();
// All admin routes require authentication and ADMIN role
adminRouter.use(authAccess_1.authAccess);
adminRouter.use((0, requireRole_1.requireRole)(['ADMIN']));
// Get pending employers
adminRouter.get('/users/pending', adminController.getPendingEmployers);
// Get all users with filters
adminRouter.get('/users', adminController.getAllUsers);
// Approve employer
adminRouter.post('/users/:userId/approve', adminController.approveEmployer);
// Reject employer
adminRouter.post('/users/:userId/reject', adminController.rejectEmployer);
// Get user details
adminRouter.get('/users/:userId', adminController.getUserDetails);
exports.default = adminRouter;
//# sourceMappingURL=admin.routes.js.map