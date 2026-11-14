import { Router } from 'express';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  linkAccountSchema,
  unlinkAccountSchema,
  syncDataSchema,
  studentQuerySchema,
  coursesQuerySchema,
  attendanceQuerySchema,
} from '../schemas/ethol.schema.js';
import {
  linkAccount,
  unlinkAccount,
  syncData,
  checkAttendance,
  getConfig,
  getValidasiToken,
  getCourses,
} from '../controllers/ethol/index.js';

const router = Router();

router.post('/link', authRateLimiter, validate(linkAccountSchema), linkAccount);
router.delete('/link', validate(unlinkAccountSchema), unlinkAccount);
router.post('/sync', authRateLimiter, validate(syncDataSchema), syncData);
router.get('/config', validate(studentQuerySchema), getConfig);
router.get('/validate-token', validate(studentQuerySchema), getValidasiToken);
router.get('/courses', validate(coursesQuerySchema), getCourses);
router.get('/attendance', validate(attendanceQuerySchema), checkAttendance);

export default router;
