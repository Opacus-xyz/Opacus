# H3-DAC Gateway

Gateway server for H3-DAC protocol authentication and payload verification.

## Features

- ✅ Nonce generation and validation (30s TTL, single-use)
- ✅ ECDH shared secret derivation
- ✅ Session key management
- ✅ Signature verification
- ✅ Redis-backed state storage
- ✅ On-chain proof preparation
- ✅ RESTful API

## Prerequisites

- Node.js 18+
- Redis server
- TypeScript

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
NONCE_EXPIRY_SECONDS=30
SESSION_EXPIRY_SECONDS=3600
GATEWAY_PRIVATE_KEY=your-private-key
GATEWAY_PUBLIC_KEY=your-public-key
```

**Generate gateway keys** on first run (they'll be displayed in console if not set).

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### GET /nonce

Generate a new nonce for authentication.

**Response:**
```json
{
  "nonce": "hex-string",
  "serverPubKey": "hex-string",
  "expiresAt": 1234567890
}
```

### POST /auth

Authenticate and establish a session.

**Request:**
```json
{
  "clientId": "string",
  "signature": "hex-string",
  "nonce": "hex-string",
  "clientPubKey": "hex-string",
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "sessionKey": "hex-string",
  "status": "success",
  "expiresAt": 1234567890
}
```

### POST /payload

Send encrypted payload.

**Request:**
```json
{
  "clientId": "string",
  "encrypted": "hex-string",
  "nonce": "hex-string",
  "signature": "hex-string"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Payload received",
  "data": {}
}
```

### POST /verify-session

Check if session is valid.

**Request:**
```json
{
  "clientId": "string",
  "sessionKey": "hex-string"
}
```

**Response:**
```json
{
  "valid": true
}
```

### GET /proof/:clientId

Get on-chain proof status.

**Response:**
```json
{
  "exists": true,
  "blockTime": 1234567890,
  "txHash": "0x..."
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0"
}
```

## Architecture

```
Client Request → Express Middleware → Routes → Redis → Response
                                              ↓
                                         Crypto Utils
                                              ↓
                                      Session Management
```

## Security Features

1. **Nonce-based authentication** - Prevents replay attacks
2. **ECDH key exchange** - Secure shared secret derivation
3. **Session expiration** - Automatic cleanup
4. **Signature verification** - Cryptographic proof of identity
5. **Timestamp validation** - 60-second window for requests
6. **Helmet.js** - Security headers
7. **CORS** - Configurable cross-origin policies

## Testing

```bash
npm test
```

## Monitoring

Logs are written to:
- Console (development)
- `logs/combined.log` (production)
- `logs/error.log` (errors only, production)

## License

MIT
