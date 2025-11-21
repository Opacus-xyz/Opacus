pub mod crypto;
pub mod error;
pub mod http;

use secp256k1::{PublicKey, SecretKey};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{
    decrypt_payload, derive_session_key, derive_shared_secret, encrypt_payload, get_public_key,
    sign_message,
};
use crate::error::{H3DACError, Result};
use crate::http::{AuthRequest, HttpClient, PayloadRequest, ProofStatus};

#[derive(Debug, Clone)]
pub struct AuthSession {
    pub session_key: Vec<u8>,
    pub client_id: String,
    pub expires_at: u64,
}

pub struct H3DACClient {
    private_key: SecretKey,
    public_key: PublicKey,
    http_client: HttpClient,
    session: Option<AuthSession>,
}

impl H3DACClient {
    /// Create a new H3DAC client with a private key
    pub fn new(private_key: SecretKey, gateway_url: Option<&str>) -> Self {
        let public_key = get_public_key(&private_key);
        let http_client = HttpClient::new(gateway_url.unwrap_or("http://localhost:3000"));

        Self {
            private_key,
            public_key,
            http_client,
            session: None,
        }
    }

    /// Create a client from a hex-encoded private key
    pub fn from_hex(private_key_hex: &str, gateway_url: Option<&str>) -> Result<Self> {
        let private_key_bytes = hex::decode(private_key_hex)
            .map_err(|e| H3DACError::CryptoError(format!("Invalid hex: {}", e)))?;

        let private_key = SecretKey::from_slice(&private_key_bytes)
            .map_err(|e| H3DACError::CryptoError(format!("Invalid private key: {}", e)))?;

        Ok(Self::new(private_key, gateway_url))
    }

    /// Get the client's public key as hex string
    pub fn get_public_key_hex(&self) -> String {
        hex::encode(self.public_key.serialize())
    }

    /// Get the client's private key as hex string (use with caution)
    pub fn get_private_key_hex(&self) -> String {
        hex::encode(self.private_key.secret_bytes())
    }

    /// Authenticate with the gateway and establish a session
    pub async fn authenticate(&mut self, client_id: &str) -> Result<AuthSession> {
        // Step 1: Fetch nonce from gateway
        let nonce_response = self.http_client.fetch_nonce().await?;

        // Step 2: Create signature
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut message = Vec::new();
        message.extend_from_slice(&hex::decode(&nonce_response.nonce).unwrap());
        message.extend_from_slice(client_id.as_bytes());
        message.extend_from_slice(&timestamp.to_be_bytes());

        let signature = sign_message(&message, &self.private_key)?;

        // Step 3: Derive shared secret
        let server_pub_key_bytes = hex::decode(&nonce_response.server_pub_key)
            .map_err(|e| H3DACError::CryptoError(format!("Invalid server public key: {}", e)))?;

        let server_pub_key = PublicKey::from_slice(&server_pub_key_bytes)
            .map_err(|e| H3DACError::CryptoError(format!("Invalid server public key: {}", e)))?;

        let shared_secret = derive_shared_secret(&self.private_key, &server_pub_key)?;
        let session_key = derive_session_key(&shared_secret)?;

        // Step 4: Send authentication request
        let auth_response = self
            .http_client
            .authenticate(AuthRequest {
                client_id: client_id.to_string(),
                signature: hex::encode(&signature),
                nonce: nonce_response.nonce,
                client_pub_key: self.get_public_key_hex(),
                timestamp,
            })
            .await?;

        // Store session
        let session = AuthSession {
            session_key,
            client_id: client_id.to_string(),
            expires_at: auth_response.expires_at,
        };

        self.session = Some(session.clone());

        Ok(session)
    }

    /// Send encrypted payload to the gateway
    pub async fn send_payload(&self, payload: serde_json::Value) -> Result<serde_json::Value> {
        let session = self
            .session
            .as_ref()
            .ok_or(H3DACError::NotAuthenticated)?;

        // Check if session is expired
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        if now > session.expires_at {
            return Err(H3DACError::SessionExpired);
        }

        // Encrypt payload
        let payload_bytes = serde_json::to_vec(&payload)?;
        let (encrypted, nonce) = encrypt_payload(&payload_bytes, &session.session_key)?;

        // Create signature for the encrypted payload
        let signature = sign_message(&encrypted, &self.private_key)?;

        // Send to gateway
        let response = self
            .http_client
            .send_payload(PayloadRequest {
                client_id: session.client_id.clone(),
                encrypted: hex::encode(&encrypted),
                nonce: hex::encode(&nonce),
                signature: hex::encode(&signature),
            })
            .await?;

        Ok(response.data.unwrap_or(serde_json::Value::Null))
    }

    /// Verify if the session is still valid
    pub async fn verify_session(&self) -> Result<bool> {
        let session = self
            .session
            .as_ref()
            .ok_or(H3DACError::NotAuthenticated)?;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        if now > session.expires_at {
            return Ok(false);
        }

        self.http_client
            .verify_session(&session.client_id, &hex::encode(&session.session_key))
            .await
    }

    /// Get on-chain proof status
    pub async fn get_proof_status(&self) -> Result<ProofStatus> {
        let session = self
            .session
            .as_ref()
            .ok_or(H3DACError::NotAuthenticated)?;

        self.http_client.get_proof_status(&session.client_id).await
    }

    /// Clear current session
    pub fn clear_session(&mut self) {
        self.session = None;
    }

    /// Check if currently authenticated
    pub fn is_authenticated(&self) -> bool {
        if let Some(session) = &self.session {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            now < session.expires_at
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::generate_private_key;

    #[test]
    fn test_client_creation() {
        let private_key = generate_private_key();
        let client = H3DACClient::new(private_key, None);
        assert!(!client.get_public_key_hex().is_empty());
    }

    #[test]
    fn test_from_hex() {
        let private_key = generate_private_key();
        let hex = hex::encode(private_key.secret_bytes());
        let client = H3DACClient::from_hex(&hex, None).unwrap();
        assert_eq!(client.get_private_key_hex(), hex);
    }
}
