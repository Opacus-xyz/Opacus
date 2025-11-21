use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::{H3DACError, Result};

#[derive(Debug, Serialize, Deserialize)]
pub struct NonceResponse {
    pub nonce: String,
    #[serde(rename = "serverPubKey")]
    pub server_pub_key: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthRequest {
    #[serde(rename = "clientId")]
    pub client_id: String,
    pub signature: String,
    pub nonce: String,
    #[serde(rename = "clientPubKey")]
    pub client_pub_key: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    #[serde(rename = "sessionKey")]
    pub session_key: String,
    pub status: String,
    pub message: Option<String>,
    #[serde(rename = "expiresAt")]
    pub expires_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PayloadRequest {
    #[serde(rename = "clientId")]
    pub client_id: String,
    pub encrypted: String,
    pub nonce: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PayloadResponse {
    pub status: String,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProofStatus {
    pub exists: bool,
    #[serde(rename = "blockTime")]
    pub block_time: Option<u64>,
    #[serde(rename = "txHash")]
    pub tx_hash: Option<String>,
}

pub struct HttpClient {
    client: Client,
    base_url: String,
}

impl HttpClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn fetch_nonce(&self) -> Result<NonceResponse> {
        let url = format!("{}/nonce", self.base_url);
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(H3DACError::HttpError(format!(
                "Failed to fetch nonce: {}",
                response.status()
            )));
        }

        Ok(response.json().await?)
    }

    pub async fn authenticate(&self, auth_data: AuthRequest) -> Result<AuthResponse> {
        let url = format!("{}/auth", self.base_url);
        let response = self.client.post(&url).json(&auth_data).send().await?;

        if !response.status().is_success() {
            return Err(H3DACError::HttpError(format!(
                "Authentication request failed: {}",
                response.status()
            )));
        }

        let auth_response: AuthResponse = response.json().await?;

        if auth_response.status != "success" {
            return Err(H3DACError::AuthError(
                auth_response
                    .message
                    .unwrap_or_else(|| "Unknown error".to_string()),
            ));
        }

        Ok(auth_response)
    }

    pub async fn send_payload(&self, payload_data: PayloadRequest) -> Result<PayloadResponse> {
        let url = format!("{}/payload", self.base_url);
        let response = self.client.post(&url).json(&payload_data).send().await?;

        if !response.status().is_success() {
            return Err(H3DACError::HttpError(format!(
                "Payload request failed: {}",
                response.status()
            )));
        }

        let payload_response: PayloadResponse = response.json().await?;

        if payload_response.status != "success" {
            return Err(H3DACError::InvalidResponse(
                payload_response
                    .message
                    .unwrap_or_else(|| "Unknown error".to_string()),
            ));
        }

        Ok(payload_response)
    }

    pub async fn verify_session(&self, client_id: &str, session_key: &str) -> Result<bool> {
        let url = format!("{}/verify-session", self.base_url);
        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "clientId": client_id,
                "sessionKey": session_key
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(false);
        }

        #[derive(Deserialize)]
        struct VerifyResponse {
            valid: bool,
        }

        let verify_response: VerifyResponse = response.json().await?;
        Ok(verify_response.valid)
    }

    pub async fn get_proof_status(&self, client_id: &str) -> Result<ProofStatus> {
        let url = format!("{}/proof/{}", self.base_url, client_id);
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(H3DACError::HttpError(format!(
                "Failed to get proof status: {}",
                response.status()
            )));
        }

        Ok(response.json().await?)
    }
}
