use crate::connection_profile::{
    AdvancedConnectionConfig, ConnectionHealth, HealthCheckResult, HealthStatus,
    ConnectionProfile, PoolStats, ConnectionMetrics
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tokio_postgres::{Client, NoTls, Error as PostgresError};

/// Connection testing and validation service
pub struct ConnectionHealthService {
    /// History of health checks for each profile
    health_history: Arc<Mutex<HashMap<String, Vec<HealthCheckResult>>>>,
    /// Active monitoring tasks
    monitoring_tasks: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

/// Connection test result with detailed information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
    pub error_code: Option<String>,
    pub server_version: Option<String>,
    pub database_name: Option<String>,
    pub connection_details: Option<ConnectionDetails>,
    pub troubleshooting_hints: Vec<String>,
}

/// Detailed connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionDetails {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub ssl_used: bool,
    pub server_encoding: Option<String>,
    pub client_encoding: Option<String>,
}

/// Connection validation errors with specific error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectionValidationError {
    InvalidHost(String),
    InvalidPort(String),
    InvalidDatabase(String),
    InvalidUsername(String),
    InvalidSSLConfig(String),
    InvalidTimeout(String),
    InvalidCustomParameter(String, String),
}

/// Connection test options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestOptions {
    pub timeout_seconds: Option<u32>,
    pub retry_attempts: Option<u32>,
    pub retry_delay_ms: Option<u64>,
    pub validate_ssl: bool,
    pub check_permissions: bool,
    pub test_query: Option<String>,
}

impl Default for ConnectionTestOptions {
    fn default() -> Self {
        Self {
            timeout_seconds: Some(30),
            retry_attempts: Some(3),
            retry_delay_ms: Some(1000),
            validate_ssl: true,
            check_permissions: false,
            test_query: Some("SELECT 1".to_string()),
        }
    }
}

impl ConnectionHealthService {
    /// Create a new connection health service
    pub fn new() -> Self {
        Self {
            health_history: Arc::new(Mutex::new(HashMap::new())),
            monitoring_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Test a connection with comprehensive validation
    pub async fn test_connection(
        &self,
        config: &AdvancedConnectionConfig,
        password: &str,
        options: Option<ConnectionTestOptions>,
    ) -> ConnectionTestResult {
        let options = options.unwrap_or_default();
        let start_time = Instant::now();

        // First validate the configuration
        if let Err(validation_errors) = self.validate_connection_config(config) {
            return ConnectionTestResult {
                success: false,
                response_time_ms: Some(start_time.elapsed().as_millis() as u64),
                error_message: Some(format!("Configuration validation failed: {:?}", validation_errors)),
                error_code: Some("VALIDATION_ERROR".to_string()),
                server_version: None,
                database_name: None,
                connection_details: None,
                troubleshooting_hints: self.generate_validation_hints(&validation_errors),
            };
        }

        // Attempt connection with retries
        let retry_attempts = options.retry_attempts.unwrap_or(3);
        let retry_delay = Duration::from_millis(options.retry_delay_ms.unwrap_or(1000));

        for attempt in 1..=retry_attempts {
            match self.attempt_connection(config, password, &options).await {
                Ok(result) => {
                    let response_time = start_time.elapsed().as_millis() as u64;
                    return ConnectionTestResult {
                        success: true,
                        response_time_ms: Some(response_time),
                        error_message: None,
                        error_code: None,
                        server_version: result.server_version,
                        database_name: Some(config.database.clone()),
                        connection_details: Some(result.connection_details),
                        troubleshooting_hints: vec![],
                    };
                }
                Err(e) => {
                    if attempt < retry_attempts {
                        tokio::time::sleep(retry_delay).await;
                        continue;
                    }

                    let response_time = start_time.elapsed().as_millis() as u64;
                    let (error_code, troubleshooting_hints) = self.analyze_connection_error(&e);

                    return ConnectionTestResult {
                        success: false,
                        response_time_ms: Some(response_time),
                        error_message: Some(e.to_string()),
                        error_code: Some(error_code),
                        server_version: None,
                        database_name: Some(config.database.clone()),
                        connection_details: None,
                        troubleshooting_hints,
                    };
                }
            }
        }

        // This should never be reached, but just in case
        ConnectionTestResult {
            success: false,
            response_time_ms: Some(start_time.elapsed().as_millis() as u64),
            error_message: Some("Unknown error occurred".to_string()),
            error_code: Some("UNKNOWN_ERROR".to_string()),
            server_version: None,
            database_name: None,
            connection_details: None,
            troubleshooting_hints: vec!["Please check your connection parameters and try again.".to_string()],
        }
    }

    /// Test connection for a profile
    pub async fn test_profile_connection(
        &self,
        profile: &ConnectionProfile,
        password: &str,
        options: Option<ConnectionTestOptions>,
    ) -> ConnectionTestResult {
        let result = self.test_connection(&profile.config, password, options).await;
        
        // Store the result in health history
        let health_result = HealthCheckResult {
            timestamp: Utc::now(),
            status: if result.success { HealthStatus::Healthy } else { HealthStatus::Error },
            response_time_ms: result.response_time_ms,
            error_message: result.error_message.clone(),
        };

        let mut history = self.health_history.lock().await;
        let profile_history = history.entry(profile.id.clone()).or_insert_with(Vec::new);
        profile_history.push(health_result);

        // Keep only the last 100 results
        if profile_history.len() > 100 {
            profile_history.drain(0..profile_history.len() - 100);
        }

        result
    }

    /// Validate connection configuration parameters
    pub fn validate_connection_config(
        &self,
        config: &AdvancedConnectionConfig,
    ) -> Result<(), Vec<ConnectionValidationError>> {
        let mut errors = Vec::new();

        // Validate host
        if config.host.trim().is_empty() {
            errors.push(ConnectionValidationError::InvalidHost(
                "Host cannot be empty".to_string(),
            ));
        } else if config.host.len() > 255 {
            errors.push(ConnectionValidationError::InvalidHost(
                "Host name is too long (max 255 characters)".to_string(),
            ));
        }

        // Validate port
        if config.port == 0 || config.port > 65535 {
            errors.push(ConnectionValidationError::InvalidPort(
                "Port must be between 1 and 65535".to_string(),
            ));
        }

        // Validate database name
        if config.database.trim().is_empty() {
            errors.push(ConnectionValidationError::InvalidDatabase(
                "Database name cannot be empty".to_string(),
            ));
        } else if config.database.len() > 63 {
            errors.push(ConnectionValidationError::InvalidDatabase(
                "Database name is too long (max 63 characters)".to_string(),
            ));
        }

        // Validate username
        if config.username.trim().is_empty() {
            errors.push(ConnectionValidationError::InvalidUsername(
                "Username cannot be empty".to_string(),
            ));
        } else if config.username.len() > 63 {
            errors.push(ConnectionValidationError::InvalidUsername(
                "Username is too long (max 63 characters)".to_string(),
            ));
        }

        // Validate timeouts
        if config.connection_timeout.as_secs() == 0 || config.connection_timeout.as_secs() > 300 {
            errors.push(ConnectionValidationError::InvalidTimeout(
                "Connection timeout must be between 1 and 300 seconds".to_string(),
            ));
        }

        if config.query_timeout.as_secs() == 0 || config.query_timeout.as_secs() > 3600 {
            errors.push(ConnectionValidationError::InvalidTimeout(
                "Query timeout must be between 1 and 3600 seconds".to_string(),
            ));
        }

        // Validate SSL configuration
        if let Some(cert) = &config.ssl_config.cert {
            if !cert.trim().is_empty() && !std::path::Path::new(cert).exists() {
                errors.push(ConnectionValidationError::InvalidSSLConfig(
                    format!("SSL certificate file not found: {}", cert),
                ));
            }
        }

        if let Some(key) = &config.ssl_config.key {
            if !key.trim().is_empty() && !std::path::Path::new(key).exists() {
                errors.push(ConnectionValidationError::InvalidSSLConfig(
                    format!("SSL key file not found: {}", key),
                ));
            }
        }

        if let Some(ca) = &config.ssl_config.ca {
            if !ca.trim().is_empty() && !std::path::Path::new(ca).exists() {
                errors.push(ConnectionValidationError::InvalidSSLConfig(
                    format!("SSL CA file not found: {}", ca),
                ));
            }
        }

        // Validate custom parameters
        for (key, value) in &config.custom_parameters {
            if key.trim().is_empty() {
                errors.push(ConnectionValidationError::InvalidCustomParameter(
                    key.clone(),
                    "Parameter name cannot be empty".to_string(),
                ));
            }
            if value.len() > 1024 {
                errors.push(ConnectionValidationError::InvalidCustomParameter(
                    key.clone(),
                    "Parameter value is too long (max 1024 characters)".to_string(),
                ));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Get health history for a profile
    pub async fn get_health_history(&self, profile_id: &str) -> Vec<HealthCheckResult> {
        let history = self.health_history.lock().await;
        history.get(profile_id).cloned().unwrap_or_default()
    }

    /// Get current health status for a profile
    pub async fn get_current_health(&self, profile_id: &str) -> Option<ConnectionHealth> {
        let history = self.health_history.lock().await;
        if let Some(profile_history) = history.get(profile_id) {
            if let Some(last_result) = profile_history.last() {
                return Some(ConnectionHealth {
                    status: last_result.status.clone(),
                    last_checked: last_result.timestamp,
                    response_time_ms: last_result.response_time_ms,
                    error_message: last_result.error_message.clone(),
                });
            }
        }
        None
    }

    /// Calculate uptime percentage for a profile
    pub async fn calculate_uptime(&self, profile_id: &str, period_hours: u32) -> f64 {
        let history = self.health_history.lock().await;
        if let Some(profile_history) = history.get(profile_id) {
            let cutoff_time = Utc::now() - chrono::Duration::hours(period_hours as i64);
            let recent_results: Vec<_> = profile_history
                .iter()
                .filter(|result| result.timestamp > cutoff_time)
                .collect();

            if recent_results.is_empty() {
                return 0.0;
            }

            let healthy_count = recent_results
                .iter()
                .filter(|result| matches!(result.status, HealthStatus::Healthy))
                .count();

            (healthy_count as f64 / recent_results.len() as f64) * 100.0
        } else {
            0.0
        }
    }

    /// Attempt a single connection
    async fn attempt_connection(
        &self,
        config: &AdvancedConnectionConfig,
        password: &str,
        options: &ConnectionTestOptions,
    ) -> Result<ConnectionSuccessResult, PostgresError> {
        let connection_string = config.to_connection_string(password);
        
        // Set up connection timeout
        let timeout = Duration::from_secs(
            options.timeout_seconds
                .unwrap_or(config.connection_timeout.as_secs() as u32) as u64
        );

        // Attempt connection with timeout
        let connection_result = tokio::time::timeout(
            timeout,
            tokio_postgres::connect(&connection_string, NoTls)
        ).await;

        match connection_result {
            Ok(Ok((client, connection))) => {
                // Spawn the connection task
                tokio::spawn(async move {
                    if let Err(e) = connection.await {
                        eprintln!("Connection error: {}", e);
                    }
                });

                // Test with a simple query if requested
                if let Some(test_query) = &options.test_query {
                    let query_result = tokio::time::timeout(
                        Duration::from_secs(10),
                        client.simple_query(test_query)
                    ).await;

                    if let Err(_) = query_result {
                        return Err(PostgresError::from(std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            "Test query timed out"
                        )));
                    }
                }

                // Get server information
                let server_version = self.get_server_version(&client).await;
                
                Ok(ConnectionSuccessResult {
                    server_version,
                    connection_details: ConnectionDetails {
                        host: config.host.clone(),
                        port: config.port,
                        database: config.database.clone(),
                        username: config.username.clone(),
                        ssl_used: false, // TODO: Detect actual SSL usage
                        server_encoding: None, // TODO: Get actual encoding
                        client_encoding: None, // TODO: Get actual encoding
                    },
                })
            }
            Ok(Err(e)) => Err(e),
            Err(_) => Err(PostgresError::from(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "Connection timed out"
            ))),
        }
    }

    /// Get server version information
    async fn get_server_version(&self, client: &Client) -> Option<String> {
        match client.simple_query("SELECT version()").await {
            Ok(rows) => {
                if let Some(row) = rows.first() {
                    if let tokio_postgres::SimpleQueryMessage::Row(row) = row {
                        row.get(0).map(|s| s.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }

    /// Analyze connection error and provide troubleshooting hints
    fn analyze_connection_error(&self, error: &PostgresError) -> (String, Vec<String>) {
        let error_str = error.to_string().to_lowercase();
        let mut hints = Vec::new();

        let error_code = if error_str.contains("connection refused") {
            hints.push("Check if PostgreSQL server is running".to_string());
            hints.push("Verify the host and port are correct".to_string());
            hints.push("Check firewall settings".to_string());
            "CONNECTION_REFUSED"
        } else if error_str.contains("timeout") || error_str.contains("timed out") {
            hints.push("Increase connection timeout value".to_string());
            hints.push("Check network connectivity".to_string());
            hints.push("Verify server is not overloaded".to_string());
            "CONNECTION_TIMEOUT"
        } else if error_str.contains("authentication failed") || error_str.contains("password") {
            hints.push("Verify username and password are correct".to_string());
            hints.push("Check if user has permission to connect".to_string());
            hints.push("Verify authentication method (md5, scram-sha-256, etc.)".to_string());
            "AUTHENTICATION_FAILED"
        } else if error_str.contains("database") && error_str.contains("does not exist") {
            hints.push("Check if the database name is correct".to_string());
            hints.push("Verify the database exists on the server".to_string());
            hints.push("Check if you have permission to access this database".to_string());
            "DATABASE_NOT_FOUND"
        } else if error_str.contains("ssl") {
            hints.push("Check SSL configuration settings".to_string());
            hints.push("Verify SSL certificates are valid and accessible".to_string());
            hints.push("Try different SSL modes (disable, prefer, require)".to_string());
            "SSL_ERROR"
        } else if error_str.contains("host") || error_str.contains("resolve") {
            hints.push("Check if the hostname is correct".to_string());
            hints.push("Try using IP address instead of hostname".to_string());
            hints.push("Check DNS resolution".to_string());
            "HOST_RESOLUTION_ERROR"
        } else {
            hints.push("Check server logs for more details".to_string());
            hints.push("Verify all connection parameters".to_string());
            hints.push("Try connecting with a different client to isolate the issue".to_string());
            "UNKNOWN_ERROR"
        };

        (error_code.to_string(), hints)
    }

    /// Generate troubleshooting hints for validation errors
    fn generate_validation_hints(&self, errors: &[ConnectionValidationError]) -> Vec<String> {
        let mut hints = Vec::new();

        for error in errors {
            match error {
                ConnectionValidationError::InvalidHost(_) => {
                    hints.push("Provide a valid hostname or IP address".to_string());
                }
                ConnectionValidationError::InvalidPort(_) => {
                    hints.push("Use a valid port number (typically 5432 for PostgreSQL)".to_string());
                }
                ConnectionValidationError::InvalidDatabase(_) => {
                    hints.push("Provide a valid database name".to_string());
                }
                ConnectionValidationError::InvalidUsername(_) => {
                    hints.push("Provide a valid username".to_string());
                }
                ConnectionValidationError::InvalidSSLConfig(_) => {
                    hints.push("Check SSL certificate file paths and permissions".to_string());
                }
                ConnectionValidationError::InvalidTimeout(_) => {
                    hints.push("Use reasonable timeout values (30 seconds for connection, 5 minutes for queries)".to_string());
                }
                ConnectionValidationError::InvalidCustomParameter(_, _) => {
                    hints.push("Check custom parameter names and values".to_string());
                }
            }
        }

        hints
    }
}

/// Result of a successful connection attempt
struct ConnectionSuccessResult {
    server_version: Option<String>,
    connection_details: ConnectionDetails,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection_profile::{SSLConfig, SSLMode, Environment, ConnectionMetadata};

    fn create_test_config() -> AdvancedConnectionConfig {
        AdvancedConnectionConfig {
            host: "localhost".to_string(),
            port: 5432,
            database: "test_db".to_string(),
            username: "test_user".to_string(),
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
            custom_parameters: std::collections::HashMap::new(),
            connection_string_template: None,
        }
    }

    #[test]
    fn test_connection_config_validation() {
        let service = ConnectionHealthService::new();
        
        // Valid configuration
        let valid_config = create_test_config();
        assert!(service.validate_connection_config(&valid_config).is_ok());
        
        // Invalid host
        let mut invalid_config = valid_config.clone();
        invalid_config.host = "".to_string();
        assert!(service.validate_connection_config(&invalid_config).is_err());
        
        // Invalid port
        let mut invalid_config = valid_config.clone();
        invalid_config.port = 0;
        assert!(service.validate_connection_config(&invalid_config).is_err());
        
        // Invalid database
        let mut invalid_config = valid_config.clone();
        invalid_config.database = "".to_string();
        assert!(service.validate_connection_config(&invalid_config).is_err());
    }

    #[test]
    fn test_error_analysis() {
        let service = ConnectionHealthService::new();
        
        // Test connection refused error
        let error = PostgresError::from(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "connection refused"
        ));
        let (code, hints) = service.analyze_connection_error(&error);
        assert_eq!(code, "CONNECTION_REFUSED");
        assert!(!hints.is_empty());
        
        // Test timeout error
        let error = PostgresError::from(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "connection timed out"
        ));
        let (code, hints) = service.analyze_connection_error(&error);
        assert_eq!(code, "CONNECTION_TIMEOUT");
        assert!(!hints.is_empty());
    }

    #[tokio::test]
    async fn test_health_history() {
        let service = ConnectionHealthService::new();
        let profile_id = "test-profile";
        
        // Initially no history
        let history = service.get_health_history(profile_id).await;
        assert!(history.is_empty());
        
        // Add a health check result
        let result = HealthCheckResult {
            timestamp: Utc::now(),
            status: HealthStatus::Healthy,
            response_time_ms: Some(100),
            error_message: None,
        };
        
        {
            let mut history_map = service.health_history.lock().await;
            history_map.insert(profile_id.to_string(), vec![result.clone()]);
        }
        
        // Check history is now available
        let history = service.get_health_history(profile_id).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].response_time_ms, Some(100));
    }

    #[tokio::test]
    async fn test_uptime_calculation() {
        let service = ConnectionHealthService::new();
        let profile_id = "test-profile";
        
        // Add mixed health results
        let results = vec![
            HealthCheckResult {
                timestamp: Utc::now() - chrono::Duration::minutes(30),
                status: HealthStatus::Healthy,
                response_time_ms: Some(100),
                error_message: None,
            },
            HealthCheckResult {
                timestamp: Utc::now() - chrono::Duration::minutes(20),
                status: HealthStatus::Error,
                response_time_ms: None,
                error_message: Some("Connection failed".to_string()),
            },
            HealthCheckResult {
                timestamp: Utc::now() - chrono::Duration::minutes(10),
                status: HealthStatus::Healthy,
                response_time_ms: Some(150),
                error_message: None,
            },
        ];
        
        {
            let mut history_map = service.health_history.lock().await;
            history_map.insert(profile_id.to_string(), results);
        }
        
        // Calculate uptime (should be 66.67% - 2 out of 3 healthy)
        let uptime = service.calculate_uptime(profile_id, 1).await;
        assert!((uptime - 66.67).abs() < 0.1);
    }
}