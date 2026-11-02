import app from './app.js';

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
    console.log(`[Server]: PENSaku API is running at http://localhost:${PORT} in ${ENV} mode`);
});

const gracefulShutdown = () => {
    console.log('\n[Server]: Shutting down gracefully...');
    server.close(() => {
        console.log('[Server]: Closed out remaining connections.');
        process.exit(0);
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);