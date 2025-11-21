import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import routes from './routes';
import { initRedis } from './redis';
import { logger } from './logger';
import { generateGatewayKeys } from './crypto';
import { setupWebSocket } from './websocket';

// Load environment variables from parent directory's .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug: Log loaded env vars
logger.info(`Gateway Public Key loaded: ${process.env.GATEWAY_PUBLIC_KEY ? 'YES' : 'NO'}`);
logger.info(`Gateway Private Key loaded: ${process.env.GATEWAY_PRIVATE_KEY ? 'YES' : 'NO'}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/', routes);

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
);

// Initialize and start server
async function start() {
  try {
    // Initialize Redis
    await initRedis();
    logger.info('Redis initialized');

    // Check gateway keys
    if (!process.env.GATEWAY_PRIVATE_KEY || !process.env.GATEWAY_PUBLIC_KEY) {
      logger.warn('Gateway keys not found in environment');
      logger.warn('Generating new keys (set these in .env for production):');
      const keys = generateGatewayKeys();
      logger.warn(`GATEWAY_PRIVATE_KEY=${keys.privateKey}`);
      logger.warn(`GATEWAY_PUBLIC_KEY=${keys.publicKey}`);
      process.env.GATEWAY_PRIVATE_KEY = keys.privateKey;
      process.env.GATEWAY_PUBLIC_KEY = keys.publicKey;
    }

    // Create HTTP server
    const server = http.createServer(app);

    // Setup WebSocket server
    setupWebSocket(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`H3-DAC Gateway listening on port ${PORT}`);
      logger.info(`HTTP: http://localhost:${PORT}`);
      logger.info(`WebSocket: ws://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();
