use thiserror::Error;

pub type Result<T> = std::result::Result<T, H3DACError>;

#[derive(Error, Debug)]
pub enum H3DACError {
    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Session expired")]
    SessionExpired,

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

impl From<reqwest::Error> for H3DACError {
    fn from(err: reqwest::Error) -> Self {
        H3DACError::HttpError(err.to_string())
    }
}

impl From<serde_json::Error> for H3DACError {
    fn from(err: serde_json::Error) -> Self {
        H3DACError::SerializationError(err.to_string())
    }
}
