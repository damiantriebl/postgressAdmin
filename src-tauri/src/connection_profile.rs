use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

/// Core connection profile containing all information needed to manage a database connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub folder: Option<String>,
    pub config: AdvancedConnectionConfig,
    pub metadata: ConnectionMetadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u64,
}

/// Advanced connection configuration with all possible connection parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedConnectionConfig {
    // Basic connection info
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    
    // Advanced settings (serialized as seconds for Duration)
    #[serde(with = "duration_serde")]
    pub connection_timeout: Duration,
    #[serde(with = "duration_serde")]
    pub query_timeout: Duration,
    pub max_connections: u32,
    #[serde(with = "duration_serde")]
    pub idle_timeout: Duration,
    pub retry_attempts: u32,
    #[serde(with = "duration_serde")]
    pub retry_delay: Duration,
    
    // SSL Configuration
    pub ssl_config: SSLConfig,
    
    // Custom parameters
    pub custom_parameters: HashMap<String, String>,
    
    // Connection string template
    pub connection_string_template: Option<String>,
}

/// SSL/TLS configuration options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSLConfig {
    pub mode: SSLMode,
    pub cert: Option<String>,
    pub key: Option<String>,
    pub ca: Option<String>,
}

/// SSL modes supported by PostgreSQL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSLMode {
    #[serde(rename = "disable")]
    Disable,
    #[serde(rename = "allow")]
    Allow,
    #[serde(rename = "prefer")]
    Prefer,
    #[serde(rename = "require")]
    Require,
    #[serde(rename = "verify-ca")]
    VerifyCa,
    #[serde(rename = "verify-full")]
    VerifyFull,
}

/// Metadata associated with a connection profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionMetadata {
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub auto_connect: bool,
    pub environment: Environment,
    pub monitoring_enabled: bool,
}

/// Environment categorization for connections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Environment {
    #[serde(rename = "development")]
    Development,
    #[serde(rename = "staging")]
    Staging,
    #[serde(rename = "production")]
    Production,
    #[serde(rename = "testing")]
    Testing,
    #[serde(rename = "other")]
    Other(String),
}

/// Connection health status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealth {
    pub status: HealthStatus,
    pub last_checked: DateTime<Utc>,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
}

/// Health status enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    #[serde(rename = "healthy")]
    Healthy,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "unknown")]
    Unknown,
}

/// Health check result with timestamp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub timestamp: DateTime<Utc>,
    pub status: HealthStatus,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
}

/// Connection health history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealthHistory {
    pub current: ConnectionHealth,
    pub history: Vec<HealthCheckResult>,
    pub uptime_percentage: f64,
}

/// Monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub enable_auto_check: bool,
    pub check_interval_minutes: u32,
    pub enable_notifications: bool,
    pub critical_connection_ids: Vec<String>,
}

/// Pool statistics for connection monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStats {
    pub active_connections: u32,
    pub idle_connections: u32,
    pub max_connections: u32,
    pub total_connections_created: u64,
    pub average_wait_time_ms: f64,
}

/// Connection metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionMetrics {
    pub total_profiles: u32,
    pub active_connections: u32,
    pub average_response_time_ms: f64,
    pub success_rate: f64,
    pub uptime_percentage: f64,
}

/// Merge strategy for importing profiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeStrategy {
    #[serde(rename = "replace")]
    Replace,
    #[serde(rename = "merge")]
    Merge,
    #[serde(rename = "skip")]
    Skip,
}

/// Export data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub version: String,
    pub exported_at: DateTime<Utc>,
    pub profiles: Vec<ConnectionProfile>,
    pub credentials: Option<HashMap<String, EncryptedCredentials>>,
    pub checksum: String,
}

/// Encrypted credentials for secure storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedCredentials {
    pub encrypted_password: Vec<u8>,
    pub nonce: Vec<u8>,
    pub encrypted_at: DateTime<Utc>,
}

/// Import result information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: u32,
    pub skipped_count: u32,
    pub error_count: u32,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Validation result for import data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub version_compatible: bool,
    pub profile_count: u32,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

// Custom serialization for Duration to handle JSON serialization
mod duration_serde {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        duration.as_secs().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let secs = u64::deserialize(deserializer)?;
        Ok(Duration::from_secs(secs))
    }
}

impl Default for AdvancedConnectionConfig {
    fn default() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 5432,
            database: "postgres".to_string(),
            username: "postgres".to_string(),
            connection_timeout: Duration::from_secs(30),
            query_timeout: Duration::from_secs(300), // 5 minutes
            max_connections: 10,
            idle_timeout: Duration::from_secs(300), // 5 minutes
            retry_attempts: 3,
            retry_delay: Duration::from_secs(1),
            ssl_config: SSLConfig::default(),
            custom_parameters: HashMap::new(),
            connection_string_template: None,
        }
    }
}

impl Default for SSLConfig {
    fn default() -> Self {
        Self {
            mode: SSLMode::Prefer,
            cert: None,
            key: None,
            ca: None,
        }
    }
}

impl Default for ConnectionMetadata {
    fn default() -> Self {
        Self {
            color: None,
            icon: None,
            is_favorite: false,
            auto_connect: false,
            environment: Environment::Development,
            monitoring_enabled: false,
        }
    }
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enable_auto_check: false,
            check_interval_minutes: 5,
            enable_notifications: true,
            critical_connection_ids: Vec::new(),
        }
    }
}

impl ConnectionProfile {
    /// Create a new connection profile with default values
    pub fn new(name: String, config: AdvancedConnectionConfig) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            description: None,
            tags: Vec::new(),
            folder: None,
            config,
            metadata: ConnectionMetadata::default(),
            created_at: now,
            updated_at: now,
            last_used: None,
            use_count: 0,
        }
    }

    /// Update the last used timestamp and increment use count
    pub fn mark_used(&mut self) {
        self.last_used = Some(Utc::now());
        self.use_count += 1;
        self.updated_at = Utc::now();
    }

    /// Update the profile and set updated_at timestamp
    pub fn update(&mut self) {
        self.updated_at = Utc::now();
    }
}

impl AdvancedConnectionConfig {
    /// Convert to a PostgreSQL connection string
    pub fn to_connection_string(&self, password: &str) -> String {
        if let Some(template) = &self.connection_string_template {
            // Use custom template if provided
            template
                .replace("{host}", &self.host)
                .replace("{port}", &self.port.to_string())
                .replace("{database}", &self.database)
                .replace("{username}", &self.username)
                .replace("{password}", password)
        } else {
            // Build standard PostgreSQL connection string
            let mut conn_str = format!(
                "postgresql://{}:{}@{}:{}/{}",
                self.username, password, self.host, self.port, self.database
            );

            // Add SSL mode
            conn_str.push_str(&format!("?sslmode={}", self.ssl_config.mode.to_string()));

            // Add connection timeout
            conn_str.push_str(&format!("&connect_timeout={}", self.connection_timeout.as_secs()));

            // Add custom parameters
            for (key, value) in &self.custom_parameters {
                conn_str.push_str(&format!("&{}={}", key, value));
            }

            conn_str
        }
    }
}

impl SSLMode {
    pub fn to_string(&self) -> &'static str {
        match self {
            SSLMode::Disable => "disable",
            SSLMode::Allow => "allow",
            SSLMode::Prefer => "prefer",
            SSLMode::Require => "require",
            SSLMode::VerifyCa => "verify-ca",
            SSLMode::VerifyFull => "verify-full",
        }
    }
}

impl Environment {
    pub fn to_string(&self) -> String {
        match self {
            Environment::Development => "development".to_string(),
            Environment::Staging => "staging".to_string(),
            Environment::Production => "production".to_string(),
            Environment::Testing => "testing".to_string(),
            Environment::Other(name) => name.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_profile_creation() {
        let config = AdvancedConnectionConfig::default();
        let profile = ConnectionProfile::new("Test Connection".to_string(), config);
        
        assert_eq!(profile.name, "Test Connection");
        assert_eq!(profile.use_count, 0);
        assert!(profile.last_used.is_none());
        assert!(!profile.id.is_empty());
    }

    #[test]
    fn test_connection_profile_mark_used() {
        let config = AdvancedConnectionConfig::default();
        let mut profile = ConnectionProfile::new("Test Connection".to_string(), config);
        
        profile.mark_used();
        
        assert_eq!(profile.use_count, 1);
        assert!(profile.last_used.is_some());
    }

    #[test]
    fn test_connection_string_generation() {
        let config = AdvancedConnectionConfig {
            host: "localhost".to_string(),
            port: 5432,
            database: "testdb".to_string(),
            username: "testuser".to_string(),
            ..Default::default()
        };
        
        let conn_str = config.to_connection_string("testpass");
        
        assert!(conn_str.contains("postgresql://testuser:testpass@localhost:5432/testdb"));
        assert!(conn_str.contains("sslmode=prefer"));
        assert!(conn_str.contains("connect_timeout=30"));
    }

    #[test]
    fn test_ssl_mode_serialization() {
        let ssl_config = SSLConfig {
            mode: SSLMode::Require,
            cert: Some("cert.pem".to_string()),
            key: Some("key.pem".to_string()),
            ca: Some("ca.pem".to_string()),
        };
        
        let json = serde_json::to_string(&ssl_config).unwrap();
        let deserialized: SSLConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(ssl_config.mode.to_string(), deserialized.mode.to_string());
        assert_eq!(ssl_config.cert, deserialized.cert);
    }

    #[test]
    fn test_duration_serialization() {
        let config = AdvancedConnectionConfig::default();
        
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AdvancedConnectionConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(config.connection_timeout, deserialized.connection_timeout);
        assert_eq!(config.query_timeout, deserialized.query_timeout);
    }
}