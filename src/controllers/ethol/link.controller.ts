import type { Request, Response } from 'express';
import prisma from '../../config/prisma.js';
import { encrypt } from '../../utils/encryption.js';
import { setCachedEtholAccessToken, invalidateCachedEtholAccessToken } from '../../utils/tokenCache.js';
import {
  checkLockout,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
} from '../../utils/bruteForceGuard.js';
import { loginViaEtholCas } from '../../services/etholAuth.service.js';
import logger from '../../utils/logger.js';
import type { LinkAccountRequest } from '../../types/ethol.types.js';

const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function linkAccount(req: Request, res: Response): Promise<void> {
  const { email, nrp, password } = req.body as LinkAccountRequest;
  const identifier = (email || nrp)!.trim();

  try {
    const lockout = checkLockout(identifier);
    if (lockout.isLocked) {
      logger.warn({ identifier }, 'Login blocked: Identifier is temporarily locked due to excessive failed attempts');
      res.status(429).json({
        status: 'error',
        message: `Too many failed login attempts for this account. It is temporarily locked. Please try again in ${Math.ceil((lockout.remainingSeconds ?? 0) / 60)} minutes.`,
        data: null,
      });
      return;
    }

    const casResult = await loginViaEtholCas(identifier, password);

    clearFailedLoginAttempts(identifier);
    clearFailedLoginAttempts(casResult.nipnrp);

    const userEmail = email || (identifier.includes('@') ? identifier : undefined);

    setCachedEtholAccessToken(casResult.nipnrp, casResult.accessToken);
    if (userEmail) {
      setCachedEtholAccessToken(userEmail, casResult.accessToken);
    }

    const encryptedData = encrypt(casResult.refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

    const pensakuEmail = (req.body as any).userEmail || (req as any).user?.email;
    const matchedUser = pensakuEmail
      ? await prisma.user.findFirst({
          where: { email: (pensakuEmail as string).trim().toLowerCase() },
          select: { id: true },
        })
      : null;

    await prisma.etholCredential.upsert({
      where: { etholNrp: casResult.nipnrp },
      update: {
        etholEmail: userEmail,
        etholNama: casResult.nama,
        etholNomor: casResult.nomor,
        userId: matchedUser?.id ?? undefined,
        encryptedRefreshToken: encryptedData.encrypted,
        refreshTokenIv: encryptedData.iv,
        refreshTokenTag: encryptedData.tag,
        refreshTokenExpiresAt: expiresAt,
      },
      create: {
        etholNrp: casResult.nipnrp,
        etholEmail: userEmail,
        etholNama: casResult.nama,
        etholNomor: casResult.nomor,
        userId: matchedUser?.id ?? undefined,
        encryptedRefreshToken: encryptedData.encrypted,
        refreshTokenIv: encryptedData.iv,
        refreshTokenTag: encryptedData.tag,
        refreshTokenExpiresAt: expiresAt,
      },
    });

    logger.info({ nrp: casResult.nipnrp, email: userEmail }, 'ETHOL account linked successfully');

    res.status(200).json({
      status: 'success',
      message: 'ETHOL account linked successfully.',
      data: {
        email: userEmail ?? null,
        nrp: casResult.nipnrp,
        nama: casResult.nama,
        linkedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred during account linking.';

    logger.error({ err: error }, 'Failed to link ETHOL account');

    const isInvalidCreds = message.includes('Invalid PENS credentials');
    if (isInvalidCreds && identifier) {
      const attemptResult = recordFailedLoginAttempt(identifier);
      if (attemptResult.isNowLocked) {
        logger.warn({ identifier }, 'Account has been locked out after 5 consecutive failed login attempts');
      }
    }

    const statusCode = isInvalidCreds ? 401 : 500;

    res.status(statusCode).json({
      status: 'error',
      message,
      data: null,
    });
  }
}

export async function unlinkAccount(req: Request, res: Response): Promise<void> {
  try {
    const { email, nrp } = req.body as { email?: string; nrp?: string };
    const identifier = (email || nrp)?.trim();

    if (!identifier) {
      res.status(400).json({
        status: 'error',
        message: 'Either email or nrp is required to unlink ETHOL account.',
        data: null,
      });
      return;
    }

    const credential = await prisma.etholCredential.findFirst({
      where: {
        OR: [
          { etholNrp: identifier },
          { etholEmail: identifier },
        ],
      },
    });

    if (!credential) {
      res.status(404).json({
        status: 'error',
        message: 'No linked ETHOL account found for this student.',
        data: null,
      });
      return;
    }

    await prisma.etholCredential.delete({
      where: { id: credential.id },
    });

    invalidateCachedEtholAccessToken(credential.etholNrp);
    if (credential.etholEmail) {
      invalidateCachedEtholAccessToken(credential.etholEmail);
    }

    logger.info({ nrp: credential.etholNrp, email: credential.etholEmail }, 'ETHOL account unlinked successfully');

    res.status(200).json({
      status: 'success',
      message: 'ETHOL account unlinked successfully.',
      data: null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to unlink ETHOL account');

    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occurred while unlinking ETHOL account.',
      data: null,
    });
  }
}
