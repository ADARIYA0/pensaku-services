import type { Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  refreshUserTokens,
  logoutUser,
  getUserById,
  updateUserProfile,
} from '../services/auth.service.js';
import logger from '../utils/logger.js';
import type {
  RegisterRequestBody,
  LoginRequestBody,
  RefreshTokenRequestBody,
  UpdateProfileRequestBody,
} from '../types/auth.types.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      namaLengkap,
      email,
      password,
      kataSandi,
    } = req.body as RegisterRequestBody;

    const chosenName = (name || namaLengkap)!.trim();
    const chosenPassword = (password || kataSandi)!;

    const result = await registerUser(chosenName, email, chosenPassword);

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully.',
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An error occurred during registration.';

    logger.error({ err: error }, 'Registration controller error');

    if (message.includes('already exists')) {
      res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
        data: null,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Unable to complete registration. Please check your connection or try again later.',
      data: null,
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      password,
      kataSandi,
      rememberMe = false,
    } = req.body as LoginRequestBody;

    const chosenPassword = (password || kataSandi)!;

    const result = await loginUser(email, chosenPassword, rememberMe);

    res.status(200).json({
      status: 'success',
      message: 'Login successful.',
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An error occurred during login.';

    logger.error({ err: error }, 'Login controller error');

    if (message.includes('Invalid email or password')) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
        data: null,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Unable to connect to service. Please check your network connection or try again later.',
      data: null,
    });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenRequestBody;

    const tokens = await refreshUserTokens(refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Tokens refreshed successfully.',
      data: { tokens },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An error occurred while refreshing tokens.';

    logger.error({ err: error }, 'Refresh token controller error');

    res.status(401).json({
      status: 'error',
      message,
      data: null,
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenRequestBody;

    if (refreshToken) {
      await logoutUser(refreshToken);
    }

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully.',
      data: null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Logout controller error');

    res.status(500).json({
      status: 'error',
      message: 'An error occurred during logout.',
      data: null,
    });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
        data: null,
      });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({
        status: 'error',
        message: 'User profile not found.',
        data: null,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'User profile retrieved successfully.',
      data: user,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get user profile controller error');

    res.status(500).json({
      status: 'error',
      message: 'An error occurred while retrieving user profile.',
      data: null,
    });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
        data: null,
      });
      return;
    }

    const { name, email, prodi } = req.body as UpdateProfileRequestBody;

    const updatedUser = await updateUserProfile(userId, { name, email, prodi });

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: updatedUser,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An error occurred while updating profile.';

    logger.error({ err: error }, 'Update profile controller error');

    if (message.includes('already exists')) {
      res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
        data: null,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Unable to update profile. Please try again later.',
      data: null,
    });
  }
}
