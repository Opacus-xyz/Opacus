# Protocol Fee Implementation

## 📊 Overview

Opacus protokolüne **%2 protocol fee** sistemi entegre edildi. Tüm işlemlerden otomatik olarak protokol hazinesine gelir akışı sağlanıyor.

## 💰 Fee Yapısı

### 1. **Message Escrow Fee** (%2)
- **Contract:** `MsgEscrow.sol`
- **Kesinti Noktası:** Mesaj release edilirken
- **Hesaplama:** `protocolFee = amount × 200 / 10000 = amount × 2%`
- **Akış:**
  ```
  Total Amount (100%)
  ├── Protocol Fee (2%) → Protocol Treasury
  └── Payee Amount (98%) → Message Receiver
  ```

### 2. **Data Stream Fee** (%2)
- **Contract:** `DataStream.sol`
- **Kesinti Noktası:** Channel settlement sırasında
- **Hesaplama:** `platformFee = total × 2 / 100`
- **Akış:**
  ```
  Channel Revenue (100%)
  ├── Protocol Fee (2%) → Protocol Treasury
  └── Channel Owner (98%) → Data Provider
  ```

### 3. **DAC Registration Fee** (0.002 ETH)
- **Contract:** `DACRegistry.sol`
- **Kesinti Noktası:** DAC kaydı sırasında
- **Sabit Ücret:** 0.002 ETH (~20% of typical 0.01 ETH stake)
- **Akış:**
  ```
  Registration Payment
  ├── Protocol Fee (0.002 ETH) → Protocol Treasury
  └── Stake (0.008+ ETH) → DAC Owner's Stake
  ```

## 🏦 Treasury Adresi

```solidity
address public protocolTreasury = 0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e
```

Bu adres deploy sırasında `PROTOCOL_TREASURY` environment variable ile değiştirilebilir.

## 📈 Gelir Projeksiyonu

### Senario 1: Moderate Usage (İlk 6 Ay)
```
Daily Metrics:
- Messages: 1,000/day × $0.001 × 2% = $0.02/day
- Data Streams: 100 settlements/day × $10 × 2% = $20/day
- DAC Registrations: 3/day × 0.002 ETH × $3000 = $18/day

Monthly Revenue: ~$1,140/month
```

### Senario 2: High Growth (1 Yıl Sonra)
```
Daily Metrics:
- Messages: 100,000/day × $0.001 × 2% = $2/day
- Data Streams: 1,000 settlements/day × $10 × 2% = $200/day
- DAC Registrations: 10/day × 0.002 ETH × $3000 = $60/day

Monthly Revenue: ~$7,860/month → ~$94K/year
```

### Senario 3: Enterprise Scale (3 Yıl)
```
Daily Metrics:
- Messages: 1M/day × $0.001 × 2% = $20/day
- Data Streams: 10,000 settlements/day × $10 × 2% = $2,000/day
- DAC Registrations: 50/day × 0.002 ETH × $3000 = $300/day

Monthly Revenue: ~$69,600/month → ~$835K/year
```

## 🔧 Smart Contract Changes

### MsgEscrow.sol
```solidity
// Added variables
address public protocolTreasury;
uint256 public protocolFeePercentage = 200; // 2% in basis points

// Modified release function
function release(bytes32 lockId) external {
    uint256 protocolFee = (l.amount * protocolFeePercentage) / 10000;
    uint256 payeeAmount = l.amount - protocolFee;
    
    paymentToken.transfer(protocolTreasury, protocolFee); // Protocol geliri
    paymentToken.transfer(l.payee, payeeAmount);
}
```

### DataStream.sol
```solidity
// Added variables
address public protocolTreasury;
uint256 public platformFeePercent = 2; // 2%

// Modified settle function
function settle(bytes32 channelId) external {
    uint256 platformFee = (total * platformFeePercent) / 100;
    uint256 ownerAmount = total - platformFee;
    
    payable(ch.owner).transfer(ownerAmount);
    payable(protocolTreasury).transfer(platformFee); // Protocol geliri
}
```

### DACRegistry.sol
```solidity
// Added variables
address public protocolTreasury;
uint256 public registrationFee = 0.002 ether;

// Modified registerDAC function
function registerDAC(string calldata metadataURI) external payable {
    require(msg.value >= minStake + registrationFee);
    
    payable(protocolTreasury).transfer(registrationFee); // Protocol geliri
    
    dacs[dacId] = DAC({
        stake: msg.value - registrationFee
    });
}
```

## 🛠️ Admin Functions

Her kontrat owner (deployer) aşağıdaki fonksiyonlarla fee'leri yönetebilir:

### MsgEscrow
```solidity
function setProtocolTreasury(address _treasury) external onlyOwner
function setProtocolFeePercentage(uint256 _percentage) external onlyOwner
// Max: 10% (1000 basis points)
```

### DataStream
```solidity
function setProtocolTreasury(address _treasury) external onlyOwner
function setPlatformFeePercent(uint256 _percent) external onlyOwner
// Max: 10%
```

### DACRegistry
```solidity
function setProtocolTreasury(address _treasury) external onlyOwner
function setRegistrationFee(uint256 _fee) external onlyOwner
```

## 🚀 Deployment

### Environment Variables
```bash
export PROTOCOL_TREASURY=0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e
export PAYMENT_TOKEN=0x... # ERC20 token for payments
```

### Deploy Command
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network 0g-testnet
```

### Deploy Output
```json
{
  "network": 16661,
  "deployer": "0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e",
  "protocolTreasury": "0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e",
  "protocolFee": "2%",
  "contracts": {
    "DACRegistry": "0x...",
    "DataStream": "0x...",
    "MsgEscrow": "0x..."
  }
}
```

## 📊 Revenue Tracking

### On-Chain Events
```solidity
// MsgEscrow
event Released(bytes32 indexed lockId, address relayer);
// Check: protocolFee transferred to treasury

// DataStream
event Settled(bytes32 indexed channelId, uint256 amount);
// Check: platformFee transferred to treasury

// DACRegistry
event DACRegistered(bytes32 indexed dacId, address owner, string metadataURI);
// Check: registrationFee transferred to treasury
```

### Dashboard Queries
```typescript
// Total protocol revenue from MsgEscrow
const releases = await msgEscrow.queryFilter(msgEscrow.filters.Released());
const totalMsgFees = releases.reduce((sum, event) => {
  const lock = await msgEscrow.getLock(event.args.lockId);
  return sum + (lock.amount * 200n / 10000n);
}, 0n);

// Total revenue from DataStream
const settlements = await dataStream.queryFilter(dataStream.filters.Settled());
const totalStreamFees = settlements.reduce((sum, event) => {
  return sum + (event.args.amount * 2n / 100n);
}, 0n);

// Total revenue from DAC registrations
const registrations = await dacRegistry.queryFilter(dacRegistry.filters.DACRegistered());
const totalRegFees = registrations.length * parseEther("0.002");

console.log(`Total Protocol Revenue: ${formatEther(totalMsgFees + totalStreamFees + totalRegFees)} ETH`);
```

## 🔐 Security Considerations

1. **Treasury Address Validation**
   - Constructor requires non-zero treasury address
   - Only owner can update treasury
   
2. **Fee Limits**
   - MsgEscrow: Max 10% fee (1000 basis points)
   - DataStream: Max 10% fee
   - Prevents malicious fee increases

3. **Reentrancy Protection**
   - All money transfers use `nonReentrant` modifier
   - Safe from reentrancy attacks

4. **Fee Before Service**
   - Registration fees collected upfront
   - No risk of unpaid services

## 📱 SDK Integration

SDK kullanıcıları fee'leri otomatik olarak hesaplayabilir:

```typescript
import { OpacusClient } from 'opacus-sdk';

const client = new OpacusClient({...});

// Message cost with 2% protocol fee
const baseCost = 0.001; // tokens
const protocolFee = baseCost * 0.02;
const totalCost = baseCost + protocolFee;

console.log(`Sending message costs ${totalCost} tokens (includes 2% protocol fee)`);
```

## 🎯 Next Steps

1. ✅ **Deploy to Testnet** - Test protocol fee collection
2. ⏳ **Revenue Dashboard** - Build analytics dashboard
3. ⏳ **Mainnet Deploy** - Launch with real value
4. ⏳ **Multi-sig Treasury** - Secure treasury with Gnosis Safe
5. ⏳ **Token Launch** - Create $OPAC token for fee payments

---

**Treasury Address:** `0x0fA18Bb0Dbb03Ed137a8071461549eBAc94a015e`  
**Current Fee:** 2% across all protocols  
**Status:** ✅ Implemented, Ready for Deployment
