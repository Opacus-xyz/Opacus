import { describe, test, expect, beforeEach, vi } from 'vitest';
import { DACManager } from '../src/dac/manager';
import { OGChainClient } from '../src/chain/0g';
import { SecurityManager } from '../src/crypto/security';
import { KeyManager } from '../src/crypto/keys';
import type { DACConfig, DataChannel, AgentIdentity } from '../src/types';

describe('DACManager', () => {
  let manager: DACManager;
  let mockChainClient: OGChainClient;
  let security: SecurityManager;
  let identity: AgentIdentity;

  beforeEach(async () => {
    mockChainClient = {
      registerDAC: vi.fn().mockResolvedValue('0x123'),
      openDataChannel: vi.fn().mockResolvedValue('0x456'),
    } as any;
    security = new SecurityManager();
    manager = new DACManager(mockChainClient, security);
    identity = await KeyManager.generateFullIdentity();
  });

  test('createDAC registers and stores DAC', async () => {
    const config: DACConfig = {
      id: 'dac-001',
      owner: identity.address,
      metadata: {
        name: 'Test DAC',
        description: 'Test',
        version: '1.0.0',
        tags: ['test']
      },
      permissions: [],
      dataChannels: [
        {
          id: 'channel-1',
          type: 'output',
          schema: {},
          pricing: {
            perByte: 100n,
            perMessage: 1000n
          }
        }
      ],
      revenueModel: {
        type: 'pay-per-use',
        fee: 1000n,
        treasury: identity.address
      }
    };

    const txHash = await manager.createDAC(config);
    expect(txHash).toBe('0x123');
    
    const stored = manager.getDAC('dac-001');
    expect(stored).toEqual(config);
    expect(mockChainClient.registerDAC).toHaveBeenCalledWith(config);
  });

  test('getDAC returns undefined for non-existent DAC', () => {
    const result = manager.getDAC('non-existent');
    expect(result).toBeUndefined();
  });

  test('getAllDACs returns all registered DACs', async () => {
    const dac1: DACConfig = {
      id: 'dac-1',
      owner: identity.address,
      metadata: { name: 'DAC 1', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };
    const dac2: DACConfig = {
      id: 'dac-2',
      owner: identity.address,
      metadata: { name: 'DAC 2', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac1);
    await manager.createDAC(dac2);

    const all = manager.getAllDACs();
    expect(all).toHaveLength(2);
    expect(all.map(d => d.id)).toContain('dac-1');
    expect(all.map(d => d.id)).toContain('dac-2');
  });

  test('subscribe adds subscriber to channel', async () => {
    const channel: DataChannel = {
      id: 'ch-1',
      type: 'output',
      schema: {},
      pricing: { perByte: 1n, perMessage: 1n }
    };
    const dac: DACConfig = {
      id: 'dac-sub',
      owner: identity.address,
      metadata: { name: 'Sub DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    const result = await manager.subscribe('ch-1', 'subscriber-1');
    expect(result).toBe(true);
    expect(manager.isSubscribed('ch-1', 'subscriber-1')).toBe(true);
  });

  test('subscribe returns false for non-existent channel', async () => {
    const result = await manager.subscribe('non-existent', 'sub-1');
    expect(result).toBe(false);
  });

  test('unsubscribe removes subscriber', async () => {
    const channel: DataChannel = {
      id: 'ch-unsub',
      type: 'output',
      schema: {},
      pricing: { perByte: 1n, perMessage: 1n }
    };
    const dac: DACConfig = {
      id: 'dac-unsub',
      owner: identity.address,
      metadata: { name: 'Unsub DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    await manager.subscribe('ch-unsub', 'sub-1');
    expect(manager.isSubscribed('ch-unsub', 'sub-1')).toBe(true);
    
    const result = await manager.unsubscribe('ch-unsub', 'sub-1');
    expect(result).toBe(true);
    expect(manager.isSubscribed('ch-unsub', 'sub-1')).toBe(false);
  });

  test('getSubscribers returns all channel subscribers', async () => {
    const channel: DataChannel = {
      id: 'ch-multi',
      type: 'output',
      schema: {},
      pricing: { perByte: 1n, perMessage: 1n }
    };
    const dac: DACConfig = {
      id: 'dac-multi',
      owner: identity.address,
      metadata: { name: 'Multi DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    await manager.subscribe('ch-multi', 'sub-1');
    await manager.subscribe('ch-multi', 'sub-2');
    await manager.subscribe('ch-multi', 'sub-3');

    const subs = manager.getSubscribers('ch-multi');
    expect(subs).toHaveLength(3);
    expect(subs).toContain('sub-1');
    expect(subs).toContain('sub-2');
    expect(subs).toContain('sub-3');
  });

  test('calculateCost computes correct fees', async () => {
    const channel: DataChannel = {
      id: 'ch-cost',
      type: 'output',
      schema: {},
      pricing: { perByte: 100n, perMessage: 1000n }
    };
    const dac: DACConfig = {
      id: 'dac-cost',
      owner: identity.address,
      metadata: { name: 'Cost DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    const cost = manager.calculateCost('ch-cost', 100, 5);
    expect(cost).toBe(100n * 100n + 1000n * 5n); // 10000 + 5000 = 15000
  });

  test('calculateCost returns 0 for non-existent channel', () => {
    const cost = manager.calculateCost('non-existent', 100, 10);
    expect(cost).toBe(0n);
  });

  test('getChannel returns channel details', async () => {
    const channel: DataChannel = {
      id: 'ch-get',
      type: 'bidirectional',
      schema: { field: 'string' },
      pricing: { perByte: 50n, perMessage: 500n }
    };
    const dac: DACConfig = {
      id: 'dac-get',
      owner: identity.address,
      metadata: { name: 'Get DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    const retrieved = manager.getChannel('ch-get');
    expect(retrieved).toEqual(channel);
  });

  test('getAllChannels returns all channels', async () => {
    const dac: DACConfig = {
      id: 'dac-all-ch',
      owner: identity.address,
      metadata: { name: 'All Channels DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [
        { id: 'ch-1', type: 'input', schema: {}, pricing: { perByte: 1n, perMessage: 1n } },
        { id: 'ch-2', type: 'output', schema: {}, pricing: { perByte: 1n, perMessage: 1n } }
      ],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    const channels = manager.getAllChannels();
    expect(channels).toHaveLength(2);
    expect(channels.map(c => c.id)).toContain('ch-1');
    expect(channels.map(c => c.id)).toContain('ch-2');
  });

  test('broadcastToChannel sends to all subscribers', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const channel: DataChannel = {
      id: 'ch-broadcast',
      type: 'output',
      schema: {},
      pricing: { perByte: 1n, perMessage: 1n }
    };
    const dac: DACConfig = {
      id: 'dac-broadcast',
      owner: identity.address,
      metadata: { name: 'Broadcast DAC', description: '', version: '1.0.0', tags: [] },
      permissions: [],
      dataChannels: [channel],
      revenueModel: { type: 'pay-per-use', fee: 0n, treasury: identity.address }
    };

    await manager.createDAC(dac);
    await manager.subscribe('ch-broadcast', 'sub-1');
    await manager.subscribe('ch-broadcast', 'sub-2');

    const sent = await manager.broadcastToChannel('ch-broadcast', identity, { msg: 'test' }, sendFn);
    expect(sent).toBe(2);
    expect(sendFn).toHaveBeenCalledTimes(2);
  });
});
