"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verifyInternalSecret_1 = require("../middlewares/verifyInternalSecret");
const internal_controller_1 = require("../controllers/internal.controller");
const internalRouter = (0, express_1.Router)();
internalRouter.get('/users/:userId', verifyInternalSecret_1.verifyInternalSecret, internal_controller_1.getUserByIdHandler);
internalRouter.post('/users/batch', verifyInternalSecret_1.verifyInternalSecret, internal_controller_1.batchGetUsersHandler);
exports.default = internalRouter;
//# sourceMappingURL=internal.routes.js.map