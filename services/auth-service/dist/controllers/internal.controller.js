"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByIdHandler = getUserByIdHandler;
exports.batchGetUsersHandler = batchGetUsersHandler;
const prismaClient_1 = require("../infra/prisma/prismaClient");
const prisma = (0, prismaClient_1.getPrismaClient)();
async function getUserByIdHandler(req, res, next) {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({
                code: 'ERR_VALIDATION',
                message: 'userId is required',
            });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                address: true,
                dateOfBirth: true,
            },
        });
        if (!user) {
            res.status(404).json({
                code: 'ERR_NOT_FOUND',
                message: 'User not found',
            });
            return;
        }
        res.status(200).json({
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
}
async function batchGetUsersHandler(req, res, next) {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            res.status(400).json({
                code: 'ERR_VALIDATION',
                message: 'userIds must be a non-empty array',
            });
            return;
        }
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                candidateProfile: {
                    select: {
                        location: true,
                    },
                },
                employerProfile: {
                    select: {
                        headquartersLocation: true,
                    },
                },
            },
        });
        // Flatten location data
        const usersWithLocation = users.map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            location: user.candidateProfile?.location || user.employerProfile?.headquartersLocation || null,
        }));
        res.status(200).json({
            data: usersWithLocation,
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=internal.controller.js.map