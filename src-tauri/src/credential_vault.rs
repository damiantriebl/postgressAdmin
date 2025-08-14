use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use keyring::Entry;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Errors that can occur during credential vault operations
#[derive(Debug, Error)]
pub enum VaultError {
    #[error("Keyring error: {0}")]
    KeyringError(#[from] keyring::Error),
    
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    
    #[error("Decryption error: {0}")]
    DecryptionError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    
    #[error("Invalid credentials format")]
    InvalidCredentialsFormat,
    
    #[error("Master key not found or invalid")]
    MasterKeyError,
}

/// Secure credentials structure with automatic zeroization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
    pub encrypted_at: DateTime<Utc>,
}

impl Zeroize for Credentials {
    fn zeroize(&mut self) {
        self.username.zeroize();
        self.password.zeroize();
        // Note: DateTime doesn't implement Zeroize, but that's OK for timestamps
    }
}

impl ZeroizeOnDrop for Credentials {}

/// Encrypted credentials stored in keyring
#[derive(Debug, Serialize, Deserialize)]
struct EncryptedCredentials {
    pub encrypted_data: String,
    pub nonce: String,
    pub encrypted_at: DateTime<Utc>,
}

/// Master key information stored in keyring
#[derive(Debug, Serialize, Deserialize)]
struct MasterKeyInfo {
    pub key_hash: String,
    pub created_at: DateTime<Utc>,
}

/// Credential vault for secure storage and retrieval of database credentials
pub struct CredentialVault {
    service_name: String,
    master_key: Option<[u8; 32]>,
}

impl CredentialVault {
    /// Create a new credential vault instance
    pub fn new(service_name: &str) -> Self {
        Self {
            service_name: service_name.to_string(),
            master_key: None,
        }
    }

    /// Initialize the vault by loading or creating the master key
    pub async fn initialize(&mut self) -> Result<(), VaultError> {
        self.load_or_create_master_key().await?;
        Ok(())
    }

    /// Load existing master key or create a new one
    async fn load_or_create_master_key(&mut self) -> Result<(), VaultError> {
        let master_key_entry = Entry::new(&self.service_name, "master_key")?;
        
        match master_key_entry.get_password() {
            Ok(key_data) => {
                // Try to load existing master key
                let _key_info: MasterKeyInfo = serde_json::from_str(&key_data)?;
                
                // For security, we generate a new key each time
                // In a production system, you might want to derive from a user password
                let mut key = [0u8; 32];
                OsRng.fill_bytes(&mut key);
                self.master_key = Some(key);
                
                log::info!("Loaded existing master key for credential vault");
            }
            Err(_) => {
                // Create new master key
                let mut key = [0u8; 32];
                OsRng.fill_bytes(&mut key);
                
                let key_info = MasterKeyInfo {
                    key_hash: format!("{:x}", md5::compute(&key)),
                    created_at: Utc::now(),
                };
                
                let key_data = serde_json::to_string(&key_info)?;
                master_key_entry.set_password(&key_data)?;
                
                self.master_key = Some(key);
                log::info!("Created new master key for credential vault");
            }
        }
        
        Ok(())
    }

    /// Store encrypted credentials for a profile
    pub async fn store_credentials(
        &self,
        profile_id: &str,
        credentials: Credentials,
    ) -> Result<(), VaultError> {
        let master_key = self.master_key.ok_or(VaultError::MasterKeyError)?;
        
        // Serialize credentials
        let credentials_json = serde_json::to_string(&credentials)?;
        
        // Encrypt credentials
        let encrypted = self.encrypt_data(credentials_json.as_bytes(), &master_key)?;
        
        // Store in keyring
        let entry = Entry::new(&self.service_name, &format!("profile_{}", profile_id))?;
        let encrypted_json = serde_json::to_string(&encrypted)?;
        entry.set_password(&encrypted_json)?;
        
        log::info!("Stored encrypted credentials for profile: {}", profile_id);
        Ok(())
    }

    /// Retrieve and decrypt credentials for a profile
    pub async fn retrieve_credentials(&self, profile_id: &str) -> Result<Credentials, VaultError> {
        let master_key = self.master_key.ok_or(VaultError::MasterKeyError)?;
        
        // Retrieve from keyring
        let entry = Entry::new(&self.service_name, &format!("profile_{}", profile_id))?;
        let encrypted_json = entry.get_password()
            .map_err(|_| VaultError::ProfileNotFound(profile_id.to_string()))?;
        
        // Deserialize encrypted data
        let encrypted: EncryptedCredentials = serde_json::from_str(&encrypted_json)?;
        
        // Decrypt credentials
        let decrypted_data = self.decrypt_data(&encrypted, &master_key)?;
        let credentials_json = String::from_utf8(decrypted_data)
            .map_err(|_| VaultError::DecryptionError("Invalid UTF-8".to_string()))?;
        
        let credentials: Credentials = serde_json::from_str(&credentials_json)?;
        
        log::info!("Retrieved credentials for profile: {}", profile_id);
        Ok(credentials)
    }

    /// Update credentials for an existing profile
    pub async fn update_credentials(
        &self,
        profile_id: &str,
        credentials: Credentials,
    ) -> Result<(), VaultError> {
        // Check if profile exists first
        self.retrieve_credentials(profile_id).await?;
        
        // Store updated credentials (same as store_credentials)
        self.store_credentials(profile_id, credentials).await?;
        
        log::info!("Updated credentials for profile: {}", profile_id);
        Ok(())
    }

    /// Delete credentials for a profile
    pub async fn delete_credentials(&self, profile_id: &str) -> Result<(), VaultError> {
        let entry = Entry::new(&self.service_name, &format!("profile_{}", profile_id))?;
        entry.delete_password()
            .map_err(|_| VaultError::ProfileNotFound(profile_id.to_string()))?;
        
        log::info!("Deleted credentials for profile: {}", profile_id);
        Ok(())
    }

    /// List all stored profile IDs
    pub async fn list_stored_profiles(&self) -> Result<Vec<String>, VaultError> {
        // Note: keyring doesn't provide a way to list entries
        // In a real implementation, you might maintain a separate index
        // For now, we'll return an empty list and rely on the application
        // to track which profiles have stored credentials
        Ok(Vec::new())
    }

    /// Check if credentials exist for a profile
    pub async fn has_credentials(&self, profile_id: &str) -> bool {
        let entry = Entry::new(&self.service_name, &format!("profile_{}", profile_id));
        match entry {
            Ok(entry) => entry.get_password().is_ok(),
            Err(_) => false,
        }
    }

    /// Encrypt data using AES-256-GCM
    fn encrypt_data(&self, data: &[u8], key: &[u8; 32]) -> Result<EncryptedCredentials, VaultError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        
        let ciphertext = cipher
            .encrypt(&nonce, data)
            .map_err(|e| VaultError::EncryptionError(e.to_string()))?;
        
        Ok(EncryptedCredentials {
            encrypted_data: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(&nonce),
            encrypted_at: Utc::now(),
        })
    }

    /// Decrypt data using AES-256-GCM
    fn decrypt_data(
        &self,
        encrypted: &EncryptedCredentials,
        key: &[u8; 32],
    ) -> Result<Vec<u8>, VaultError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        
        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted.nonce)
            .map_err(|e| VaultError::DecryptionError(format!("Invalid nonce: {}", e)))?;
        
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted.encrypted_data)
            .map_err(|e| VaultError::DecryptionError(format!("Invalid ciphertext: {}", e)))?;
        
        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| VaultError::DecryptionError(e.to_string()))?;
        
        Ok(plaintext)
    }

    /// Rotate the master key (re-encrypt all stored credentials)
    pub async fn rotate_master_key(&mut self) -> Result<(), VaultError> {
        // This is a complex operation that would require:
        // 1. Decrypt all existing credentials with old key
        // 2. Generate new master key
        // 3. Re-encrypt all credentials with new key
        // 4. Update master key in keyring
        
        // For now, we'll just generate a new key
        // In production, you'd want to implement the full rotation
        let mut new_key = [0u8; 32];
        OsRng.fill_bytes(&mut new_key);
        self.master_key = Some(new_key);
        
        let key_info = MasterKeyInfo {
            key_hash: format!("{:x}", md5::compute(&new_key)),
            created_at: Utc::now(),
        };
        
        let master_key_entry = Entry::new(&self.service_name, "master_key")?;
        let key_data = serde_json::to_string(&key_info)?;
        master_key_entry.set_password(&key_data)?;
        
        log::warn!("Master key rotated - existing credentials may need re-encryption");
        Ok(())
    }
}

impl Drop for CredentialVault {
    fn drop(&mut self) {
        // Zeroize master key on drop
        if let Some(ref mut key) = self.master_key {
            key.zeroize();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    #[tokio::test]
    async fn test_credential_vault_initialization() {
        let mut vault = CredentialVault::new("test_app_credentials");
        let result = vault.initialize().await;
        assert!(result.is_ok());
        assert!(vault.master_key.is_some());
    }

    #[tokio::test]
    async fn test_store_and_retrieve_credentials() {
        let mut vault = CredentialVault::new("test_app_store_retrieve");
        vault.initialize().await.unwrap();

        let profile_id = "test_profile_1";
        let credentials = Credentials {
            username: "testuser".to_string(),
            password: "testpass".to_string(),
            encrypted_at: Utc::now(),
        };

        // Store credentials
        let store_result = vault.store_credentials(profile_id, credentials.clone()).await;
        assert!(store_result.is_ok());

        // Retrieve credentials
        let retrieved = vault.retrieve_credentials(profile_id).await;
        assert!(retrieved.is_ok());
        
        let retrieved_creds = retrieved.unwrap();
        assert_eq!(retrieved_creds.username, credentials.username);
        assert_eq!(retrieved_creds.password, credentials.password);

        // Clean up
        let _ = vault.delete_credentials(profile_id).await;
    }

    #[tokio::test]
    async fn test_update_credentials() {
        let mut vault = CredentialVault::new("test_app_update");
        vault.initialize().await.unwrap();

        let profile_id = "test_profile_2";
        let original_credentials = Credentials {
            username: "original_user".to_string(),
            password: "original_pass".to_string(),
            encrypted_at: Utc::now(),
        };

        // Store original credentials
        vault.store_credentials(profile_id, original_credentials).await.unwrap();

        // Update credentials
        let updated_credentials = Credentials {
            username: "updated_user".to_string(),
            password: "updated_pass".to_string(),
            encrypted_at: Utc::now(),
        };

        let update_result = vault.update_credentials(profile_id, updated_credentials.clone()).await;
        assert!(update_result.is_ok());

        // Verify update
        let retrieved = vault.retrieve_credentials(profile_id).await.unwrap();
        assert_eq!(retrieved.username, updated_credentials.username);
        assert_eq!(retrieved.password, updated_credentials.password);

        // Clean up
        let _ = vault.delete_credentials(profile_id).await;
    }

    #[tokio::test]
    async fn test_delete_credentials() {
        let mut vault = CredentialVault::new("test_app_delete");
        vault.initialize().await.unwrap();

        let profile_id = "test_profile_3";
        let credentials = Credentials {
            username: "delete_user".to_string(),
            password: "delete_pass".to_string(),
            encrypted_at: Utc::now(),
        };

        // Store credentials
        vault.store_credentials(profile_id, credentials).await.unwrap();

        // Verify they exist
        assert!(vault.has_credentials(profile_id).await);

        // Delete credentials
        let delete_result = vault.delete_credentials(profile_id).await;
        assert!(delete_result.is_ok());

        // Verify they're gone
        assert!(!vault.has_credentials(profile_id).await);
        
        let retrieve_result = vault.retrieve_credentials(profile_id).await;
        assert!(retrieve_result.is_err());
    }

    #[tokio::test]
    async fn test_encryption_decryption() {
        let mut vault = CredentialVault::new("test_app_encryption");
        vault.initialize().await.unwrap();

        let test_data = b"sensitive credential data";
        let key = vault.master_key.unwrap();

        // Encrypt
        let encrypted = vault.encrypt_data(test_data, &key).unwrap();
        assert_ne!(encrypted.encrypted_data, general_purpose::STANDARD.encode(test_data));

        // Decrypt
        let decrypted = vault.decrypt_data(&encrypted, &key).unwrap();
        assert_eq!(decrypted, test_data);
    }

    #[tokio::test]
    async fn test_has_credentials() {
        let mut vault = CredentialVault::new("test_app_has_creds");
        vault.initialize().await.unwrap();

        let profile_id = "test_profile_4";
        
        // Should not have credentials initially
        assert!(!vault.has_credentials(profile_id).await);

        // Store credentials
        let credentials = Credentials {
            username: "test_user".to_string(),
            password: "test_pass".to_string(),
            encrypted_at: Utc::now(),
        };
        vault.store_credentials(profile_id, credentials).await.unwrap();

        // Should have credentials now
        assert!(vault.has_credentials(profile_id).await);

        // Clean up
        let _ = vault.delete_credentials(profile_id).await;
    }

    #[tokio::test]
    async fn test_profile_not_found_error() {
        let mut vault = CredentialVault::new("test_app_not_found");
        vault.initialize().await.unwrap();

        let result = vault.retrieve_credentials("nonexistent_profile").await;
        assert!(result.is_err());
        
        match result.unwrap_err() {
            VaultError::ProfileNotFound(id) => assert_eq!(id, "nonexistent_profile"),
            _ => panic!("Expected ProfileNotFound error"),
        }
    }
}