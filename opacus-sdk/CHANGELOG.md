# Changelog

## [1.0.2] - 2025-11-21

### Added
- WebSocket server implementation for real-time agent communication
- Complete test infrastructure with automated environment setup
- Comprehensive test suites for authentication, messaging, and WebSocket
- Test configuration generator with secp256k1 key generation
- Quick start scripts for gateway and testing

### Fixed
- Endianness issue in timestamp encoding (Big Endian → Little Endian)
- secp256k1 key generation (was using ed25519)
- Environment variable loading in gateway routes
- Signature verification for authentication flow
- Module imports with .js extensions for ESM compatibility

### Changed
- Gateway keys now loaded at runtime (not module-level)
- Updated dependencies: @noble/secp256k1@^2.3.0, @noble/hashes@^1.5.0
- Improved debug logging for authentication flow
- Enhanced WebSocket support with session-based authentication

## [1.0.1] - 2025-11-20

### Added
- Initial SDK publication to npm as @brienteth/opacus-sdk
- Multi-chain support (0G Chain, EVM chains)
- Agent authentication and session management
- CBOR encoding/decoding for efficient data transfer
- Gateway server for agent coordination

### Changed
- Updated documentation links from opacus.io to opacus.xyz
- Fixed CSS paths for Vercel deployment

## [1.0.0] - 2025-11-19

### Added
- Initial release of Opacus SDK
- Core client implementation
- Cryptographic key management
- Transport layer (WebSocket, WebTransport)
- Chain adapters for 0G Chain
- DAC (Decentralized Agent Communication) manager
