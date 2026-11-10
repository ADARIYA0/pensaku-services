import { pinoHttp, type HttpLogger } from 'pino-http';
import logger from '../utils/logger.js';

export const httpLogger: HttpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    // Lower log level for health checks so routine health probes don't pollute logs
    if (req.url === '/health') {
      return 'debug';
    }
    return 'info';
  },
  customProps: (req) => {
    return {
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  },
  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode} in ${responseTime}ms`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
});

export default httpLogger;
