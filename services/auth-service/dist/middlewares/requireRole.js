"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(allowedRoles) {
    const normalized = allowedRoles.map((role) => role.toUpperCase());
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole) {
            res.status(401).json({ code: 'ERR_UNAUTHORIZED', message: 'Access token required' });
            return;
        }
        if (!normalized.includes(String(userRole).toUpperCase())) {
            res.status(403).json({ code: 'ERR_FORBIDDEN', message: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=requireRole.js.map