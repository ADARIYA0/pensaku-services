import app from './app.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
    logger.info(`PENSaku API is running at http://localhost:${PORT} in ${ENV} mode`);
});

const gracefulShutdown = () => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
        logger.info('Closed out remaining connections.');
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
