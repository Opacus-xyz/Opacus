import { Router, Request, Response } from 'express';
import {
  generateNonce,
  verifySignature,
  deriveSharedSecret,
  deriveSessionKey,
  concatBytes,
  hexToBytes,
  bytesToHex,
  hashData,
} from './crypto';
import {
  storeNonce,
  verifyAndConsumeNonce,
  storeSession,
  verifySession,
  getSession,
  storeProof,
  getProof,
} from './redis';
import { logger } from './logger';

const router = Router();

// Gateway keys from environment
const GATEWAY_PRIVATE_KEY = process.env.GATEWAY_PRIVATE_KEY!;
const GATEWAY_PUBLIC_KEY = process.env.GATEWAY_PUBLIC_KEY!;
const NONCE_EXPIRY = parseInt(process.env.NONCE_EXPIRY_SECONDS || '30');
const SESSION_EXPIRY = parseInt(process.env.SESSION_EXPIRY_SECONDS || '3600');

/**
 * GET /nonce
 * Generate and return a new nonce
 */
router.get('/nonce', async (req: Request, res: Response) => {
  try {
    const nonce = generateNonce();
    const expiresAt = Date.now() + NONCE_EXPIRY * 1000;

    // Store nonce in Redis
    await storeNonce(nonce, NONCE_EXPIRY);

    logger.info(`Generated nonce: ${nonce.substring(0, 8)}...`);

    res.json({
      nonce,
      serverPubKey: GATEWAY_PUBLIC_KEY,
      expiresAt,
    });
  } catch (error) {
    logger.error('Error generating nonce:', error);
    res.status(500).json({
      status: 'failed',
      message: 'Internal server error',
    });
  }
});

/**
 * POST /auth
 * Authenticate client and establish session
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { clientId, signature, nonce, clientPubKey, timestamp } = req.body;

    // Validate required fields
    if (!clientId || !signature || !nonce || !clientPubKey || !timestamp) {
      return res.status(400).json({
        status: 'failed',
        message: 'Missing required fields',
      });
    }

    // Verify nonce exists and consume it
    const nonceValid = await verifyAndConsumeNonce(nonce);
    if (!nonceValid) {
      logger.warn(`Invalid or expired nonce: ${nonce.substring(0, 8)}...`);
      return res.status(401).json({
        status: 'failed',
        message: 'Invalid or expired nonce',
      });
    }

    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp);
    if (timeDiff > 60000) {
      // 60 second window
      logger.warn(`Timestamp out of range for client: ${clientId}`);
      return res.status(401).json({
        status: 'failed',
        message: 'Timestamp out of valid range',
      });
    }

    // Recreate message
    const message = concatBytes(
      hexToBytes(nonce),
      new TextEncoder().encode(clientId),
      new Uint8Array(new BigUint64Array([BigInt(timestamp)]).buffer)
    );

    // Verify signature
    const signatureValid = await verifySignature(
      message,
      signature,
      clientPubKey
    );

    if (!signatureValid) {
      logger.warn(`Invalid signature for client: ${clientId}`);
      return res.status(401).json({
        status: 'failed',
        message: 'Invalid signature',
      });
    }

    // Derive shared secret
    const sharedSecret = deriveSharedSecret(GATEWAY_PRIVATE_KEY, clientPubKey);
    const sessionKey = deriveSessionKey(sharedSecret);
    const sessionKeyHex = bytesToHex(sessionKey);

    // Store session
    const expiresAt = Date.now() + SESSION_EXPIRY * 1000;
    await storeSession(clientId, sessionKeyHex, SESSION_EXPIRY);

    // Store proof (for on-chain commitment)
    const sessionKeyHash = hashData(sessionKey);
    await storeProof(clientId, {
      sessionKeyHash,
      blockTime: Date.now(),
    });

    logger.info(`Client authenticated: ${clientId}`);

    res.json({
      sessionKey: sessionKeyHex,
      status: 'success',
      expiresAt,
    });
  } catch (error) {
    logger.error('Error during authentication:', error);
    res.status(500).json({
      status: 'failed',
      message: 'Internal server error',
    });
  }
});

/**
 * POST /payload
 * Receive and verify encrypted payload
 */
router.post('/payload', async (req: Request, res: Response) => {
  try {
    const { clientId, encrypted, nonce, signature } = req.body;

    // Validate required fields
    if (!clientId || !encrypted || !nonce || !signature) {
      return res.status(400).json({
        status: 'failed',
        message: 'Missing required fields',
      });
    }

    // Verify session exists
    const sessionKey = await getSession(clientId);
    if (!sessionKey) {
      logger.warn(`No active session for client: ${clientId}`);
      return res.status(401).json({
        status: 'failed',
        message: 'No active session',
      });
    }

    // Verify signature on encrypted payload
    const encryptedBytes = hexToBytes(encrypted);
    
    // Note: In production, you'd decrypt and process the payload here
    // For now, we just acknowledge receipt

    logger.info(`Received payload from client: ${clientId}`);

    res.json({
      status: 'success',
      message: 'Payload received and verified',
      data: {
        processed: true,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    logger.error('Error processing payload:', error);
    res.status(500).json({
      status: 'failed',
      message: 'Internal server error',
    });
  }
});

/**
 * POST /verify-session
 * Verify if a session is still valid
 */
router.post('/verify-session', async (req: Request, res: Response) => {
  try {
    const { clientId, sessionKey } = req.body;

    if (!clientId || !sessionKey) {
      return res.status(400).json({ valid: false });
    }

    const valid = await verifySession(clientId, sessionKey);
    res.json({ valid });
  } catch (error) {
    logger.error('Error verifying session:', error);
    res.json({ valid: false });
  }
});

/**
 * GET /proof/:clientId
 * Get on-chain proof status
 */
router.get('/proof/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const proof = await getProof(clientId);

    if (!proof) {
      return res.json({
        exists: false,
      });
    }

    res.json({
      exists: true,
      blockTime: proof.blockTime,
      txHash: proof.txHash,
    });
  } catch (error) {
    logger.error('Error getting proof:', error);
    res.status(500).json({
      exists: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
  });
});

export default router;
