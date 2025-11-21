//! High-performance QUIC relay server

use quinn::{ServerConfig, Endpoint, Connection};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rcgen::generate_simple_self_signed;
use std::sync::Arc;
use std::net::SocketAddr;
use dashmap::DashMap;
use tokio::sync::broadcast;
use tracing::{info, warn, debug};
use crate::types::{OpacusFrame, FrameType};
use crate::proto::CBORCodec;
use crate::crypto::KeyManager;

/// Connected agent information
pub struct ConnectedAgent {
    pub id: String,
    pub connection: Connection,
    pub ed_pub: [u8; 32],
    pub x_pub: [u8; 32],
    pub last_seen: u64,
}

/// Opacus relay server
pub struct OpacusRelayServer {
    port: u16,
    agents: Arc<DashMap<String, ConnectedAgent>>,
    pending: Arc<DashMap<String, Vec<OpacusFrame>>>,
    shutdown_tx: Option<broadcast::Sender<()>>,
}

impl OpacusRelayServer {
    /// Create new relay server
    /// 
    /// # Arguments
    /// * `port` - Port to listen on
    pub fn new(port: u16) -> Self {
        Self {
            port,
            agents: Arc::new(DashMap::new()),
            pending: Arc::new(DashMap::new()),
            shutdown_tx: None,
        }
    }
    
    /// Start relay server
    pub async fn start(&mut self) -> anyhow::Result<()> {
        // Generate self-signed cert
        let subject_names = vec!["opacus".to_string(), "localhost".to_string()];
        let cert = generate_simple_self_signed(subject_names)?;
        
        let cert_der = CertificateDer::from(cert.serialize_der()?);
        let key_der = PrivateKeyDer::try_from(cert.serialize_private_key_der())
            .map_err(|e| anyhow::anyhow!("Failed to serialize private key: {}", e))?;
        
        let mut server_crypto = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(vec![cert_der], key_der)?;
        server_crypto.alpn_protocols = vec![b"opacus".to_vec()];
        
        let server_config = ServerConfig::with_crypto(Arc::new(
            quinn::crypto::rustls::QuicServerConfig::try_from(server_crypto)?
        ));
        
        let addr: SocketAddr = format!("0.0.0.0:{}", self.port).parse()?;
        let endpoint = Endpoint::server(server_config, addr)?;
        
        info!("🚀 Opacus Relay Server listening on port {}", self.port);
        info!("📡 QUIC transport ready");
        
        let (shutdown_tx, _) = broadcast::channel(1);
        self.shutdown_tx = Some(shutdown_tx.clone());
        
        let agents = self.agents.clone();
        let pending = self.pending.clone();
        
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    Some(conn) = endpoint.accept() => {
                        let agents = agents.clone();
                        let pending = pending.clone();
                        tokio::spawn(async move {
                            match conn.await {
                                Ok(conn) => {
                                    debug!("New connection from {}", conn.remote_address());
                                    Self::handle_connection(conn, agents, pending).await;
                                }
                                Err(e) => warn!("Connection failed: {}", e),
                            }
                        });
                    }
                    _ = tokio::signal::ctrl_c() => {
                        info!("Shutting down relay server...");
                        break;
                    }
                }
            }
        });
        
        Ok(())
    }
    
    async fn handle_connection(
        conn: Connection,
        agents: Arc<DashMap<String, ConnectedAgent>>,
        pending: Arc<DashMap<String, Vec<OpacusFrame>>>,
    ) {
        let mut agent_id: Option<String> = None;
        
        loop {
            match conn.read_datagram().await {
                Ok(data) => {
                    match CBORCodec::decode(&data) {
                        Ok(frame) => {
                            if frame.frame_type == FrameType::Connect {
                                agent_id = Some(frame.from.clone());
                                
                                // Parse payload for keys
                                if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&frame.payload) {
                                    let ed_pub_hex = payload["edPub"].as_str().unwrap_or("");
                                    let x_pub_hex = payload["xPub"].as_str().unwrap_or("");
                                    
                                    let ed_pub = KeyManager::from_hex(ed_pub_hex)
                                        .ok()
                                        .and_then(|v| v.try_into().ok())
                                        .unwrap_or([0u8; 32]);
                                    let x_pub = KeyManager::from_hex(x_pub_hex)
                                        .ok()
                                        .and_then(|v| v.try_into().ok())
                                        .unwrap_or([0u8; 32]);
                                    
                                    agents.insert(frame.from.clone(), ConnectedAgent {
                                        id: frame.from.clone(),
                                        connection: conn.clone(),
                                        ed_pub,
                                        x_pub,
                                        last_seen: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs(),
                                    });
                                    
                                    info!("✅ Agent connected: {}", frame.from);
                                    
                                    // Send ACK
                                    let ack = OpacusFrame {
                                        version: 1,
                                        frame_type: FrameType::Ack,
                                        from: "relay".to_string(),
                                        to: frame.from.clone(),
                                        seq: 0,
                                        ts: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_millis() as u64,
                                        nonce: "".to_string(),
                                        payload: vec![],
                                        hmac: None,
                                        sig: None,
                                    };
                                    if let Ok(ack_data) = CBORCodec::encode(&ack) {
                                        let _ = conn.send_datagram(ack_data.into());
                                    }
                                    
                                    // Flush pending messages
                                    if let Some((_, msgs)) = pending.remove(&frame.from) {
                                        let count = msgs.len();
                                        for msg in msgs {
                                            let _ = Self::route_frame(&msg, &agents, &pending).await;
                                        }
                                        debug!("Flushed {} pending messages for {}", count, frame.from);
                                    }
                                }
                            } else {
                                Self::route_frame(&frame, &agents, &pending).await;
                            }
                        }
                        Err(e) => warn!("Decode error: {}", e),
                    }
                }
                Err(e) => {
                    debug!("Connection closed: {}", e);
                    break;
                }
            }
        }
        
        if let Some(id) = agent_id {
            agents.remove(&id);
            info!("❌ Agent disconnected: {}", id);
        }
    }
    
    async fn route_frame(
        frame: &OpacusFrame,
        agents: &DashMap<String, ConnectedAgent>,
        pending: &DashMap<String, Vec<OpacusFrame>>,
    ) {
        if let Some(agent) = agents.get(&frame.to) {
            if let Ok(data) = CBORCodec::encode(frame) {
                match agent.connection.send_datagram(data.into()) {
                    Ok(_) => debug!("Routed {} to {}", frame.frame_type as u8, frame.to),
                    Err(e) => warn!("Failed to route: {}", e),
                }
            }
        } else {
            // Queue for later
            debug!("Queueing message for offline agent: {}", frame.to);
            pending.entry(frame.to.clone())
                .or_insert_with(Vec::new)
                .push(frame.clone());
        }
    }
    
    /// Get connected agent count
    pub fn get_agent_count(&self) -> usize {
        self.agents.len()
    }
    
    /// Get list of connected agent IDs
    pub fn get_connected_agents(&self) -> Vec<String> {
        self.agents.iter().map(|r| r.key().clone()).collect()
    }
    
    /// Get pending message count
    pub fn get_pending_count(&self) -> usize {
        self.pending.iter().map(|r| r.value().len()).sum()
    }
}
