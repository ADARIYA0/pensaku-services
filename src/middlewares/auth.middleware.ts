import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import logger from '../utils/logger.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({
      status: 'error',
      message: 'Access denied. Authorization Bearer token is missing.',
      data: null,
    });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid authorization format. Must be "Bearer <token>".',
      data: null,
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      email: payload.email,
    };
    next();
  } catch (err) {
    logger.warn({ ip: req.ip }, 'Unauthorized request: Invalid or expired access token');
    res.status(401).json({
      status: 'error',
      message: 'Access token is invalid or expired.',
      data: null,
    });
  }
}

export function flexibleAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    next();
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    next();
  }
}

export default authenticateToken;
