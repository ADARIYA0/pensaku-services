import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from '../schemas/auth.schema.js';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login', authRateLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.patch('/profile', authenticateToken, validate(updateProfileSchema), updateProfile);

export default router;
