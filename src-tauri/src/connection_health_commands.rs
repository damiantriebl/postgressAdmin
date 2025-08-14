use crate::connection_health_service::{
    ConnectionHealthService, ConnectionTestResult, ConnectionTestOptions,
    ConnectionValidationError,
};
use crate::connection_profile::{AdvancedConnectionConfig, ConnectionProfile, HealthCheckResult};
use crate::credential_vault::CredentialVault;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Test a connection configuration with password
#[tauri::command]
pub async fn test_connection_config(
    config: AdvancedConnectionConfig,
    password: String,
    options: Option<ConnectionTestOptions>,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<ConnectionTestResult, String> {
    let service = health_service.lock().await;
    let result = service.test_connection(&config, &password, options).await;
    Ok(result)
}

/// Test a connection profile (retrieves password from credential vault)
#[tauri::command]
pub async fn test_connection_profile(
    profile: ConnectionProfile,
    options: Option<ConnectionTestOptions>,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
    credential_vault: State<'_, Arc<Mutex<CredentialVault>>>,
) -> Result<ConnectionTestResult, String> {
    // Retrieve password from credential vault
    let vault = credential_vault.lock().await;
    let credentials = vault
        .retrieve_credentials(&profile.id)
        .await
        .map_err(|e| format!("Failed to retrieve credentials: {}", e))?;

    drop(vault); // Release the vault lock

    let service = health_service.lock().await;
    let result = service
        .test_profile_connection(&profile, &credentials.password, options)
        .await;
    Ok(result)
}

/// Test connection by profile ID
#[tauri::command]
pub async fn test_connection_by_profile_id(
    profile_id: String,
    options: Option<ConnectionTestOptions>,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
    credential_vault: State<'_, Arc<Mutex<CredentialVault>>>,
    profile_store: State<'_, Arc<Mutex<crate::connection_profile_store::ConnectionProfileStore>>>,
) -> Result<ConnectionTestResult, String> {
    // Get the profile from the store
    let store = profile_store.lock().await;
    let profile = store
        .get_profile(&profile_id)
        .await
        .map_err(|e| format!("Failed to get profile: {}", e))?;
    drop(store);

    // Retrieve password from credential vault
    let vault = credential_vault.lock().await;
    let credentials = vault
        .retrieve_credentials(&profile_id)
        .await
        .map_err(|e| format!("Failed to retrieve credentials: {}", e))?;
    drop(vault);

    let service = health_service.lock().await;
    let result = service
        .test_profile_connection(&profile, &credentials.password, options)
        .await;
    Ok(result)
}

/// Validate connection configuration parameters
#[tauri::command]
pub async fn validate_connection_config(
    config: AdvancedConnectionConfig,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<Vec<ConnectionValidationError>, String> {
    let service = health_service.lock().await;
    match service.validate_connection_config(&config) {
        Ok(()) => Ok(vec![]),
        Err(errors) => Ok(errors),
    }
}

/// Get health history for a profile
#[tauri::command]
pub async fn get_profile_health_history(
    profile_id: String,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<Vec<HealthCheckResult>, String> {
    let service = health_service.lock().await;
    let history = service.get_health_history(&profile_id).await;
    Ok(history)
}

/// Get current health status for a profile
#[tauri::command]
pub async fn get_profile_current_health(
    profile_id: String,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<Option<crate::connection_profile::ConnectionHealth>, String> {
    let service = health_service.lock().await;
    let health = service.get_current_health(&profile_id).await;
    Ok(health)
}

/// Calculate uptime percentage for a profile over a specified period
#[tauri::command]
pub async fn calculate_profile_uptime(
    profile_id: String,
    period_hours: u32,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<f64, String> {
    let service = health_service.lock().await;
    let uptime = service.calculate_uptime(&profile_id, period_hours).await;
    Ok(uptime)
}

/// Batch test multiple profiles
#[tauri::command]
pub async fn batch_test_profiles(
    profile_ids: Vec<String>,
    options: Option<ConnectionTestOptions>,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
    credential_vault: State<'_, Arc<Mutex<CredentialVault>>>,
    profile_store: State<'_, Arc<Mutex<crate::connection_profile_store::ConnectionProfileStore>>>,
) -> Result<Vec<(String, ConnectionTestResult)>, String> {
    let mut results = Vec::new();

    for profile_id in profile_ids {
        // Get the profile from the store
        let store = profile_store.lock().await;
        let profile_result = store.get_profile(&profile_id).await;
        drop(store);

        let profile = match profile_result {
            Ok(p) => p,
            Err(e) => {
                results.push((
                    profile_id.clone(),
                    ConnectionTestResult {
                        success: false,
                        response_time_ms: None,
                        error_message: Some(format!("Failed to get profile: {}", e)),
                        error_code: Some("PROFILE_NOT_FOUND".to_string()),
                        server_version: None,
                        database_name: None,
                        connection_details: None,
                        troubleshooting_hints: vec!["Check if the profile exists".to_string()],
                    },
                ));
                continue;
            }
        };

        // Retrieve password from credential vault
        let vault = credential_vault.lock().await;
        let credentials_result = vault.retrieve_credentials(&profile_id).await;
        drop(vault);

        let credentials = match credentials_result {
            Ok(c) => c,
            Err(e) => {
                results.push((
                    profile_id.clone(),
                    ConnectionTestResult {
                        success: false,
                        response_time_ms: None,
                        error_message: Some(format!("Failed to retrieve credentials: {}", e)),
                        error_code: Some("CREDENTIALS_NOT_FOUND".to_string()),
                        server_version: None,
                        database_name: None,
                        connection_details: None,
                        troubleshooting_hints: vec!["Check if credentials are stored for this profile".to_string()],
                    },
                ));
                continue;
            }
        };

        // Test the connection
        let service = health_service.lock().await;
        let result = service
            .test_profile_connection(&profile, &credentials.password, options.clone())
            .await;
        drop(service);

        results.push((profile_id, result));
    }

    Ok(results)
}

/// Quick connection test with minimal information
#[tauri::command]
pub async fn quick_connection_test(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
    health_service: State<'_, Arc<Mutex<ConnectionHealthService>>>,
) -> Result<ConnectionTestResult, String> {
    let config = AdvancedConnectionConfig {
        host,
        port,
        database,
        username,
        ..Default::default()
    };

    let options = ConnectionTestOptions {
        timeout_seconds: Some(10),
        retry_attempts: Some(1),
        retry_delay_ms: Some(500),
        validate_ssl: false,
        check_permissions: false,
        test_query: Some("SELECT 1".to_string()),
    };

    let service = health_service.lock().await;
    let result = service.test_connection(&config, &password, Some(options)).await;
    Ok(result)
}

/// Get connection troubleshooting suggestions based on error patterns
#[tauri::command]
pub async fn get_connection_troubleshooting_suggestions(
    error_message: String,
) -> Result<Vec<String>, String> {
    let error_lower = error_message.to_lowercase();
    let mut suggestions = Vec::new();

    if error_lower.contains("connection refused") {
        suggestions.extend(vec![
            "Check if PostgreSQL server is running".to_string(),
            "Verify the host and port are correct".to_string(),
            "Check firewall settings and network connectivity".to_string(),
            "Ensure PostgreSQL is configured to accept connections".to_string(),
        ]);
    } else if error_lower.contains("timeout") {
        suggestions.extend(vec![
            "Increase connection timeout value".to_string(),
            "Check network latency and stability".to_string(),
            "Verify server is not overloaded".to_string(),
            "Try connecting from a different network".to_string(),
        ]);
    } else if error_lower.contains("authentication") || error_lower.contains("password") {
        suggestions.extend(vec![
            "Verify username and password are correct".to_string(),
            "Check if user exists and has login permissions".to_string(),
            "Verify authentication method configuration".to_string(),
            "Check pg_hba.conf for connection rules".to_string(),
        ]);
    } else if error_lower.contains("database") && error_lower.contains("not exist") {
        suggestions.extend(vec![
            "Check if the database name is spelled correctly".to_string(),
            "Verify the database exists on the server".to_string(),
            "Check if you have permission to access this database".to_string(),
            "Try connecting to the 'postgres' database first".to_string(),
        ]);
    } else if error_lower.contains("ssl") {
        suggestions.extend(vec![
            "Check SSL configuration settings".to_string(),
            "Verify SSL certificates are valid and accessible".to_string(),
            "Try different SSL modes (disable, prefer, require)".to_string(),
            "Check server SSL configuration".to_string(),
        ]);
    } else {
        suggestions.extend(vec![
            "Check server logs for more detailed error information".to_string(),
            "Verify all connection parameters are correct".to_string(),
            "Try connecting with a different PostgreSQL client".to_string(),
            "Contact your database administrator for assistance".to_string(),
        ]);
    }

    Ok(suggestions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection_health_service::ConnectionHealthService;
    use crate::connection_profile::AdvancedConnectionConfig;

    #[tokio::test]
    async fn test_validate_connection_config_command() {
        let health_service = Arc::new(Mutex::new(ConnectionHealthService::new()));
        
        // Test valid config
        let valid_config = AdvancedConnectionConfig::default();
        let result = validate_connection_config(valid_config, tauri::State::from(&health_service)).await;
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert!(errors.is_empty());
        
        // Test invalid config
        let mut invalid_config = AdvancedConnectionConfig::default();
        invalid_config.host = "".to_string();
        let result = validate_connection_config(invalid_config, tauri::State::from(&health_service)).await;
        assert!(result.is_ok());
        let errors = result.unwrap();
        assert!(!errors.is_empty());
    }

    #[tokio::test]
    async fn test_troubleshooting_suggestions() {
        let suggestions = get_connection_troubleshooting_suggestions(
            "connection refused".to_string()
        ).await.unwrap();
        
        assert!(!suggestions.is_empty());
        assert!(suggestions.iter().any(|s| s.contains("PostgreSQL server is running")));
    }

    #[tokio::test]
    async fn test_quick_connection_test_validation() {
        let health_service = Arc::new(Mutex::new(ConnectionHealthService::new()));
        
        // Test with invalid parameters (empty host)
        let result = quick_connection_test(
            "".to_string(),
            5432,
            "test".to_string(),
            "user".to_string(),
            "pass".to_string(),
            tauri::State::from(&health_service)
        ).await;
        
        assert!(result.is_ok());
        let test_result = result.unwrap();
        assert!(!test_result.success);
        assert!(test_result.error_message.is_some());
    }
}