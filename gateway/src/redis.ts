import { createClient } from 'redis';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

let redisClient: ReturnType<typeof createClient>;

export async function initRedis() {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  redisClient.on('connect', () => logger.info('Redis connected'));

  await redisClient.connect();
  return redisClient;
}

export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Store nonce with expiry
 */
export async function storeNonce(
  nonce: string,
  expirySeconds: number = 30
): Promise<void> {
  const client = getRedisClient();
  await client.set(`nonce:${nonce}`, '1', { EX: expirySeconds });
}

/**
 * Verify and consume nonce (one-time use)
 */
export async function verifyAndConsumeNonce(nonce: string): Promise<boolean> {
  const client = getRedisClient();
  const exists = await client.get(`nonce:${nonce}`);
  
  if (exists) {
    // Delete immediately to ensure one-time use
    await client.del(`nonce:${nonce}`);
    return true;
  }
  
  return false;
}

/**
 * Store session key
 */
export async function storeSession(
  clientId: string,
  sessionKey: string,
  expirySeconds: number = 3600
): Promise<void> {
  const client = getRedisClient();
  await client.set(`session:${clientId}`, sessionKey, { EX: expirySeconds });
}

/**
 * Verify session key
 */
export async function verifySession(
  clientId: string,
  sessionKey: string
): Promise<boolean> {
  const client = getRedisClient();
  const storedKey = await client.get(`session:${clientId}`);
  return storedKey === sessionKey;
}

/**
 * Get session key
 */
export async function getSession(clientId: string): Promise<string | null> {
  const client = getRedisClient();
  return await client.get(`session:${clientId}`);
}

/**
 * Delete session
 */
export async function deleteSession(clientId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`session:${clientId}`);
}

/**
 * Store proof hash
 */
export async function storeProof(
  clientId: string,
  proofData: {
    sessionKeyHash: string;
    blockTime: number;
    txHash?: string;
  }
): Promise<void> {
  const client = getRedisClient();
  await client.set(
    `proof:${clientId}`,
    JSON.stringify(proofData),
    { EX: 86400 } // 24 hours
  );
}

/**
 * Get proof data
 */
export async function getProof(clientId: string): Promise<{
  sessionKeyHash: string;
  blockTime: number;
  txHash?: string;
} | null> {
  const client = getRedisClient();
  const data = await client.get(`proof:${clientId}`);
  return data ? JSON.parse(data) : null;
}
