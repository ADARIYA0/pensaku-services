import 'dotenv/config';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import logger from '../utils/logger.js';

const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15;
const windowMs = windowMinutes * 60 * 1000;

const maxGeneralRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const maxAuthRequests = Number(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS) || 10;

export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  limit: maxGeneralRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/health' || req.originalUrl === '/health',
  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
      },
      'Global rate limit exceeded'
    );
    res.status(429).json({
      status: 'error',
      message: 'Too many requests from this IP, please try again later.',
      data: null,
    });
  },
});

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  limit: maxAuthRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        method: req.method,
        path: req.originalUrl,
      },
      'Authentication/sync rate limit exceeded'
    );
    res.status(429).json({
      status: 'error',
      message: 'Too many authentication/sync requests from this IP, please try again later.',
      data: null,
    });
  },
});

export default {
  globalRateLimiter,
  authRateLimiter,
};
