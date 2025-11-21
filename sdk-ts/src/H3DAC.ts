import {
  generatePrivateKey,
  getPublicKey,
  signMessage,
  deriveSharedSecret,
  deriveSessionKey,
  encryptPayload,
  decryptPayload,
  concatBytes,
  hexToBytes,
  bytesToHex,
} from './crypto';
import { HttpClient } from './http';

export interface H3DACConfig {
  gatewayUrl?: string;
  privateKey?: Uint8Array;
}

export interface AuthSession {
  sessionKey: Uint8Array;
  clientId: string;
  expiresAt: number;
}

export class H3DAC {
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private httpClient: HttpClient;
  private session?: AuthSession;

  constructor(config: H3DACConfig = {}) {
    this.privateKey = config.privateKey || generatePrivateKey();
    this.publicKey = getPublicKey(this.privateKey);
    this.httpClient = new HttpClient(config.gatewayUrl);
  }

  /**
   * Initialize with existing private key
   */
  static fromPrivateKey(privateKey: string, gatewayUrl?: string): H3DAC {
    return new H3DAC({
      privateKey: hexToBytes(privateKey),
      gatewayUrl,
    });
  }

  /**
   * Get the client's public key
   */
  getPublicKey(): string {
    return bytesToHex(this.publicKey);
  }

  /**
   * Get the client's private key (use with caution)
   */
  getPrivateKey(): string {
    return bytesToHex(this.privateKey);
  }

  /**
   * Authenticate with the gateway and establish a session
   */
  async authenticate(clientId: string): Promise<AuthSession> {
    // Step 1: Fetch nonce from gateway
    const { nonce, serverPubKey, expiresAt } =
      await this.httpClient.fetchNonce();

    // Step 2: Create signature
    const timestamp = Date.now();
    const message = concatBytes(
      hexToBytes(nonce),
      new TextEncoder().encode(clientId),
      new Uint8Array(new BigUint64Array([BigInt(timestamp)]).buffer)
    );

    const signature = await signMessage(message, this.privateKey);

    // Step 3: Derive shared secret
    const serverPubKeyBytes = hexToBytes(serverPubKey);
    const sharedSecret = deriveSharedSecret(this.privateKey, serverPubKeyBytes);
    const sessionKey = deriveSessionKey(sharedSecret);

    // Step 4: Send authentication request
    const authResponse = await this.httpClient.authenticate({
      clientId,
      signature: bytesToHex(signature),
      nonce,
      clientPubKey: this.getPublicKey(),
      timestamp,
    });

    if (authResponse.status !== 'success') {
      throw new Error(
        `Authentication failed: ${authResponse.message || 'Unknown error'}`
      );
    }

    // Store session
    this.session = {
      sessionKey,
      clientId,
      expiresAt: authResponse.expiresAt,
    };

    return this.session;
  }

  /**
   * Send encrypted payload to the gateway
   */
  async sendPayload(payload: any): Promise<any> {
    if (!this.session) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    // Check if session is expired
    if (Date.now() > this.session.expiresAt) {
      throw new Error('Session expired. Re-authenticate required.');
    }

    // Encrypt payload
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const { encrypted, nonce } = encryptPayload(
      payloadBytes,
      this.session.sessionKey
    );

    // Create signature for the encrypted payload
    const signature = await signMessage(encrypted, this.privateKey);

    // Send to gateway
    const response = await this.httpClient.sendPayload({
      clientId: this.session.clientId,
      encrypted: bytesToHex(encrypted),
      nonce: bytesToHex(nonce),
      signature: bytesToHex(signature),
    });

    if (response.status !== 'success') {
      throw new Error(
        `Payload send failed: ${response.message || 'Unknown error'}`
      );
    }

    return response.data;
  }

  /**
   * Verify if the session is still valid
   */
  async verifySession(): Promise<boolean> {
    if (!this.session) return false;

    if (Date.now() > this.session.expiresAt) {
      this.session = undefined;
      return false;
    }

    return this.httpClient.verifySession(
      this.session.clientId,
      bytesToHex(this.session.sessionKey)
    );
  }

  /**
   * Get on-chain proof status
   */
  async getProofStatus(): Promise<{
    exists: boolean;
    blockTime?: number;
    txHash?: string;
  }> {
    if (!this.session) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    return this.httpClient.getProofStatus(this.session.clientId);
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    this.session = undefined;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return (
      !!this.session &&
      Date.now() < this.session.expiresAt
    );
  }
}
