//! Security operations: ECDH, HKDF, HMAC, signatures, nonces

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use x25519_dalek::{StaticSecret, PublicKey as X25519Public};
use sha2::Sha256;
use hmac::{Hmac, Mac};
use hkdf::Hkdf;
use rand::Rng;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use crate::types::{AgentIdentity, OpacusFrame, FrameType};

type HmacSha256 = Hmac<Sha256>;

/// Security manager for authentication and encryption
pub struct SecurityManager {
    nonce_window: HashMap<String, u64>,
    last_nonce: u64,
}

impl SecurityManager {
    /// Create new security manager
    pub fn new() -> Self {
        Self {
            nonce_window: HashMap::new(),
            last_nonce: 0,
        }
    }
    
    /// Derive shared secret using ECDH
    /// 
    /// # Arguments
    /// * `my_priv` - Your X25519 private key
    /// * `peer_pub` - Peer's X25519 public key
    /// 
    /// # Returns
    /// 32-byte shared secret
    pub fn derive_shared_secret(my_priv: &[u8; 32], peer_pub: &[u8; 32]) -> [u8; 32] {
        let secret = StaticSecret::from(*my_priv);
        let public = X25519Public::from(*peer_pub);
        *secret.diffie_hellman(&public).as_bytes()
    }
    
    /// Derive session key using HKDF
    /// 
    /// # Arguments
    /// * `shared` - Shared secret from ECDH
    /// * `info` - Context information
    /// 
    /// # Returns
    /// 32-byte session key
    pub fn derive_session_key(shared: &[u8], info: &[u8]) -> [u8; 32] {
        let hk = Hkdf::<Sha256>::new(None, shared);
        let mut okm = [0u8; 32];
        hk.expand(info, &mut okm).expect("HKDF expand failed");
        okm
    }
    
    /// Generate HMAC-SHA256
    pub fn generate_hmac(key: &[u8], data: &str) -> String {
        let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key error");
        mac.update(data.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }
    
    /// Verify HMAC
    pub fn verify_hmac(key: &[u8], data: &str, expected: &str) -> bool {
        let computed = Self::generate_hmac(key, data);
        computed == expected
    }
    
    /// Generate anti-replay nonce
    /// 
    /// Format: `{timestamp_ms}-{random_hex}`
    pub fn generate_nonce() -> String {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        let rand: u64 = rand::thread_rng().gen();
        format!("{}-{:016x}", ts, rand)
    }
    
    /// Validate nonce (freshness + replay protection)
    /// 
    /// # Arguments
    /// * `nonce` - Nonce string to validate
    /// * `max_age_ms` - Maximum age in milliseconds
    /// 
    /// # Returns
    /// `true` if nonce is valid and not replayed
    pub fn validate_nonce(&mut self, nonce: &str, max_age_ms: u64) -> bool {
        let parts: Vec<&str> = nonce.split('-').collect();
        if parts.len() != 2 { return false; }
        
        let ts: u128 = match parts[0].parse() {
            Ok(t) => t,
            Err(_) => return false,
        };
        
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        
        // Check freshness
        if now.saturating_sub(ts) > max_age_ms as u128 { return false; }
        
        // Check replay
        if self.nonce_window.contains_key(nonce) { return false; }
        
        // Store
        self.nonce_window.insert(nonce.to_string(), now as u64);
        self.cleanup_nonces(max_age_ms * 2);
        
        true
    }
    
    fn cleanup_nonces(&mut self, max_age: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.nonce_window.retain(|_, ts| now - *ts < max_age);
    }
    
    /// Sign message with Ed25519
    pub fn sign(priv_key: &[u8; 32], message: &[u8]) -> Vec<u8> {
        let signing_key = SigningKey::from_bytes(priv_key);
        let signature: Signature = signing_key.sign(message);
        signature.to_bytes().to_vec()
    }
    
    /// Verify Ed25519 signature
    pub fn verify(pub_key: &[u8; 32], message: &[u8], sig: &[u8]) -> bool {
        let verifying_key = match VerifyingKey::from_bytes(pub_key) {
            Ok(k) => k,
            Err(_) => return false,
        };
        let signature = match Signature::from_slice(sig) {
            Ok(s) => s,
            Err(_) => return false,
        };
        verifying_key.verify(message, &signature).is_ok()
    }
    
    /// Create authenticated frame with signature + HMAC + nonce
    /// 
    /// # Arguments
    /// * `identity` - Sender identity
    /// * `peer_x_pub` - Recipient's X25519 public key
    /// * `frame_type` - Type of frame
    /// * `to` - Recipient agent ID
    /// * `payload` - Frame payload
    /// 
    /// # Returns
    /// Fully authenticated `OpacusFrame`
    pub fn create_auth_frame(
        &mut self,
        identity: &AgentIdentity,
        peer_x_pub: &[u8; 32],
        frame_type: FrameType,
        to: &str,
        payload: Vec<u8>,
    ) -> OpacusFrame {
        let nonce = Self::generate_nonce();
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.last_nonce += 1;
        let seq = self.last_nonce;
        
        // Derive session key
        let shared = Self::derive_shared_secret(&identity.x_priv, peer_x_pub);
        let session_key = Self::derive_session_key(&shared, b"opacus-session");
        
        // Create HMAC
        let hmac_data = format!(
            "{:?}|{}|{}|{}|{}|{}|{}",
            frame_type, identity.id, to, seq, ts, nonce, 
            hex::encode(&payload)
        );
        let hmac = Self::generate_hmac(&session_key, &hmac_data);
        
        // Create frame
        let mut frame = OpacusFrame {
            version: 1,
            frame_type,
            from: identity.id.clone(),
            to: to.to_string(),
            seq,
            ts,
            nonce,
            payload,
            hmac: Some(hmac.clone()),
            sig: None,
        };
        
        // Sign
        let sign_data = format!(
            "{}|{:?}|{}|{}|{}|{}|{}|{}",
            frame.version, frame.frame_type, frame.from, frame.to,
            frame.seq, frame.ts, frame.nonce, hmac
        );
        frame.sig = Some(Self::sign(&identity.ed_priv, sign_data.as_bytes()));
        
        frame
    }
    
    /// Verify authenticated frame (signature + HMAC + nonce)
    /// 
    /// # Arguments
    /// * `frame` - Frame to verify
    /// * `sender_ed_pub` - Sender's Ed25519 public key
    /// * `my_x_priv` - Your X25519 private key
    /// * `sender_x_pub` - Sender's X25519 public key
    /// 
    /// # Returns
    /// `Ok(())` if valid, `Err(reason)` if invalid
    pub fn verify_auth_frame(
        &mut self,
        frame: &OpacusFrame,
        sender_ed_pub: &[u8; 32],
        my_x_priv: &[u8; 32],
        sender_x_pub: &[u8; 32],
    ) -> Result<(), String> {
        // 1. Validate nonce
        if !self.validate_nonce(&frame.nonce, 60000) {
            return Err("Invalid or replayed nonce".into());
        }
        
        // 2. Verify signature
        let hmac = frame.hmac.as_ref().ok_or("Missing HMAC")?;
        let sign_data = format!(
            "{}|{:?}|{}|{}|{}|{}|{}|{}",
            frame.version, frame.frame_type, frame.from, frame.to,
            frame.seq, frame.ts, frame.nonce, hmac
        );
        let sig = frame.sig.as_ref().ok_or("Missing signature")?;
        if !Self::verify(sender_ed_pub, sign_data.as_bytes(), sig) {
            return Err("Invalid signature".into());
        }
        
        // 3. Verify HMAC
        let shared = Self::derive_shared_secret(my_x_priv, sender_x_pub);
        let session_key = Self::derive_session_key(&shared, b"opacus-session");
        let hmac_data = format!(
            "{:?}|{}|{}|{}|{}|{}|{}",
            frame.frame_type, frame.from, frame.to, frame.seq, frame.ts, 
            frame.nonce, hex::encode(&frame.payload)
        );
        if !Self::verify_hmac(&session_key, &hmac_data, hmac) {
            return Err("HMAC mismatch".into());
        }
        
        Ok(())
    }
}

impl Default for SecurityManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ecdh() {
        let (alice_priv, alice_pub) = KeyManager::generate_x25519();
        let (bob_priv, bob_pub) = KeyManager::generate_x25519();
        
        let alice_shared = SecurityManager::derive_shared_secret(
            &alice_priv.to_bytes(),
            &bob_pub.to_bytes()
        );
        let bob_shared = SecurityManager::derive_shared_secret(
            &bob_priv.to_bytes(),
            &alice_pub.to_bytes()
        );
        
        assert_eq!(alice_shared, bob_shared);
    }
    
    #[test]
    fn test_nonce_validation() {
        let mut sec = SecurityManager::new();
        let nonce = SecurityManager::generate_nonce();
        
        assert!(sec.validate_nonce(&nonce, 60000));
        assert!(!sec.validate_nonce(&nonce, 60000)); // Replay
    }
    
    #[test]
    fn test_signatures() {
        let (signing, verifying) = KeyManager::generate_ed25519();
        let message = b"Hello Opacus!";
        
        let sig = SecurityManager::sign(&signing.to_bytes(), message);
        assert!(SecurityManager::verify(verifying.as_bytes(), message, &sig));
    }
}
