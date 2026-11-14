import type { Request, Response } from 'express';
import { getAccessTokenForStudent, validateEtholToken } from '../../services/etholAuth.service.js';
import logger from '../../utils/logger.js';

export async function getValidasiToken(req: Request, res: Response): Promise<void> {
  try {
    const identifier = (
      (req.query.email || req.query.nrp || req.body?.email || req.body?.nrp) as string
    ).trim();

    const { accessToken } = await getAccessTokenForStudent(identifier);
    const validation = await validateEtholToken(accessToken);

    res.status(200).json({
      status: 'success',
      message: 'ETHOL token is valid.',
      data: validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token validation failed.';
    logger.error({ err: error }, 'Failed to validate ETHOL token');
    res.status(401).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
