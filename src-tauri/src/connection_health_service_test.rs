#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection_profile::{
        AdvancedConnectionConfig, ConnectionMetadata, Environment, SSLConfig, SSLMode,
    };
    use std::time::Duration;
    use tokio;

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

    fn create_test_profile() -> ConnectionProfile {
        let config = create_test_config();
        let metadata = ConnectionMetadata {
            color: Some("#3b82f6".to_string()),
            icon: Some("database".to_string()),
            is_favorite: false,
            auto_connect: false,
            environment: Environment::Development,
            monitoring_enabled: true,
        };

        ConnectionProfile {
            id: "test-profile-1".to_string(),
            name: "Test Connection".to_string(),
            description: Some("Test connection for unit tests".to_string()),
            tags: vec!["test".to_string(), "development".to_string()],
            folder: Some("test-folder".to_string()),
            config,
            metadata,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            last_used: None,
            use_count: 0,
        }
    }

    #[test]
    fn test_connection_health_service_creation() {
        let service = ConnectionHealthService::new();
        // Service should be created successfully
        assert!(true); // Basic creation test
    }

    #[test]
    fn test_validate_connection_config_valid() {
        let service = ConnectionHealthService::new();
        let config = create_test_config();

        let result = service.validate_connection_config(&config);
        assert!(result.is_ok(), "Valid configuration should pass validation");
    }

    #[test]
    fn test_validate_connection_config_invalid_host() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.host = "".to_string();

        let result = service.validate_connection_config(&config);
        assert!(result.is_err(), "Empty host should fail validation");

        let errors = result.unwrap_err();
        assert!(!errors.is_empty(), "Should have validation errors");
        assert!(matches!(
            errors[0],
            ConnectionValidationError::InvalidHost(_)
        ));
    }

    #[test]
    fn test_validate_connection_config_invalid_port() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.port = 0;

        let result = service.validate_connection_config(&config);
        assert!(result.is_err(), "Port 0 should fail validation");

        let errors = result.unwrap_err();
        assert!(matches!(
            errors[0],
            ConnectionValidationError::InvalidPort(_)
        ));
    }

    #[test]
    fn test_validate_connection_config_invalid_database() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.database = "".to_string();

        let result = service.validate_connection_config(&config);
        assert!(result.is_err(), "Empty database should fail validation");

        let errors = result.unwrap_err();
        assert!(matches!(
            errors[0],
            ConnectionValidationError::InvalidDatabase(_)
        ));
    }

    #[test]
    fn test_validate_connection_config_invalid_username() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.username = "".to_string();

        let result = service.validate_connection_config(&config);
        assert!(result.is_err(), "Empty username should fail validation");

        let errors = result.unwrap_err();
        assert!(matches!(
            errors[0],
            ConnectionValidationError::InvalidUsername(_)
        ));
    }

    #[test]
    fn test_validate_connection_config_invalid_timeout() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.connection_timeout = Duration::from_secs(0);

        let result = service.validate_connection_config(&config);
        assert!(result.is_err(), "Zero timeout should fail validation");

        let errors = result.unwrap_err();
        assert!(matches!(
            errors[0],
            ConnectionValidationError::InvalidTimeout(_)
        ));
    }

    #[test]
    fn test_validate_connection_config_multiple_errors() {
        let service = ConnectionHealthService::new();
        let mut config = create_test_config();
        config.host = "".to_string();
        config.port = 0;
        config.database = "".to_string();

        let result = service.validate_connection_config(&config);
        assert!(
            result.is_err(),
            "Multiple invalid fields should fail validation"
        );

        let errors = result.unwrap_err();
        assert!(errors.len() >= 3, "Should have multiple validation errors");
    }

    #[test]
    fn test_analyze_connection_error_connection_refused() {
        let service = ConnectionHealthService::new();
        let error = tokio_postgres::Error::from(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "connection refused",
        ));

        let (code, hints) = service.analyze_connection_error(&error);
        assert_eq!(code, "CONNECTION_REFUSED");
        assert!(!hints.is_empty());
        assert!(hints
            .iter()
            .any(|hint| hint.contains("PostgreSQL server is running")));
    }

    #[test]
    fn test_analyze_connection_error_timeout() {
        let service = ConnectionHealthService::new();
        let error = tokio_postgres::Error::from(std::io::Error::new(
            std::io::ErrorKind::TimedOut,
            "connection timed out",
        ));

        let (code, hints) = service.analyze_connection_error(&error);
        assert_eq!(code, "CONNECTION_TIMEOUT");
        assert!(!hints.is_empty());
        assert!(hints.iter().any(|hint| hint.contains("timeout")));
    }

    #[test]
    fn test_generate_validation_hints() {
        let service = ConnectionHealthService::new();
        let errors = vec![
            ConnectionValidationError::InvalidHost("Empty host".to_string()),
            ConnectionValidationError::InvalidPort("Invalid port".to_string()),
        ];

        let hints = service.generate_validation_hints(&errors);
        assert_eq!(hints.len(), 2);
        assert!(hints.iter().any(|hint| hint.contains("hostname")));
        assert!(hints.iter().any(|hint| hint.contains("port")));
    }

    #[tokio::test]
    async fn test_health_history_operations() {
        let service = ConnectionHealthService::new();
        let profile_id = "test-profile";

        // Initially no history
        let history = service.get_health_history(profile_id).await;
        assert!(history.is_empty());

        // Add a health check result
        let result = HealthCheckResult {
            timestamp: chrono::Utc::now(),
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

        // Check current health
        let current_health = service.get_current_health(profile_id).await;
        assert!(current_health.is_some());
        let health = current_health.unwrap();
        assert!(matches!(health.status, HealthStatus::Healthy));
        assert_eq!(health.response_time_ms, Some(100));
    }

    #[tokio::test]
    async fn test_uptime_calculation() {
        let service = ConnectionHealthService::new();
        let profile_id = "test-profile";

        // Add mixed health results
        let now = chrono::Utc::now();
        let results = vec![
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(30),
                status: HealthStatus::Healthy,
                response_time_ms: Some(100),
                error_message: None,
            },
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(20),
                status: HealthStatus::Error,
                response_time_ms: None,
                error_message: Some("Connection failed".to_string()),
            },
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(10),
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
        assert!(
            (uptime - 66.67).abs() < 0.1,
            "Uptime should be approximately 66.67%"
        );
    }

    #[tokio::test]
    async fn test_uptime_calculation_no_data() {
        let service = ConnectionHealthService::new();
        let profile_id = "nonexistent-profile";

        let uptime = service.calculate_uptime(profile_id, 24).await;
        assert_eq!(uptime, 0.0, "Uptime should be 0% for profiles with no data");
    }

    #[tokio::test]
    async fn test_uptime_calculation_all_healthy() {
        let service = ConnectionHealthService::new();
        let profile_id = "test-profile";

        let now = chrono::Utc::now();
        let results = vec![
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(30),
                status: HealthStatus::Healthy,
                response_time_ms: Some(100),
                error_message: None,
            },
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(20),
                status: HealthStatus::Healthy,
                response_time_ms: Some(120),
                error_message: None,
            },
            HealthCheckResult {
                timestamp: now - chrono::Duration::minutes(10),
                status: HealthStatus::Healthy,
                response_time_ms: Some(110),
                error_message: None,
            },
        ];

        {
            let mut history_map = service.health_history.lock().await;
            history_map.insert(profile_id.to_string(), results);
        }

        let uptime = service.calculate_uptime(profile_id, 1).await;
        assert_eq!(
            uptime, 100.0,
            "Uptime should be 100% for all healthy results"
        );
    }

    #[test]
    fn test_connection_test_options_default() {
        let options = ConnectionTestOptions::default();
        assert_eq!(options.timeout_seconds, Some(30));
        assert_eq!(options.retry_attempts, Some(3));
        assert_eq!(options.retry_delay_ms, Some(1000));
        assert_eq!(options.validate_ssl, true);
        assert_eq!(options.check_permissions, false);
        assert_eq!(options.test_query, Some("SELECT 1".to_string()));
    }

    #[test]
    fn test_connection_test_result_serialization() {
        let result = ConnectionTestResult {
            success: true,
            response_time_ms: Some(150),
            error_message: None,
            error_code: None,
            server_version: Some("PostgreSQL 14.5".to_string()),
            database_name: Some("test_db".to_string()),
            connection_details: Some(ConnectionDetails {
                host: "localhost".to_string(),
                port: 5432,
                database: "test_db".to_string(),
                username: "test_user".to_string(),
                ssl_used: false,
                server_encoding: Some("UTF8".to_string()),
                client_encoding: Some("UTF8".to_string()),
            }),
            troubleshooting_hints: vec![],
        };

        // Test serialization
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"response_time_ms\":150"));

        // Test deserialization
        let deserialized: ConnectionTestResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.success, result.success);
        assert_eq!(deserialized.response_time_ms, result.response_time_ms);
    }

    #[test]
    fn test_connection_validation_error_serialization() {
        let error = ConnectionValidationError::InvalidHost("Empty host".to_string());

        // Test serialization
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("InvalidHost"));

        // Test deserialization
        let deserialized: ConnectionValidationError = serde_json::from_str(&json).unwrap();
        match deserialized {
            ConnectionValidationError::InvalidHost(msg) => {
                assert_eq!(msg, "Empty host");
            }
            _ => panic!("Unexpected error type"),
        }
    }

    // Note: The following tests would require an actual PostgreSQL connection
    // and are commented out for unit testing purposes. They can be enabled
    // for integration testing with a real database.

    /*
    #[tokio::test]
    async fn test_connection_with_real_database() {
        let service = ConnectionHealthService::new();
        let config = AdvancedConnectionConfig {
            host: "localhost".to_string(),
            port: 5432,
            database: "postgres".to_string(),
            username: "postgres".to_string(),
            ..Default::default()
        };

        let result = service.test_connection(&config, "password", None).await;
        // This would test against a real database
        // assert!(result.success || !result.success); // Either outcome is valid for testing
    }

    #[tokio::test]
    async fn test_profile_connection_with_real_database() {
        let service = ConnectionHealthService::new();
        let profile = create_test_profile();

        let result = service.test_profile_connection(&profile, "password", None).await;
        // This would test against a real database and store history
        // The result depends on whether a real database is available
    }
    */
}
