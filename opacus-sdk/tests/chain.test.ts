import { describe, test, expect, beforeEach } from 'vitest';
import { OGChainClient, OG_NETWORKS } from '../src/chain/0g';

describe('OGChainClient', () => {
  let client: OGChainClient;

  beforeEach(() => {
    client = new OGChainClient({
      network: 'testnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: 'http://localhost:8545',
      privateKey: '0x' + '1'.repeat(64)
    });
  });

  test('constructor initializes with testnet config', () => {
    const info = client.getNetworkInfo();
    expect(info.chainId).toBe(16602);
    expect(info.name).toBe('0G Galileo Testnet');
    expect(info.rpc).toBeTruthy();
  });

  test('mainnet network info is correct', () => {
    const mainnetClient = new OGChainClient({
      network: 'mainnet',
      relayUrl: 'ws://localhost:8080',
      chainRpc: OG_NETWORKS.mainnet.rpc
    });
    const info = mainnetClient.getNetworkInfo();
    expect(info.chainId).toBe(16661);
    expect(info.name).toBe('0G Mainnet');
  });

  test('OG_NETWORKS contains mainnet and testnet', () => {
    expect(OG_NETWORKS.mainnet).toBeDefined();
    expect(OG_NETWORKS.testnet).toBeDefined();
    expect(OG_NETWORKS.mainnet.chainId).toBe(16661);
    expect(OG_NETWORKS.testnet.chainId).toBe(16602);
  });

  test('getNetworkInfo returns correct structure', () => {
    const info = client.getNetworkInfo();
    expect(info).toHaveProperty('chainId');
    expect(info).toHaveProperty('name');
    expect(info).toHaveProperty('rpc');
    expect(info).toHaveProperty('explorer');
    expect(info).toHaveProperty('contracts');
  });

  test('throws on contract calls before initContracts', async () => {
    await expect(
      client.registerAgent({
        id: 'test',
        edPub: new Uint8Array(32),
        edPriv: new Uint8Array(32),
        xPub: new Uint8Array(32),
        xPriv: new Uint8Array(32),
        address: '0x' + '0'.repeat(40),
        chainId: 16602
      }, '{}')
    ).rejects.toThrow('Not initialized');
  });

  test('initContracts accepts contract addresses', async () => {
    const addresses = {
      dacRegistry: '0x' + '1'.repeat(40),
      agentRegistry: '0x' + '2'.repeat(40),
      dataStream: '0x' + '3'.repeat(40),
      escrow: '0x' + '4'.repeat(40)
    };
    await client.initContracts(addresses);
    // No error means success
    expect(true).toBe(true);
  });
});
