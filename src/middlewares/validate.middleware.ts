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
          res.status(400).json({
            status: 'error',
            message: `${path}: ${firstIssue.message}`,
            data: null,
          });
          return;
        }
        req.body = result.output;
      }

      if (schema.query) {
        const result = v.safeParse(schema.query, req.query);
        if (!result.success) {
          const firstIssue = result.issues[0];
          const path = firstIssue.path ? firstIssue.path.map((p) => p.key).join('.') : 'query';
          res.status(400).json({
            status: 'error',
            message: `${path}: ${firstIssue.message}`,
            data: null,
          });
          return;
        }
        Object.assign(req.query, result.output as Record<string, unknown>);
      }

      if (schema.params) {
        const result = v.safeParse(schema.params, req.params);
        if (!result.success) {
          const firstIssue = result.issues[0];
          const path = firstIssue.path ? firstIssue.path.map((p) => p.key).join('.') : 'params';
          res.status(400).json({
            status: 'error',
            message: `${path}: ${firstIssue.message}`,
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
