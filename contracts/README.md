# Opacus Smart Contracts

**Decentralized Access Control & Data Distribution Protocol**

Opacus provides a complete smart contract suite for managing Data Access Consortiums (DACs), agent identity, data streaming channels, and micropayments on 0G Chain.

## 🏗️ Architecture

```
OpacusCore (Central Coordinator)
    ├── DACRegistry     → DAC registration & management
    ├── AgentRegistry   → Agent identity & key management
    ├── DataStream      → Channel subscriptions & usage accounting
    └── MsgEscrow       → ERC20 micropayment escrow
```

## 📦 Deployed Contracts

### 0G Mainnet (Chain ID: 16661)
**Network:** `https://evmrpc.0g.ai`  
**Explorer:** `https://chainscan.0g.ai`

| Contract | Address | Purpose |
|----------|---------|---------|
| DACRegistry | [`0xF7B07181995E9B4e2C0812c035868116B04fe5c8`](https://chainscan.0g.ai/address/0xF7B07181995E9B4e2C0812c035868116B04fe5c8) | DAC registration with stake requirements |
| AgentRegistry | [`0xF591b1ea9AD222F3e305bB114A9AdB3b9B1A8739`](https://chainscan.0g.ai/address/0xF591b1ea9AD222F3e305bB114A9AdB3b9B1A8739) | Agent identity & key rotation |
| DataStream | [`0xe8bbCd7477a1bDb2252154F86848931C874B0fdc`](https://chainscan.0g.ai/address/0xe8bbCd7477a1bDb2252154F86848931C874B0fdc) | Channel creation & subscriptions |
| MsgEscrow | [`0xA546ef76c4Faf4E5E6049Fa4d05cb4cfe5a226b0`](https://chainscan.0g.ai/address/0xA546ef76c4Faf4E5E6049Fa4d05cb4cfe5a226b0) | Micropayment escrow system |
| OpacusCore | [`0xBe3487dDb5E7B7fFc17a1A3E44c6A109320e7400`](https://chainscan.0g.ai/address/0xBe3487dDb5E7B7fFc17a1A3E44c6A109320e7400) | Central coordinator |

**Deployed:** Dec 19, 2024  
**Deployer:** `0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e`

### 0G Testnet (Chain ID: 16602)
**Network:** `https://evmrpc-testnet.0g.ai`  
**Explorer:** `https://chainscan-galileo.0g.ai`

*Testnet deployments available on request*

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your private key (without 0x prefix)
```

```env
PRIVATE_KEY=your_private_key_here
VERIFY=false
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Run Tests

```bash
# Unit tests
npm test

# Integration tests
npm run integration
```

### 5. Deploy

```bash
# Deploy to 0G Testnet
npm run deploy:testnet

# Deploy to 0G Mainnet
npm run deploy:0g

# Deploy with verification
VERIFY=true npm run deploy:mainnet
```

## 📝 Contract Overview

### DACRegistry
- Register Data Access Consortiums with metadata
- Stake requirement: 0.01 0G
- Owner can grant/revoke data access permissions
- Support for DAC deactivation and stake withdrawal

### AgentRegistry
- Register agents with Ed25519/X25519 public key hashes
- Stake requirement: 0.001 0G
- Key rotation with 7-day cooldown
- Agent verification for secure identity

### DataStream
- Create data channels with pricing (per-byte, per-message)
- Subscription deposits and usage accounting
- Automatic revenue settlement
- Channel activation/deactivation

### MsgEscrow
- ERC20-based micropayment escrow
- Authorized relayer system for settlement
- Lock/unlock mechanisms for secure payments
- Support for partial settlements

### OpacusCore
- Centralized coordinator linking all registries
- Upgradeable architecture
- Emergency pause functionality
- Cross-contract state verification

## 🔐 Security Features

- ✅ **ReentrancyGuard** on all state-changing functions
- ✅ **Stake requirements** for DACs and agents
- ✅ **Key rotation cooldown** (7 days) to prevent abuse
- ✅ **Authorized relayers** for escrow settlements
- ✅ **Ownable** contracts with proper access control
- ✅ **OpenZeppelin 5.0** battle-tested libraries

## 📊 Gas Costs (Estimated)

| Operation | Gas Cost | 0G Cost (~$0.0001/gas) |
|-----------|----------|------------------------|
| Register DAC | ~150,000 | $0.015 |
| Register Agent | ~120,000 | $0.012 |
| Create Channel | ~100,000 | $0.010 |
| Subscribe | ~80,000 | $0.008 |
| Record Usage | ~50,000 | $0.005 |
| Settle Revenue | ~70,000 | $0.007 |

## 🛠️ Development

### Project Structure

```
contracts/
├── contracts/
│   ├── DACRegistry.sol       # DAC management
│   ├── AgentRegistry.sol     # Agent identity
│   ├── DataStream.sol        # Data channels
│   ├── MsgEscrow.sol         # Micropayments
│   ├── OpacusCore.sol        # Coordinator
│   └── MockERC20.sol         # Test token
├── scripts/
│   ├── deploy.ts             # Deployment script
│   └── test-integration.ts   # Integration tests
├── test/                     # Unit tests
├── addresses.json            # Current deployment
├── deployments/              # Historical deployments
└── hardhat.config.ts         # Hardhat configuration
```

### Available Scripts

```bash
# Compile contracts
npm run compile

# Run unit tests
npm test

# Run integration tests
npm run integration

# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet

# Verify contracts
npm run verify
```

## 🔗 Integration

### Using with TypeScript SDK

```typescript
import { ethers } from "ethers";
import { OpacusCore__factory } from "./typechain-types";

const provider = new ethers.JsonRpcProvider("https://evmrpc.0g.ai");
const core = OpacusCore__factory.connect(
  "0xBe3487dDb5E7B7fFc17a1A3E44c6A109320e7400",
  provider
);

// Get contract addresses
const dacRegistryAddr = await core.dacRegistry();
const agentRegistryAddr = await core.agentRegistry();
```

### Using with Rust SDK

```rust
use ethers::prelude::*;

const OPACUS_CORE: &str = "0xBe3487dDb5E7B7fFc17a1A3E44c6A109320e7400";
const RPC_URL: &str = "https://evmrpc.0g.ai";

let provider = Provider::<Http>::try_from(RPC_URL)?;
let core = OpacusCore::new(OPACUS_CORE.parse()?, provider.into());
```

## 📚 Resources

- **0G Chain Docs:** https://docs.0g.ai
- **0G Explorer:** https://chainscan.0g.ai
- **Opacus TypeScript SDK:** `../sdk-ts`
- **Opacus Rust SDK:** `../opacus-rust`

## 📄 License

MIT License - see LICENSE for details

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

## ⚠️ Disclaimer

These smart contracts are provided as-is. Audit before production use.

---

**Built with ❤️ for the 0G Chain ecosystem**
