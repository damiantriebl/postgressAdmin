use crate::credential_vault::{CredentialVault, Credentials, VaultError};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Shared credential vault state
pub type CredentialVaultState = Arc<Mutex<CredentialVault>>;

/// Response for credential operations
#[derive(Debug, Serialize, Deserialize)]
pub struct CredentialResponse {
    pub success: bool,
    pub message: String,
}

/// Request for storing credentials
#[derive(Debug, Serialize, Deserialize)]
pub struct StoreCredentialsRequest {
    pub profile_id: String,
    pub username: String,
    pub password: String,
}

/// Response for retrieving credentials
#[derive(Debug, Serialize, Deserialize)]
pub struct RetrieveCredentialsResponse {
    pub success: bool,
    pub username: Option<String>,
    pub password: Option<String>,
    pub message: String,
    pub encrypted_at: Option<String>,
}

/// Initialize the credential vault
#[tauri::command]
pub async fn initialize_credential_vault(
    vault_state: State<'_, CredentialVaultState>,
) -> Result<CredentialResponse, String> {
    let mut vault = vault_state.lock().await;
    
    match vault.initialize().await {
        Ok(_) => {
            log::info!("Credential vault initialized successfully");
            Ok(CredentialResponse {
                success: true,
                message: "Credential vault initialized successfully".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to initialize credential vault: {}", e);
            Err(format!("Failed to initialize credential vault: {}", e))
        }
    }
}

/// Store credentials for a connection profile
#[tauri::command]
pub async fn store_profile_credentials(
    vault_state: State<'_, CredentialVaultState>,
    request: StoreCredentialsRequest,
) -> Result<CredentialResponse, String> {
    let vault = vault_state.lock().await;
    
    let credentials = Credentials {
        username: request.username,
        password: request.password,
        encrypted_at: Utc::now(),
    };
    
    match vault.store_credentials(&request.profile_id, credentials).await {
        Ok(_) => {
            log::info!("Stored credentials for profile: {}", request.profile_id);
            Ok(CredentialResponse {
                success: true,
                message: "Credentials stored successfully".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to store credentials for profile {}: {}", request.profile_id, e);
            Err(format!("Failed to store credentials: {}", e))
        }
    }
}

/// Retrieve credentials for a connection profile
#[tauri::command]
pub async fn retrieve_profile_credentials(
    vault_state: State<'_, CredentialVaultState>,
    profile_id: String,
) -> Result<RetrieveCredentialsResponse, String> {
    let vault = vault_state.lock().await;
    
    match vault.retrieve_credentials(&profile_id).await {
        Ok(credentials) => {
            log::info!("Retrieved credentials for profile: {}", profile_id);
            Ok(RetrieveCredentialsResponse {
                success: true,
                username: Some(credentials.username.clone()),
                password: Some(credentials.password.clone()),
                message: "Credentials retrieved successfully".to_string(),
                encrypted_at: Some(credentials.encrypted_at.to_rfc3339()),
            })
        }
        Err(VaultError::ProfileNotFound(_)) => {
            Ok(RetrieveCredentialsResponse {
                success: false,
                username: None,
                password: None,
                message: "No credentials found for this profile".to_string(),
                encrypted_at: None,
            })
        }
        Err(e) => {
            log::error!("Failed to retrieve credentials for profile {}: {}", profile_id, e);
            Err(format!("Failed to retrieve credentials: {}", e))
        }
    }
}

/// Update credentials for a connection profile
#[tauri::command]
pub async fn update_profile_credentials(
    vault_state: State<'_, CredentialVaultState>,
    request: StoreCredentialsRequest,
) -> Result<CredentialResponse, String> {
    let vault = vault_state.lock().await;
    
    let credentials = Credentials {
        username: request.username,
        password: request.password,
        encrypted_at: Utc::now(),
    };
    
    match vault.update_credentials(&request.profile_id, credentials).await {
        Ok(_) => {
            log::info!("Updated credentials for profile: {}", request.profile_id);
            Ok(CredentialResponse {
                success: true,
                message: "Credentials updated successfully".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to update credentials for profile {}: {}", request.profile_id, e);
            Err(format!("Failed to update credentials: {}", e))
        }
    }
}

/// Delete credentials for a connection profile
#[tauri::command]
pub async fn delete_profile_credentials(
    vault_state: State<'_, CredentialVaultState>,
    profile_id: String,
) -> Result<CredentialResponse, String> {
    let vault = vault_state.lock().await;
    
    match vault.delete_credentials(&profile_id).await {
        Ok(_) => {
            log::info!("Deleted credentials for profile: {}", profile_id);
            Ok(CredentialResponse {
                success: true,
                message: "Credentials deleted successfully".to_string(),
            })
        }
        Err(VaultError::ProfileNotFound(_)) => {
            Ok(CredentialResponse {
                success: false,
                message: "No credentials found for this profile".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to delete credentials for profile {}: {}", profile_id, e);
            Err(format!("Failed to delete credentials: {}", e))
        }
    }
}

/// Check if credentials exist for a connection profile
#[tauri::command]
pub async fn has_profile_credentials(
    vault_state: State<'_, CredentialVaultState>,
    profile_id: String,
) -> Result<bool, String> {
    let vault = vault_state.lock().await;
    
    let has_credentials = vault.has_credentials(&profile_id).await;
    log::debug!("Profile {} has credentials: {}", profile_id, has_credentials);
    
    Ok(has_credentials)
}

/// List all profiles that have stored credentials
#[tauri::command]
pub async fn list_profiles_with_credentials(
    vault_state: State<'_, CredentialVaultState>,
) -> Result<Vec<String>, String> {
    let vault = vault_state.lock().await;
    
    match vault.list_stored_profiles().await {
        Ok(profiles) => {
            log::info!("Listed {} profiles with stored credentials", profiles.len());
            Ok(profiles)
        }
        Err(e) => {
            log::error!("Failed to list profiles with credentials: {}", e);
            Err(format!("Failed to list profiles: {}", e))
        }
    }
}

/// Rotate the master encryption key
#[tauri::command]
pub async fn rotate_vault_master_key(
    vault_state: State<'_, CredentialVaultState>,
) -> Result<CredentialResponse, String> {
    let mut vault = vault_state.lock().await;
    
    match vault.rotate_master_key().await {
        Ok(_) => {
            log::warn!("Master key rotated successfully");
            Ok(CredentialResponse {
                success: true,
                message: "Master key rotated successfully. Existing credentials may need re-encryption.".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to rotate master key: {}", e);
            Err(format!("Failed to rotate master key: {}", e))
        }
    }
}