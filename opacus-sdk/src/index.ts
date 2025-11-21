/**
 * Opacus SDK - Main Exports
 */

// Types
export * from './types.js';

// Main Client
export { OpacusClient } from './client.js';

// Crypto
export { KeyManager } from './crypto/keys.js';
export { SecurityManager } from './crypto/security.js';

// Protocol
export { CBORCodec } from './proto/cbor.js';

// Transport
export { ITransport, BaseTransport } from './transport/base.js';
export { WebSocketTransport } from './transport/websocket.js';
export { WebTransportTransport } from './transport/webtransport.js';

// Chain
export { OGChainClient, OG_NETWORKS } from './chain/0g.js';
export { EVMChainAdapter, MultiChainManager } from './chain/multichain.js';
export type { ChainAdapter } from './chain/multichain.js';

// DAC
export { DACManager } from './dac/manager.js';
