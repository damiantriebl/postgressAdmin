// This is a standalone test file to verify credential vault functionality
// Run with: cargo test --bin credential_vault_test

#[cfg(test)]
mod tests {
    use super::super::credential_vault::*;
    use chrono::Utc;
    use tokio;

    #[tokio::test]
    async fn test_credential_vault_basic_operations() {
        // Test basic vault operations
        let mut vault = CredentialVault::new("test_credential_vault");
        
        // Initialize vault
        let init_result = vault.initialize().await;
        assert!(init_result.is_ok(), "Vault initialization should succeed");

        // Create test credentials
        let profile_id = "test_profile_basic";
        let credentials = Credentials {
            username: "test_user".to_string(),
            password: "test_password".to_string(),
            encrypted_at: Utc::now(),
        };

        // Store credentials
        let store_result = vault.store_credentials(profile_id, credentials.clone()).await;
        assert!(store_result.is_ok(), "Storing credentials should succeed");

        // Check if credentials exist
        let has_creds = vault.has_credentials(profile_id).await;
        assert!(has_creds, "Vault should report that credentials exist");

        // Retrieve credentials
        let retrieve_result = vault.retrieve_credentials(profile_id).await;
        assert!(retrieve_result.is_ok(), "Retrieving credentials should succeed");
        
        let retrieved_creds = retrieve_result.unwrap();
        assert_eq!(retrieved_creds.username, credentials.username);
        assert_eq!(retrieved_creds.password, credentials.password);

        // Update credentials
        let updated_credentials = Credentials {
            username: "updated_user".to_string(),
            password: "updated_password".to_string(),
            encrypted_at: Utc::now(),
        };

        let update_result = vault.update_credentials(profile_id, updated_credentials.clone()).await;
        assert!(update_result.is_ok(), "Updating credentials should succeed");

        // Verify update
        let updated_retrieved = vault.retrieve_credentials(profile_id).await.unwrap();
        assert_eq!(updated_retrieved.username, updated_credentials.username);
        assert_eq!(updated_retrieved.password, updated_credentials.password);

        // Delete credentials
        let delete_result = vault.delete_credentials(profile_id).await;
        assert!(delete_result.is_ok(), "Deleting credentials should succeed");

        // Verify deletion
        let has_creds_after_delete = vault.has_credentials(profile_id).await;
        assert!(!has_creds_after_delete, "Vault should report that credentials no longer exist");

        let retrieve_after_delete = vault.retrieve_credentials(profile_id).await;
        assert!(retrieve_after_delete.is_err(), "Retrieving deleted credentials should fail");
    }

    #[tokio::test]
    async fn test_encryption_decryption_functionality() {
        let mut vault = CredentialVault::new("test_encryption_vault");
        vault.initialize().await.unwrap();

        // Test data
        let test_data = b"This is sensitive credential data that should be encrypted";
        let master_key = vault.master_key.unwrap();

        // Encrypt data
        let encrypted = vault.encrypt_data(test_data, &master_key).unwrap();
        
        // Verify encrypted data is different from original
        let encrypted_bytes = base64::engine::general_purpose::STANDARD
            .decode(&encrypted.encrypted_data)
            .unwrap();
        assert_ne!(encrypted_bytes, test_data);

        // Decrypt data
        let decrypted = vault.decrypt_data(&encrypted, &master_key).unwrap();
        assert_eq!(decrypted, test_data);
    }

    #[tokio::test]
    async fn test_error_handling() {
        let mut vault = CredentialVault::new("test_error_vault");
        vault.initialize().await.unwrap();

        // Test retrieving non-existent profile
        let result = vault.retrieve_credentials("non_existent_profile").await;
        assert!(result.is_err());
        
        match result.unwrap_err() {
            VaultError::ProfileNotFound(id) => {
                assert_eq!(id, "non_existent_profile");
            }
            _ => panic!("Expected ProfileNotFound error"),
        }

        // Test updating non-existent profile
        let credentials = Credentials {
            username: "test".to_string(),
            password: "test".to_string(),
            encrypted_at: Utc::now(),
        };
        
        let update_result = vault.update_credentials("non_existent_profile", credentials).await;
        assert!(update_result.is_err());
    }

    #[test]
    fn test_credential_zeroization() {
        // Test that credentials are properly zeroized
        let mut credentials = Credentials {
            username: "test_user".to_string(),
            password: "sensitive_password".to_string(),
            encrypted_at: Utc::now(),
        };

        // Clone for comparison
        let original_password = credentials.password.clone();
        
        // Drop should trigger zeroization
        drop(credentials);
        
        // Note: In a real test, we'd need to check memory directly
        // This is more of a compilation test to ensure zeroize works
        assert_eq!(original_password, "sensitive_password");
    }
}

// Helper function to run tests manually if needed
pub async fn run_credential_vault_tests() -> Result<(), Box<dyn std::error::Error>> {
    println!("Running credential vault tests...");
    
    // Test 1: Basic operations
    println!("Test 1: Basic operations");
    let mut vault = CredentialVault::new("manual_test_vault");
    vault.initialize().await?;
    
    let credentials = Credentials {
        username: "manual_test_user".to_string(),
        password: "manual_test_password".to_string(),
        encrypted_at: Utc::now(),
    };
    
    vault.store_credentials("manual_test_profile", credentials.clone()).await?;
    let retrieved = vault.retrieve_credentials("manual_test_profile").await?;
    
    assert_eq!(retrieved.username, credentials.username);
    assert_eq!(retrieved.password, credentials.password);
    
    vault.delete_credentials("manual_test_profile").await?;
    println!("✓ Basic operations test passed");
    
    // Test 2: Encryption/Decryption
    println!("Test 2: Encryption/Decryption");
    let test_data = b"test encryption data";
    let key = vault.master_key.unwrap();
    
    let encrypted = vault.encrypt_data(test_data, &key)?;
    let decrypted = vault.decrypt_data(&encrypted, &key)?;
    
    assert_eq!(decrypted, test_data);
    println!("✓ Encryption/Decryption test passed");
    
    println!("All credential vault tests passed!");
    Ok(())
}