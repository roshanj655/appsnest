import express from 'express';
import { registerBusiness, login, refreshToken, changePassword } from '../controllers/authController';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { changePasswordSchema, loginSchema, refreshSchema } from '../schemas';

const router = express.Router();

router.post('/register', protect, requireSuperAdmin, registerBusiness);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refreshToken);
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

export default router;
