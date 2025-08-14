use std::sync::Arc;
use tokio::sync::Mutex;
use deadpool_postgres::{Config, Pool, Runtime};
use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use url::Url;


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    pub max_size: usize,
    pub connection_timeout_secs: u64,
    pub idle_timeout_secs: u64,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            max_size: 10,
            connection_timeout_secs: 30,
            idle_timeout_secs: 600, // 10 minutes
        }
    }
}

pub struct ConnectionPool {
    pool: Arc<Mutex<Option<Pool>>>,
    connection_string: Option<String>,
    config: PoolConfig,
}

impl ConnectionPool {
    pub fn new(config: PoolConfig) -> Self {
        println!("🦀 [ConnectionPool] Creating new connection pool with max_size: {}", config.max_size);
        Self {
            pool: Arc::new(Mutex::new(None)),
            connection_string: None,
            config,
        }
    }

    pub async fn initialize(&mut self, connection_string: String) -> Result<(), String> {
        println!("🦀 [ConnectionPool] Initializing connection pool...");
        
        // Create deadpool config
        let mut pool_config = Config::new();
        
        // Parse the connection string manually
        let url = Url::parse(&connection_string)
            .map_err(|e| format!("Failed to parse connection string: {}", e))?;
        
        pool_config.host = url.host_str().map(|s| s.to_string());
        pool_config.port = url.port();
        pool_config.dbname = Some(url.path().trim_start_matches('/').to_string());
        pool_config.user = Some(url.username().to_string());
        pool_config.password = url.password().map(|s| s.to_string());

        // Set pool size - use default configuration and only set what we need
        let mut pool_cfg = deadpool_postgres::PoolConfig::default();
        pool_cfg.max_size = self.config.max_size;
        pool_cfg.timeouts.wait = Some(std::time::Duration::from_secs(self.config.connection_timeout_secs));
        pool_cfg.timeouts.create = Some(std::time::Duration::from_secs(self.config.connection_timeout_secs));
        pool_cfg.timeouts.recycle = Some(std::time::Duration::from_secs(self.config.idle_timeout_secs));
        
        pool_config.pool = Some(pool_cfg);

        // Create TLS connector for SSL connections (required by Neon)
        println!("🦀 [ConnectionPool] Creating TLS connector for SSL connections...");
        let connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(false)
            .build()
            .map_err(|e| format!("TLS setup failed: {}", e))?;
        let tls = MakeTlsConnector::new(connector);

        // Create the pool
        match pool_config.create_pool(Some(Runtime::Tokio1), tls) {
            Ok(pool) => {
                println!("🦀 [ConnectionPool] Connection pool created successfully");
                
                // Test the pool by getting a connection
                match pool.get().await {
                    Ok(client) => {
                        println!("🦀 [ConnectionPool] Pool test connection successful");
                        drop(client); // Return connection to pool
                    },
                    Err(e) => {
                        println!("🦀 [ConnectionPool] Pool test connection failed: {}", e);
                        return Err(format!("Pool connection test failed: {}", e));
                    }
                }

                let mut pool_guard = self.pool.lock().await;
                *pool_guard = Some(pool);
                self.connection_string = Some(connection_string);
                
                println!("🦀 [ConnectionPool] Connection pool initialized successfully");
                Ok(())
            },
            Err(e) => {
                println!("🦀 [ConnectionPool] Failed to create connection pool: {}", e);
                Err(format!("Failed to create connection pool: {}", e))
            }
        }
    }

    pub async fn disconnect(&mut self) -> Result<(), String> {
        println!("🦀 [ConnectionPool] Disconnecting connection pool...");
        let mut pool_guard = self.pool.lock().await;
        *pool_guard = None;
        self.connection_string = None;
        println!("🦀 [ConnectionPool] Connection pool disconnected successfully");
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        match self.pool.try_lock() {
            Ok(pool_guard) => {
                let connected = pool_guard.is_some();
                println!("🦀 [ConnectionPool] is_connected: {}", connected);
                connected
            }
            Err(_) => {
                println!("🦀 [ConnectionPool] is_connected: lock busy, assuming connected");
                true
            }
        }
    }

    pub async fn get_connection(&self) -> Result<deadpool_postgres::Client, String> {
        let pool_guard = self.pool.lock().await;
        match pool_guard.as_ref() {
            Some(pool) => {
                match pool.get().await {
                    Ok(client) => {
                        println!("🦀 [ConnectionPool] Retrieved connection from pool");
                        Ok(client)
                    },
                    Err(e) => {
                        println!("🦀 [ConnectionPool] Failed to get connection from pool: {}", e);
                        Err(format!("Failed to get connection from pool: {}", e))
                    }
                }
            },
            None => {
                println!("🦀 [ConnectionPool] No connection pool available");
                Err("Not connected to database".to_string())
            }
        }
    }

    pub async fn get_pool_status(&self) -> Result<PoolStatus, String> {
        let pool_guard = self.pool.lock().await;
        match pool_guard.as_ref() {
            Some(pool) => {
                let status = pool.status();
                Ok(PoolStatus {
                    size: status.size,
                    available: status.available,
                    waiting: status.waiting,
                    max_size: self.config.max_size,
                })
            },
            None => Err("No connection pool available".to_string())
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PoolStatus {
    pub size: usize,
    pub available: usize,
    pub waiting: usize,
    pub max_size: usize,
}