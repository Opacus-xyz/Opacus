# H3-DAC TypeScript SDK

Official TypeScript SDK for H3-DAC protocol integration.

## Installation

```bash
npm install @h3-dac/sdk-ts
```

## Quick Start

```typescript
import { H3DAC } from '@h3-dac/sdk-ts';

// Initialize client
const client = new H3DAC({
  gatewayUrl: 'http://localhost:3000'
});

// Or with existing private key
const client = H3DAC.fromPrivateKey('your-hex-private-key');

// Authenticate
const session = await client.authenticate('my-client-id');

// Send secure payload
const response = await client.sendPayload({
  data: 'secret message'
});
```

## API Reference

### H3DAC Class

#### Constructor

```typescript
new H3DAC(config?: H3DACConfig)
```

**Config Options:**
- `gatewayUrl?: string` - Gateway server URL (default: http://localhost:3000)
- `privateKey?: Uint8Array` - Existing private key (generates new if not provided)

#### Methods

##### `authenticate(clientId: string): Promise<AuthSession>`

Authenticate with the gateway and establish a secure session.

```typescript
const session = await client.authenticate('my-app-id');
```

##### `sendPayload(payload: any): Promise<any>`

Send encrypted payload to the gateway.

```typescript
const result = await client.sendPayload({
  action: 'transfer',
  amount: 100
});
```

##### `verifySession(): Promise<boolean>`

Check if current session is still valid.

```typescript
const isValid = await client.verifySession();
```

##### `getProofStatus(): Promise<ProofStatus>`

Get on-chain proof status for current session.

```typescript
const proof = await client.getProofStatus();
```

##### `clearSession(): void`

Clear current session data.

##### `isAuthenticated(): boolean`

Check if client is currently authenticated.

### Crypto Utilities

```typescript
import { 
  generatePrivateKey,
  getPublicKey,
  signMessage,
  verifySignature,
  deriveSharedSecret,
  encryptPayload,
  decryptPayload
} from '@h3-dac/sdk-ts';
```

## Examples

### Basic Authentication

```typescript
import { H3DAC } from '@h3-dac/sdk-ts';

const client = new H3DAC();
const clientId = 'user-123';

try {
  const session = await client.authenticate(clientId);
  console.log('Authenticated until:', new Date(session.expiresAt));
} catch (error) {
  console.error('Authentication failed:', error);
}
```

### Sending Data

```typescript
if (client.isAuthenticated()) {
  const response = await client.sendPayload({
    type: 'transaction',
    data: {
      from: 'addr1',
      to: 'addr2',
      amount: '100'
    }
  });
  
  console.log('Response:', response);
}
```

### Key Management

```typescript
// Generate new key pair
const client = new H3DAC();
console.log('Private Key:', client.getPrivateKey());
console.log('Public Key:', client.getPublicKey());

// Use existing key
const existingClient = H3DAC.fromPrivateKey(
  'your-private-key-hex',
  'https://gateway.h3-dac.io'
);
```

## Error Handling

```typescript
try {
  await client.authenticate('client-id');
} catch (error) {
  if (error.message.includes('expired')) {
    // Handle expiration
  } else if (error.message.includes('invalid')) {
    // Handle invalid credentials
  }
}
```

## Security Best Practices

1. **Never expose private keys** - Store securely and never commit to version control
2. **Validate sessions** - Check `isAuthenticated()` before sending payloads
3. **Handle expiration** - Re-authenticate when sessions expire
4. **Use HTTPS** - Always connect to gateway over secure connection in production

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type { 
  H3DACConfig, 
  AuthSession, 
  AuthResponse,
  PayloadResponse 
} from '@h3-dac/sdk-ts';
```

## License

MIT
