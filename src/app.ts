import express, { type Express, type Request, type Response } from 'express';
import httpLogger from './middlewares/logger.middleware.js';

const app: Express = express();

app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'PENSaku Services is running smoothly!'
    });
});

app.use((req: Request, res: Response) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

export default app;
