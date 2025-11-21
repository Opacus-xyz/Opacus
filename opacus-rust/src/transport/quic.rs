//! QUIC transport using Quinn

use quinn::{ClientConfig, Endpoint, Connection, SendDatagramError};
use rustls::pki_types::CertificateDer;
use std::sync::Arc;
use std::net::SocketAddr;
use tokio::sync::mpsc;
use tracing::{debug, warn};
use crate::types::OpacusFrame;
use crate::proto::CBORCodec;

/// QUIC transport for Opacus protocol
pub struct QUICTransport {
    endpoint: Endpoint,
    connection: Option<Connection>,
    server_addr: SocketAddr,
    rx: Option<mpsc::Receiver<OpacusFrame>>,
}

impl QUICTransport {
    /// Create new QUIC transport
    /// 
    /// # Arguments
    /// * `bind_addr` - Local bind address (e.g., "0.0.0.0:0")
    /// * `server_addr` - Relay server address (e.g., "relay.opacus.io:4242")
    pub async fn new(bind_addr: &str, server_addr: &str) -> anyhow::Result<Self> {
        let bind: SocketAddr = bind_addr.parse()?;
        let server: SocketAddr = server_addr.parse()?;
        
        // Create client config (skip verification for dev)
        let crypto = rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(SkipVerification))
            .with_no_client_auth();
        
        let client_config = ClientConfig::new(Arc::new(
            quinn::crypto::rustls::QuicClientConfig::try_from(crypto)?
        ));
        
        let mut endpoint = Endpoint::client(bind)?;
        endpoint.set_default_client_config(client_config);
        
        debug!("QUIC endpoint created on {}", bind);
        
        Ok(Self {
            endpoint,
            connection: None,
            server_addr: server,
            rx: None,
        })
    }
    
    /// Connect to relay server
    pub async fn connect(&mut self) -> anyhow::Result<()> {
        debug!("Connecting to {}", self.server_addr);
        
        let conn = self.endpoint
            .connect(self.server_addr, "opacus")?
            .await?;
        
        debug!("QUIC connection established");
        
        // Start receive loop
        let (tx, rx) = mpsc::channel(256);
        let conn_clone = conn.clone();
        tokio::spawn(async move {
            loop {
                match conn_clone.read_datagram().await {
                    Ok(data) => {
                        match CBORCodec::decode(&data) {
                            Ok(frame) => {
                                if tx.send(frame).await.is_err() {
                                    break;
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
        });
        
        self.connection = Some(conn);
        self.rx = Some(rx);
        Ok(())
    }
    
    /// Send frame
    pub async fn send(&self, frame: &OpacusFrame) -> Result<(), SendDatagramError> {
        let conn = self.connection.as_ref().expect("Not connected");
        let data = CBORCodec::encode(frame).expect("Encode failed");
        conn.send_datagram(data.into())
    }
    
    /// Receive frame (blocking)
    pub async fn recv(&mut self) -> Option<OpacusFrame> {
        self.rx.as_mut()?.recv().await
    }
    
    /// Check connection status
    pub fn is_connected(&self) -> bool {
        self.connection.is_some()
    }
    
    /// Close connection
    pub async fn close(&mut self) {
        if let Some(conn) = self.connection.take() {
            conn.close(0u32.into(), b"bye");
            debug!("Connection closed");
        }
    }
}

// Skip TLS verification for development
#[derive(Debug)]
struct SkipVerification;

impl rustls::client::danger::ServerCertVerifier for SkipVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }
    
    fn verify_tls12_signature(
        &self, _: &[u8], _: &CertificateDer<'_>, _: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    
    fn verify_tls13_signature(
        &self, _: &[u8], _: &CertificateDer<'_>, _: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    
    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ED25519,
        ]
    }
}
