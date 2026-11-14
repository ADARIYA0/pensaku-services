import type { Request, Response } from 'express';
import { getAccessTokenForStudent, fetchEtholConfig } from '../../services/etholAuth.service.js';
import logger from '../../utils/logger.js';

export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const identifier = (
      (req.query.email || req.query.nrp || req.body?.email || req.body?.nrp) as string
    ).trim();

    const { accessToken } = await getAccessTokenForStudent(identifier);
    const config = await fetchEtholConfig(accessToken);

    res.status(200).json({
      status: 'success',
      message: 'ETHOL config retrieved successfully.',
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred fetching ETHOL config.';
    logger.error({ err: error }, 'Failed to get ETHOL config');
    res.status(500).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
