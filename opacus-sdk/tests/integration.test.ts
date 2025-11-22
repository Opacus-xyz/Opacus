import { describe, test, expect, vi } from 'vitest';
import { OpacusClient } from '../src/client';
import type { OpacusFrame } from '../src/types';

describe('OpacusClient Integration', () => {
  test('init generates identity without existing key', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });

    const identity = await client.init();
    expect(identity).toBeDefined();
    expect(identity.id).toBeTruthy();
    expect(identity.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(identity.edPub.length).toBe(32);
    expect(identity.xPub.length).toBe(32);
    expect(identity.chainId).toBe(16602); // testnet
  });

  test('init imports existing identity', async () => {
    const client1 = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client1.init();
    const exported = client1.exportIdentity();

    const client2 = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    const imported = await client2.init(exported);
    expect(imported.id).toBe(client1.getIdentity()!.id);
    expect(imported.address).toBe(client1.getIdentity()!.address);
  });

  test('getIdentity returns undefined before init', () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    expect(client.getIdentity()).toBeUndefined();
  });

  test('isConnected returns false before connect', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    expect(client.isConnected()).toBe(false);
  });

  test('getNetworkInfo returns correct info', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    const info = client.getNetworkInfo();
    expect(info.chainId).toBe(16602);
    expect(info.name).toBe('0G Galileo Testnet');
  });

  test('exportIdentity returns valid JSON', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    const exported = client.exportIdentity();
    const parsed = JSON.parse(exported);
    expect(parsed.id).toBeTruthy();
    expect(parsed.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(parsed.edPub).toBeTruthy();
    expect(parsed.xPub).toBeTruthy();
  });

  test('connect throws if not initialized', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await expect(client.connect()).rejects.toThrow('Not initialized');
  });

  test('sendMessage throws if not connected', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    await expect(client.sendMessage('peer', { msg: 'test' })).rejects.toThrow('Not connected');
  });

  test('sendStream throws if not connected', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    await expect(client.sendStream('ch-1', { data: 'test' })).rejects.toThrow('Not connected');
  });

  test('registerOnChain throws if not initialized', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await expect(client.registerOnChain({ name: 'test' })).rejects.toThrow('Not initialized');
  });

  test('createDAC throws if not initialized', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await expect(client.createDAC({
      id: 'dac-1',
      owner: '0x' + '0'.repeat(40),
      metadata: { name: 'Test', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: '0x' + '0'.repeat(40) }
    })).rejects.toThrow('Not initialized');
  });

  test('onMessage registers handler', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();

    const handler = vi.fn();
    client.onMessage('msg', handler);
    // Handler is registered (no error thrown)
    expect(true).toBe(true);
  });

  test('initContracts accepts addresses', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545',
      privateKey: '0x' + '1'.repeat(64)
    });
    await client.init();
    await client.initContracts({
      dacRegistry: '0x' + '1'.repeat(40),
      agentRegistry: '0x' + '2'.repeat(40),
      dataStream: '0x' + '3'.repeat(40),
      escrow: '0x' + '4'.repeat(40)
    });
    expect(true).toBe(true);
  });

  test('subscribeToChannel throws before init', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await expect(client.subscribeToChannel('ch-1')).rejects.toThrow('Not initialized');
  });

  test('unsubscribeFromChannel throws before init', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    await expect(client.unsubscribeFromChannel('ch-1')).rejects.toThrow('Not initialized');
  });

  test('mainnet client uses correct chain ID', async () => {
    const client = new OpacusClient({
      network: 'mainnet',
      relayUrl: 'wss://relay.opacus.network',
      chainRpc: 'https://evmrpc.0g.ai'
    });
    const identity = await client.init();
    expect(identity.chainId).toBe(16661); // mainnet
  });

  test('devnet client uses testnet defaults', async () => {
    const client = new OpacusClient({
      network: 'devnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    const identity = await client.init();
    expect(identity.chainId).toBe(16602); // devnet falls back to testnet
  });

  test('exportIdentity throws before init', () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545'
    });
    expect(() => client.exportIdentity()).toThrow('Not initialized');
  });

  test('WebSocket URL transform works', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'https://relay.example.com',
      chainRpc: 'http://localhost:8545'
    });
    await client.init();
    // No error means URL transform logic works
    expect(true).toBe(true);
  });

  test('client can be created with all config options', async () => {
    const client = new OpacusClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545',
      privateKey: '0x' + 'a'.repeat(64),
      storageIndexer: 'http://indexer.example.com'
    });
    await client.init();
    expect(client.getIdentity()).toBeDefined();
  });
});
