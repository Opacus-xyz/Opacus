import axios, { AxiosInstance } from 'axios';

export interface NonceResponse {
  nonce: string;
  serverPubKey: string;
  expiresAt: number;
}

export interface AuthRequest {
  clientId: string;
  signature: string;
  nonce: string;
  clientPubKey: string;
  timestamp: number;
}

export interface AuthResponse {
  sessionKey: string;
  status: 'success' | 'failed';
  message?: string;
  expiresAt: number;
}

export interface PayloadRequest {
  clientId: string;
  encrypted: string;
  nonce: string;
  signature: string;
}

export interface PayloadResponse {
  status: 'success' | 'failed';
  message?: string;
  data?: any;
}

export class HttpClient {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch a new nonce from the gateway
   */
  async fetchNonce(): Promise<NonceResponse> {
    const response = await this.client.get<NonceResponse>('/nonce');
    return response.data;
  }

  /**
   * Authenticate with the gateway
   */
  async authenticate(authData: AuthRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth', authData);
    return response.data;
  }

  /**
   * Send encrypted payload to the gateway
   */
  async sendPayload(payloadData: PayloadRequest): Promise<PayloadResponse> {
    const response = await this.client.post<PayloadResponse>(
      '/payload',
      payloadData
    );
    return response.data;
  }

  /**
   * Verify session is still valid
   */
  async verifySession(clientId: string, sessionKey: string): Promise<boolean> {
    try {
      const response = await this.client.post<{ valid: boolean }>(
        '/verify-session',
        {
          clientId,
          sessionKey,
        }
      );
      return response.data.valid;
    } catch {
      return false;
    }
  }

  /**
   * Get on-chain proof status
   */
  async getProofStatus(clientId: string): Promise<{
    exists: boolean;
    blockTime?: number;
    txHash?: string;
  }> {
    const response = await this.client.get(`/proof/${clientId}`);
    return response.data;
  }
}
