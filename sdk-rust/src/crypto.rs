use secp256k1::{ecdh::SharedSecret, PublicKey, Secp256k1, SecretKey};
use sha2::{Digest, Sha256};
use hkdf::Hkdf;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

use crate::error::{H3DACError, Result};

/// Generate a new random private key
pub fn generate_private_key() -> SecretKey {
    let secp = Secp256k1::new();
    SecretKey::new(&mut rand::thread_rng())
}

/// Get public key from private key
pub fn get_public_key(private_key: &SecretKey) -> PublicKey {
    let secp = Secp256k1::new();
    PublicKey::from_secret_key(&secp, private_key)
}

/// Sign a message with private key
pub fn sign_message(message: &[u8], private_key: &SecretKey) -> Result<Vec<u8>> {
    let secp = Secp256k1::new();
    let hash = hash_data(message);
    let message = secp256k1::Message::from_digest_slice(&hash)
        .map_err(|e| H3DACError::CryptoError(format!("Invalid message: {}", e)))?;
    
    let signature = secp.sign_ecdsa(&message, private_key);
    Ok(signature.serialize_compact().to_vec())
}

/// Verify a signature
pub fn verify_signature(
    message: &[u8],
    signature: &[u8],
    public_key: &PublicKey,
) -> Result<bool> {
    let secp = Secp256k1::new();
    let hash = hash_data(message);
    let message = secp256k1::Message::from_digest_slice(&hash)
        .map_err(|e| H3DACError::CryptoError(format!("Invalid message: {}", e)))?;
    
    let sig = secp256k1::ecdsa::Signature::from_compact(signature)
        .map_err(|e| H3DACError::CryptoError(format!("Invalid signature: {}", e)))?;
    
    Ok(secp.verify_ecdsa(&message, &sig, public_key).is_ok())
}

/// Derive shared secret using ECDH
pub fn derive_shared_secret(
    private_key: &SecretKey,
    public_key: &PublicKey,
) -> Result<Vec<u8>> {
    let shared = SharedSecret::new(public_key, private_key);
    Ok(shared.secret_bytes().to_vec())
}

/// Derive session key from shared secret using HKDF
pub fn derive_session_key(shared_secret: &[u8]) -> Result<Vec<u8>> {
    let hk = Hkdf::<Sha256>::new(None, shared_secret);
    let mut session_key = vec![0u8; 32];
    hk.expand(b"H3DAC", &mut session_key)
        .map_err(|e| H3DACError::CryptoError(format!("HKDF failed: {}", e)))?;
    Ok(session_key)
}

/// Encrypt payload with AES-GCM
pub fn encrypt_payload(payload: &[u8], session_key: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
    if session_key.len() != 32 {
        return Err(H3DACError::CryptoError(
            "Session key must be 32 bytes".to_string(),
        ));
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(session_key);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let encrypted = cipher
        .encrypt(nonce, payload)
        .map_err(|e| H3DACError::CryptoError(format!("Encryption failed: {}", e)))?;

    Ok((encrypted, nonce_bytes.to_vec()))
}

/// Decrypt payload with AES-GCM
pub fn decrypt_payload(
    encrypted: &[u8],
    session_key: &[u8],
    nonce: &[u8],
) -> Result<Vec<u8>> {
    if session_key.len() != 32 {
        return Err(H3DACError::CryptoError(
            "Session key must be 32 bytes".to_string(),
        ));
    }

    if nonce.len() != 12 {
        return Err(H3DACError::CryptoError(
            "Nonce must be 12 bytes".to_string(),
        ));
    }

    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(session_key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce);

    let decrypted = cipher
        .decrypt(nonce, encrypted)
        .map_err(|e| H3DACError::CryptoError(format!("Decryption failed: {}", e)))?;

    Ok(decrypted)
}

/// Generate a random nonce
pub fn generate_nonce() -> String {
    let mut nonce = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce);
    hex::encode(nonce)
}

/// Hash data with SHA256
pub fn hash_data(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let private_key = generate_private_key();
        let public_key = get_public_key(&private_key);
        assert_eq!(public_key.serialize().len(), 33);
    }

    #[test]
    fn test_sign_verify() {
        let private_key = generate_private_key();
        let public_key = get_public_key(&private_key);
        let message = b"test message";

        let signature = sign_message(message, &private_key).unwrap();
        let valid = verify_signature(message, &signature, &public_key).unwrap();
        assert!(valid);
    }

    #[test]
    fn test_shared_secret() {
        let private1 = generate_private_key();
        let public1 = get_public_key(&private1);

        let private2 = generate_private_key();
        let public2 = get_public_key(&private2);

        let shared1 = derive_shared_secret(&private1, &public2).unwrap();
        let shared2 = derive_shared_secret(&private2, &public1).unwrap();

        assert_eq!(shared1, shared2);
    }

    #[test]
    fn test_encryption() {
        let session_key = vec![0u8; 32];
        let payload = b"secret message";

        let (encrypted, nonce) = encrypt_payload(payload, &session_key).unwrap();
        let decrypted = decrypt_payload(&encrypted, &session_key, &nonce).unwrap();

        assert_eq!(payload.to_vec(), decrypted);
    }
}
