//! Opacus client implementation

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug};
use crate::types::*;
use crate::crypto::{KeyManager, SecurityManager};
use crate::transport::QUICTransport;

/// Main Opacus client
pub struct OpacusClient {
    config: OpacusConfig,
    identity: Option<AgentIdentity>,
    transport: Option<QUICTransport>,
    security: Arc<RwLock<SecurityManager>>,
    relay_x_pub: Option<[u8; 32]>,
    seq: u64,
}

impl OpacusClient {
    /// Create new client with configuration
    pub fn new(config: OpacusConfig) -> Self {
        Self {
            config,
            identity: None,
            transport: None,
            security: Arc::new(RwLock::new(SecurityManager::new())),
            relay_x_pub: None,
            seq: 0,
        }
    }
    
    /// Initialize client with new identity
    /// 
    /// # Returns
    /// Reference to generated `AgentIdentity`
    pub async fn init(&mut self) -> &AgentIdentity {
        let chain_id = self.config.network.chain_id();
        self.identity = Some(KeyManager::generate_identity(chain_id));
        let identity = self.identity.as_ref().unwrap();
        
        info!("Agent initialized: {}", identity.id);
        info!("Address: {}", identity.address);
        
        identity
    }
    
    /// Initialize from existing identity
    pub async fn init_from_keys(
        &mut self,
        ed_priv: [u8; 32],
        x_priv: [u8; 32],
    ) -> anyhow::Result<&AgentIdentity> {
        use ed25519_dalek::SigningKey;
        use x25519_dalek::{StaticSecret, PublicKey as X25519Public};
        use sha2::{Sha256, Digest};
        
        let signing_key = SigningKey::from_bytes(&ed_priv);
        let ed_pub = *signing_key.verifying_key().as_bytes();
        
        let x_secret = StaticSecret::from(x_priv);
        let x_pub = X25519Public::from(&x_secret).to_bytes();
        
        let mut hasher = Sha256::new();
        hasher.update(&ed_pub);
        let hash = hasher.finalize();
        let id = hex::encode(&hash[..20]);
        let address = format!("0x{}", hex::encode(&hash[..20]));
        
        self.identity = Some(AgentIdentity {
            id: id.clone(),
            ed_pub,
            ed_priv,
            x_pub,
            x_priv,
            address: address.clone(),
            chain_id: self.config.network.chain_id(),
        });
        
        info!("Agent restored: {}", id);
        info!("Address: {}", address);
        
        Ok(self.identity.as_ref().unwrap())
    }
    
    /// Connect to relay server
    pub async fn connect(&mut self) -> anyhow::Result<()> {
        let identity = self.identity.as_ref().expect("Not initialized. Call init() first");
        
        // Parse relay URL
        let url = self.config.relay_url
            .replace("quic://", "")
            .replace("https://", "")
            .replace("http://", "");
        
        let mut transport = QUICTransport::new("0.0.0.0:0", &url).await?;
        transport.connect().await?;
        
        info!("Connected to relay: {}", self.config.relay_url);
        
        // Send connect frame
        let connect_payload = serde_json::json!({
            "edPub": KeyManager::to_hex(&identity.ed_pub),
            "xPub": KeyManager::to_hex(&identity.x_pub)
        });
        
        let frame = OpacusFrame {
            version: 1,
            frame_type: FrameType::Connect,
            from: identity.id.clone(),
            to: "relay".to_string(),
            seq: self.seq,
            ts: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            nonce: SecurityManager::generate_nonce(),
            payload: serde_json::to_vec(&connect_payload)?,
            hmac: None,
            sig: None,
        };
        self.seq += 1;
        
        transport.send(&frame).await?;
        debug!("Sent connect frame");
        
        self.transport = Some(transport);
        
        Ok(())
    }
    
    /// Send message to another agent
    /// 
    /// # Arguments
    /// * `to` - Recipient agent ID
    /// * `payload` - Message payload bytes
    pub async fn send_message(&mut self, to: &str, payload: Vec<u8>) -> anyhow::Result<()> {
        let identity = self.identity.as_ref().expect("Not initialized");
        let transport = self.transport.as_ref().expect("Not connected");
        let relay_x_pub = self.relay_x_pub.unwrap_or([0u8; 32]);
        
        let frame = self.security.write().await.create_auth_frame(
            identity,
            &relay_x_pub,
            FrameType::Msg,
            to,
            payload,
        );
        
        transport.send(&frame).await?;
        debug!("Sent message to {}", to);
        
        Ok(())
    }
    
    /// Send stream data
    pub async fn send_stream(&mut self, channel_id: &str, data: Vec<u8>) -> anyhow::Result<()> {
        let identity = self.identity.as_ref().expect("Not initialized");
        let transport = self.transport.as_ref().expect("Not connected");
        let relay_x_pub = self.relay_x_pub.unwrap_or([0u8; 32]);
        
        let payload = serde_json::json!({
            "channelId": channel_id,
            "data": data
        });
        
        let frame = self.security.write().await.create_auth_frame(
            identity,
            &relay_x_pub,
            FrameType::Stream,
            "broadcast",
            serde_json::to_vec(&payload)?,
        );
        
        transport.send(&frame).await?;
        debug!("Sent stream to channel {}", channel_id);
        
        Ok(())
    }
    
    /// Receive next frame (blocking)
    pub async fn recv(&mut self) -> Option<OpacusFrame> {
        let frame = self.transport.as_mut()?.recv().await?;
        
        // Handle ACK to get relay public key
        if frame.frame_type == FrameType::Ack && frame.from != self.identity.as_ref()?.id {
            if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&frame.payload) {
                if let Some(relay_x_pub_hex) = payload["relayXPub"].as_str() {
                    if let Ok(bytes) = KeyManager::from_hex(relay_x_pub_hex) {
                        if let Ok(arr) = bytes.try_into() {
                            self.relay_x_pub = Some(arr);
                            debug!("Stored relay public key");
                        }
                    }
                }
            }
        }
        
        Some(frame)
    }
    
    /// Get agent identity
    pub fn get_identity(&self) -> Option<&AgentIdentity> {
        self.identity.as_ref()
    }
    
    /// Export identity to hex strings
    pub fn export_identity(&self) -> Option<(String, String)> {
        let identity = self.identity.as_ref()?;
        Some((
            KeyManager::to_hex(&identity.ed_priv),
            KeyManager::to_hex(&identity.x_priv),
        ))
    }
    
    /// Check connection status
    pub fn is_connected(&self) -> bool {
        self.transport.as_ref().map(|t| t.is_connected()).unwrap_or(false)
    }
    
    /// Disconnect from relay
    pub async fn disconnect(&mut self) {
        if let Some(mut t) = self.transport.take() {
            t.close().await;
            info!("Disconnected from relay");
        }
    }
}
