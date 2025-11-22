import { describe, test, expect } from 'vitest';
import { OpacusClient } from '../src';

// Basic smoke test to ensure client initializes identity

describe('OpacusClient smoke', () => {
  test('init creates identity with address', async () => {
    const client = new OpacusClient({
      network: 'devnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545',
      privateKey: '0x' + '1'.repeat(64)
    });
    const identity = await client.init();
    expect(identity).toBeDefined();
    expect(identity.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    // Network info should be accessible
    const netInfo = client.getNetworkInfo();
    expect(netInfo).toBeDefined();
  });
});
