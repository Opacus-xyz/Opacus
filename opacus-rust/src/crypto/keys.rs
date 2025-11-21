//! Key generation and management

use ed25519_dalek::{SigningKey, VerifyingKey};
use x25519_dalek::{StaticSecret, PublicKey as X25519Public};
use sha2::{Sha256, Digest};
use rand::rngs::OsRng;
use crate::types::AgentIdentity;

/// Key manager for Ed25519 and X25519 operations
pub struct KeyManager;

impl KeyManager {
    /// Generate Ed25519 key pair for signing
    pub fn generate_ed25519() -> (SigningKey, VerifyingKey) {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        (signing_key, verifying_key)
    }
    
    /// Generate X25519 key pair for encryption
    pub fn generate_x25519() -> (StaticSecret, X25519Public) {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = X25519Public::from(&secret);
        (secret, public)
    }
    
    /// Generate full agent identity with dual keys
    /// 
    /// # Arguments
    /// * `chain_id` - Blockchain chain ID
    /// 
    /// # Returns
    /// Complete `AgentIdentity` with Ed25519 and X25519 keys
    pub fn generate_identity(chain_id: u64) -> AgentIdentity {
        let (ed_signing, ed_verifying) = Self::generate_ed25519();
        let (x_secret, x_public) = Self::generate_x25519();
        
        // Generate ID from public key hash
        let mut hasher = Sha256::new();
        hasher.update(ed_verifying.as_bytes());
        let hash = hasher.finalize();
        let id = hex::encode(&hash[..20]);
        let address = format!("0x{}", hex::encode(&hash[..20]));
        
        AgentIdentity {
            id,
            ed_pub: *ed_verifying.as_bytes(),
            ed_priv: ed_signing.to_bytes(),
            x_pub: x_public.to_bytes(),
            x_priv: x_secret.to_bytes(),
            address,
            chain_id,
        }
    }
    
    /// Convert bytes to hex string
    pub fn to_hex(bytes: &[u8]) -> String {
        hex::encode(bytes)
    }
    
    /// Parse hex string to bytes
    pub fn from_hex(s: &str) -> Result<Vec<u8>, hex::FromHexError> {
        hex::decode(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_ed25519() {
        let (signing, verifying) = KeyManager::generate_ed25519();
        assert_eq!(signing.to_bytes().len(), 32);
        assert_eq!(verifying.as_bytes().len(), 32);
    }
    
    #[test]
    fn test_generate_x25519() {
        let (secret, public) = KeyManager::generate_x25519();
        assert_eq!(secret.to_bytes().len(), 32);
        assert_eq!(public.as_bytes().len(), 32);
    }
    
    #[test]
    fn test_generate_identity() {
        let identity = KeyManager::generate_identity(16602);
        assert_eq!(identity.chain_id, 16602);
        assert_eq!(identity.ed_pub.len(), 32);
        assert_eq!(identity.ed_priv.len(), 32);
        assert_eq!(identity.x_pub.len(), 32);
        assert_eq!(identity.x_priv.len(), 32);
        assert!(identity.address.starts_with("0x"));
    }
    
    #[test]
    fn test_hex_conversion() {
        let bytes = [1, 2, 3, 4, 5];
        let hex = KeyManager::to_hex(&bytes);
        assert_eq!(hex, "0102030405");
        let decoded = KeyManager::from_hex(&hex).unwrap();
        assert_eq!(decoded, bytes);
    }
}
