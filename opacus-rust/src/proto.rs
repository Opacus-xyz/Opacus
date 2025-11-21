//! CBOR protocol codec

use serde_cbor;
use crate::types::OpacusFrame;

/// CBOR codec for binary frame serialization
pub struct CBORCodec;

impl CBORCodec {
    /// Encode frame to CBOR bytes
    /// 
    /// # Arguments
    /// * `frame` - Frame to encode
    /// 
    /// # Returns
    /// CBOR-encoded bytes
    pub fn encode(frame: &OpacusFrame) -> Result<Vec<u8>, serde_cbor::Error> {
        serde_cbor::to_vec(frame)
    }
    
    /// Decode CBOR bytes to frame
    /// 
    /// # Arguments
    /// * `data` - CBOR bytes
    /// 
    /// # Returns
    /// Decoded `OpacusFrame`
    pub fn decode(data: &[u8]) -> Result<OpacusFrame, serde_cbor::Error> {
        serde_cbor::from_slice(data)
    }
    
    /// Estimate encoded size (approximation)
    pub fn estimate_size(frame: &OpacusFrame) -> usize {
        // Rough estimate: headers ~100 bytes + payload
        100 + frame.payload.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FrameType;
    
    #[test]
    fn test_encode_decode() {
        let frame = OpacusFrame {
            version: 1,
            frame_type: FrameType::Msg,
            from: "alice".to_string(),
            to: "bob".to_string(),
            seq: 42,
            ts: 1234567890,
            nonce: "test-nonce".to_string(),
            payload: vec![1, 2, 3, 4, 5],
            hmac: Some("deadbeef".to_string()),
            sig: Some(vec![9, 8, 7, 6, 5]),
        };
        
        let encoded = CBORCodec::encode(&frame).unwrap();
        let decoded = CBORCodec::decode(&encoded).unwrap();
        
        assert_eq!(frame.version, decoded.version);
        assert_eq!(frame.from, decoded.from);
        assert_eq!(frame.to, decoded.to);
        assert_eq!(frame.payload, decoded.payload);
    }
}
