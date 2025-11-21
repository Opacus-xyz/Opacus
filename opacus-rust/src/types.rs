//! Core types for Opacus protocol

use serde::{Deserialize, Serialize};

/// Main configuration for Opacus client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpacusConfig {
    /// Network selection (mainnet, testnet, devnet)
    pub network: Network,
    /// Relay server URL (quic://host:port)
    pub relay_url: String,
    /// Blockchain RPC endpoint
    pub chain_rpc: String,
    /// Optional private key for chain operations
    pub private_key: Option<String>,
}

/// Network variants
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Network {
    Mainnet,
    Testnet,
    Devnet,
}

impl Network {
    /// Get chain ID for network
    pub fn chain_id(&self) -> u64 {
        match self {
            Network::Mainnet => 16661,
            Network::Testnet => 16602,
            Network::Devnet => 16600,
        }
    }
    
    /// Get default RPC URL for network
    pub fn rpc(&self) -> &'static str {
        match self {
            Network::Mainnet => "https://evmrpc.0g.ai",
            Network::Testnet => "https://evmrpc-testnet.0g.ai",
            Network::Devnet => "http://localhost:8545",
        }
    }
}

/// Opacus protocol frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpacusFrame {
    /// Protocol version
    pub version: u8,
    /// Frame type
    #[serde(rename = "type")]
    pub frame_type: FrameType,
    /// Sender agent ID
    pub from: String,
    /// Recipient agent ID
    pub to: String,
    /// Sequence number
    pub seq: u64,
    /// Timestamp (milliseconds)
    pub ts: u64,
    /// Anti-replay nonce
    pub nonce: String,
    /// Frame payload (application data)
    pub payload: Vec<u8>,
    /// HMAC for payload authentication
    pub hmac: Option<String>,
    /// Ed25519 signature
    pub sig: Option<Vec<u8>>,
}

/// Frame type variants
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FrameType {
    /// Initial connection handshake
    Connect,
    /// Point-to-point message
    Msg,
    /// Keepalive ping
    Ping,
    /// Acknowledgment
    Ack,
    /// Stream data broadcast
    Stream,
    /// Payment transaction
    Payment,
}

/// Agent identity with dual keys
#[derive(Debug, Clone)]
pub struct AgentIdentity {
    /// Unique agent identifier
    pub id: String,
    /// Ed25519 public key (signing)
    pub ed_pub: [u8; 32],
    /// Ed25519 private key (signing)
    pub ed_priv: [u8; 32],
    /// X25519 public key (encryption)
    pub x_pub: [u8; 32],
    /// X25519 private key (encryption)
    pub x_priv: [u8; 32],
    /// Ethereum-compatible address
    pub address: String,
    /// Chain ID
    pub chain_id: u64,
}

/// DAC (Decentralized Agent Communication) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DACConfig {
    /// Unique DAC identifier
    pub id: String,
    /// Owner address
    pub owner: String,
    /// Metadata
    pub metadata: DACMetadata,
    /// Data channels
    pub channels: Vec<DataChannel>,
}

/// DAC metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DACMetadata {
    /// Human-readable name
    pub name: String,
    /// Description
    pub description: String,
    /// Version string
    pub version: String,
    /// Tags for discovery
    pub tags: Vec<String>,
}

/// Data channel definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataChannel {
    /// Channel identifier
    pub id: String,
    /// Channel type
    pub channel_type: ChannelType,
    /// Price per byte
    pub price_per_byte: u64,
    /// Price per message
    pub price_per_msg: u64,
}

/// Channel type variants
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChannelType {
    /// Inbound data channel
    Input,
    /// Outbound data channel
    Output,
    /// Bidirectional channel
    Bidirectional,
}
