# H3-DAC Rust SDK

Official Rust SDK for H3-DAC protocol integration.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
h3-dac-sdk = "1.0"
tokio = { version = "1", features = ["full"] }
```

## Quick Start

```rust
use h3_dac_sdk::{H3DACClient, crypto::generate_private_key};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize client
    let private_key = generate_private_key();
    let mut client = H3DACClient::new(private_key, Some("http://localhost:3000"));

    // Or with existing private key
    let mut client = H3DACClient::from_hex(
        "your-hex-private-key",
        Some("https://gateway.h3-dac.io")
    )?;

    // Authenticate
    let session = client.authenticate("my-client-id").await?;
    println!("Authenticated! Session expires at: {}", session.expires_at);

    // Send secure payload
    let response = client.send_payload(json!({
        "data": "secret message"
    })).await?;

    println!("Response: {:?}", response);

    Ok(())
}
```

## API Reference

### H3DACClient

#### Constructor

```rust
// Create with SecretKey
pub fn new(private_key: SecretKey, gateway_url: Option<&str>) -> Self

// Create from hex string
pub fn from_hex(private_key_hex: &str, gateway_url: Option<&str>) -> Result<Self>
```

#### Methods

##### `authenticate(&mut self, client_id: &str) -> Result<AuthSession>`

Authenticate with the gateway and establish a secure session.

```rust
let session = client.authenticate("my-app-id").await?;
```

##### `send_payload(&self, payload: serde_json::Value) -> Result<serde_json::Value>`

Send encrypted payload to the gateway.

```rust
let result = client.send_payload(json!({
    "action": "transfer",
    "amount": 100
})).await?;
```

##### `verify_session(&self) -> Result<bool>`

Check if current session is still valid.

```rust
let is_valid = client.verify_session().await?;
```

##### `get_proof_status(&self) -> Result<ProofStatus>`

Get on-chain proof status for current session.

```rust
let proof = client.get_proof_status().await?;
```

##### `clear_session(&mut self)`

Clear current session data.

##### `is_authenticated(&self) -> bool`

Check if client is currently authenticated.

### Crypto Module

```rust
use h3_dac_sdk::crypto::{
    generate_private_key,
    get_public_key,
    sign_message,
    verify_signature,
    derive_shared_secret,
    encrypt_payload,
    decrypt_payload,
};
```

## Examples

### Basic Authentication

```rust
use h3_dac_sdk::{H3DACClient, crypto::generate_private_key};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let private_key = generate_private_key();
    let mut client = H3DACClient::new(private_key, None);
    
    match client.authenticate("user-123").await {
        Ok(session) => {
            println!("Authenticated! Expires: {}", session.expires_at);
        }
        Err(e) => {
            eprintln!("Authentication failed: {}", e);
        }
    }

    Ok(())
}
```

### Sending Data

```rust
use serde_json::json;

if client.is_authenticated() {
    let response = client.send_payload(json!({
        "type": "transaction",
        "data": {
            "from": "addr1",
            "to": "addr2",
            "amount": "100"
        }
    })).await?;
    
    println!("Response: {:?}", response);
}
```

### Key Management

```rust
use h3_dac_sdk::crypto::generate_private_key;

// Generate new key pair
let private_key = generate_private_key();
let client = H3DACClient::new(private_key, None);
println!("Private Key: {}", client.get_private_key_hex());
println!("Public Key: {}", client.get_public_key_hex());

// Use existing key
let existing_client = H3DACClient::from_hex(
    "your-private-key-hex",
    Some("https://gateway.h3-dac.io")
)?;
```

## Error Handling

```rust
use h3_dac_sdk::error::H3DACError;

match client.authenticate("client-id").await {
    Ok(session) => { /* success */ }
    Err(H3DACError::SessionExpired) => {
        println!("Session expired, re-authenticating...");
    }
    Err(H3DACError::AuthError(msg)) => {
        println!("Authentication failed: {}", msg);
    }
    Err(e) => {
        println!("Error: {}", e);
    }
}
```

## Features

- ✅ Async/await support with Tokio
- ✅ Strong type safety
- ✅ Comprehensive error handling
- ✅ Zero-copy where possible
- ✅ Full test coverage

## Security Best Practices

1. **Never expose private keys** - Store securely and never commit to version control
2. **Validate sessions** - Check `is_authenticated()` before sending payloads
3. **Handle expiration** - Re-authenticate when sessions expire
4. **Use HTTPS** - Always connect to gateway over secure connection in production

## Testing

```bash
cargo test
cargo test -- --nocapture  # With output
```

## License

MIT
