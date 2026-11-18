import type { Request, Response, NextFunction } from 'express';
import * as v from 'valibot';

export interface RequestValidationSchema {
  body?: v.GenericSchema;
  query?: v.GenericSchema;
  params?: v.GenericSchema;
}

export function validate(schema: RequestValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        const result = v.safeParse(schema.body, req.body);
        if (!result.success) {
          const firstIssue = result.issues[0];
          const path = firstIssue.path ? firstIssue.path.map((p) => p.key).join('.') : 'body';
          const field = path as string;

          const fieldMessages: Record<string, string> = {
            email: 'Format email tidak valid. Contoh: nama@domain.com',
            namaLengkap: 'Nama lengkap tidak valid. Minimal 2 karakter.',
            name: 'Nama tidak valid. Minimal 2 karakter.',
            kataSandi: 'Kata sandi harus minimal 8 karakter.',
            password: 'Kata sandi harus minimal 8 karakter.',
            konfirmasiKataSandi: 'Konfirmasi kata sandi tidak cocok.',
            confirmPassword: 'Konfirmasi kata sandi tidak cocok.',
            refreshToken: 'Token tidak valid.',
          };

          const userMessage = fieldMessages[field] ?? 'Data yang dikirim tidak valid. Periksa kembali isian Anda.';

          res.status(400).json({
            status: 'error',
            message: userMessage,
            data: null,
          });
          return;
        }
        req.body = result.output;
      }

      if (schema.query) {
        const result = v.safeParse(schema.query, req.query);
        if (!result.success) {
          res.status(400).json({
            status: 'error',
            message: 'Parameter permintaan tidak valid.',
            data: null,
          });
          return;
        }
        Object.assign(req.query, result.output as Record<string, unknown>);
      }

      if (schema.params) {
        const result = v.safeParse(schema.params, req.params);
        if (!result.success) {
          res.status(400).json({
            status: 'error',
            message: 'Parameter URL tidak valid.',
            data: null,
          });
          return;
        }
        Object.assign(req.params, result.output as Record<string, unknown>);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export default validate;
