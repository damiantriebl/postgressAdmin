use crate::connection_profile::*;
use std::collections::HashMap;
use std::time::Duration;

/// Test command to create a sample connection profile and verify serialization
#[tauri::command]
pub async fn create_sample_connection_profile() -> Result<ConnectionProfile, String> {
    let config = AdvancedConnectionConfig {
        host: "localhost".to_string(),
        port: 5432,
        database: "testdb".to_string(),
        username: "testuser".to_string(),
        connection_timeout: Duration::from_secs(30),
        query_timeout: Duration::from_secs(300),
        max_connections: 10,
        idle_timeout: Duration::from_secs(300),
        retry_attempts: 3,
        retry_delay: Duration::from_secs(1),
        ssl_config: SSLConfig {
            mode: SSLMode::Prefer,
            cert: None,
            key: None,
            ca: None,
        },
        custom_parameters: HashMap::new(),
        connection_string_template: None,
    };

    let profile = ConnectionProfile::new("Sample Connection".to_string(), config);
    
    Ok(profile)
}

/// Test command to validate a connection profile
#[tauri::command]
pub async fn validate_connection_profile(profile: ConnectionProfile) -> Result<bool, String> {
    // Basic validation
    if profile.name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    
    if profile.config.host.is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    
    if profile.config.database.is_empty() {
        return Err("Database cannot be empty".to_string());
    }
    
    if profile.config.username.is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    
    if !(1..=65535).contains(&profile.config.port) {
        return Err("Port must be between 1 and 65535".to_string());
    }
    
    Ok(true)
}

/// Test command to demonstrate connection string generation
#[tauri::command]
pub async fn generate_connection_string(
    config: AdvancedConnectionConfig,
    password: String,
) -> Result<String, String> {
    Ok(config.to_connection_string(&password))
}

/// Test command to get default configuration
#[tauri::command]
pub async fn get_default_connection_config() -> Result<AdvancedConnectionConfig, String> {
    Ok(AdvancedConnectionConfig::default())
}

/// Test command to get all SSL modes
#[tauri::command]
pub async fn get_ssl_modes() -> Result<Vec<String>, String> {
    Ok(vec![
        SSLMode::Disable.to_string().to_string(),
        SSLMode::Allow.to_string().to_string(),
        SSLMode::Prefer.to_string().to_string(),
        SSLMode::Require.to_string().to_string(),
        SSLMode::VerifyCa.to_string().to_string(),
        SSLMode::VerifyFull.to_string().to_string(),
    ])
}

/// Test command to get all environments
#[tauri::command]
pub async fn get_environments() -> Result<Vec<String>, String> {
    Ok(vec![
        Environment::Development.to_string(),
        Environment::Staging.to_string(),
        Environment::Production.to_string(),
        Environment::Testing.to_string(),
        Environment::Other("custom".to_string()).to_string(),
    ])
}