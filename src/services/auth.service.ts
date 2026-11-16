import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import type {
  AuthResponseData,
  AuthTokens,
  JwtTokenPayload,
  UserResponse,
} from '../types/auth.types.js';

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
const REFRESH_TOKEN_EXPIRY_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('CRITICAL: JWT_SECRET environment variable is not defined!');
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  return secret;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateAccessToken(userId: string, email: string): string {
  const secret = getJwtSecret();
  const payload: JwtTokenPayload = {
    sub: userId,
    email,
  };
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtTokenPayload {
  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret) as JwtTokenPayload;
  } catch (err) {
    throw new Error('Invalid or expired access token.');
  }
}

export async function createRefreshToken(
  userId: string,
  rememberMe: boolean = false
): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);

  const durationMs = rememberMe
    ? REFRESH_TOKEN_EXPIRY_REMEMBER_MS
    : REFRESH_TOKEN_EXPIRY_DEFAULT_MS;
  const expiresAt = new Date(Date.now() + durationMs);

  await prisma.userRefreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return rawToken;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  agreeTerms: boolean = true
): Promise<AuthResponseData> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    logger.warn({ email: normalizedEmail }, 'Registration failed: Email already registered');
    throw new Error('An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      agreeTerms,
    },
  });

  logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = await createRefreshToken(user.id, false);

  const tokens: AuthTokens = {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    tokenType: 'Bearer',
  };

  const userResponse: UserResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };

  return {
    user: userResponse,
    tokens,
  };
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean = false
): Promise<AuthResponseData> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    logger.warn({ email: normalizedEmail }, 'Login failed: Account not found');
    throw new Error('Invalid email or password.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    logger.warn({ email: normalizedEmail }, 'Login failed: Incorrect password');
    throw new Error('Invalid email or password.');
  }

  logger.info({ userId: user.id, email: user.email, rememberMe }, 'User logged in successfully');

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = await createRefreshToken(user.id, rememberMe);

  const tokens: AuthTokens = {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    tokenType: 'Bearer',
  };

  const userResponse: UserResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };

  return {
    user: userResponse,
    tokens,
  };
}

export async function refreshUserTokens(rawRefreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(rawRefreshToken);

  const storedToken = await prisma.userRefreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken) {
    logger.warn('Token refresh failed: Refresh token not found in database');
    throw new Error('Invalid refresh token. Please sign in again.');
  }

  if (new Date() > storedToken.expiresAt) {
    await prisma.userRefreshToken.delete({
      where: { id: storedToken.id },
    }).catch(() => null);

    logger.warn({ userId: storedToken.userId }, 'Token refresh failed: Refresh token expired');
    throw new Error('Refresh token has expired. Please sign in again.');
  }

  await prisma.userRefreshToken.delete({
    where: { id: storedToken.id },
  });

  const newAccessToken = generateAccessToken(storedToken.user.id, storedToken.user.email);
  const newRefreshToken = await createRefreshToken(storedToken.user.id, false);

  logger.debug({ userId: storedToken.userId }, 'Access and refresh tokens rotated successfully');

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    tokenType: 'Bearer',
  };
}

export async function logoutUser(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.userRefreshToken.deleteMany({
    where: { tokenHash },
  });

  logger.info('User refresh token revoked successfully upon logout');
}

export async function getUserById(userId: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}
