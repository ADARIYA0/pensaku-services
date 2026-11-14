import express, { type Express, type Request, type Response } from 'express';
import httpLogger from './middlewares/logger.middleware.js';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware.js';
import etholRouter from './routes/ethol.routes.js';

const app: Express = express();

app.set('trust proxy', 1);

app.use(httpLogger);
app.use(globalRateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
    const memory = process.memoryUsage();
    const uptime = Number(process.uptime().toFixed(2));
    const timestamp = new Date().toISOString();
    const version = '0.2.0';

    res.status(200).json({
        status: 'success',
        message: 'PENSaku Services is running smoothly!',
        data: {
            status: 'ok',
            timestamp,
            uptime,
            memoryUsage: {
                rss: memory.rss,
                heapTotal: memory.heapTotal,
                heapUsed: memory.heapUsed,
                external: memory.external,
            },
            version,
        },
    });
});

app.use('/api/ethol', etholRouter);

app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

export default app;
