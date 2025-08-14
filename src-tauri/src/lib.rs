mod commands;
mod connection_health_commands;
mod connection_health_service;
#[cfg(test)]
mod connection_health_service_test;
mod connection_pool;
mod connection_profile;
mod connection_profile_commands;
mod connection_profile_store;
mod connection_profile_store_commands;
#[cfg(test)]
mod connection_profile_store_test;
mod credential_vault;
mod credential_vault_commands;
mod simple_db;

use commands::*;
use connection_health_commands::*;
use connection_health_service::ConnectionHealthService;
use connection_pool::{ConnectionPool, PoolConfig};
use connection_profile_commands::*;
use connection_profile_store::ConnectionProfileStore;
use connection_profile_store_commands::*;
use credential_vault::CredentialVault;
use credential_vault_commands::*;
use serde::{Deserialize, Serialize};
use simple_db::SimpleDatabase;
use std::sync::Arc;
use tokio::sync::Mutex;

// Re-export connection profile types for use in commands
pub use connection_profile::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionStatus {
    connected: bool,
    message: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! PostgreSQL Query Tool is ready!", name)
}

#[tauri::command]
async fn initialize_database_logger() -> Result<(), String> {
    // Simplified logging initialization
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();

    println!("🦀 [Rust] Starting PostgreSQL Query Tool");
    log::info!("Starting PostgreSQL Query Tool");

    println!("🦀 [Rust] Creating database connection and connection pool...");
    let simple_db = Arc::new(Mutex::new(SimpleDatabase::new()));

    // Create connection pool with optimized settings
    let pool_config = PoolConfig {
        max_size: 20, // Increased pool size for better performance
        connection_timeout_secs: 30,
        idle_timeout_secs: 300, // 5 minutes idle timeout
    };
    let connection_pool = Arc::new(Mutex::new(ConnectionPool::new(pool_config)));
    
    // Create credential vault
    let credential_vault = Arc::new(Mutex::new(CredentialVault::new("postgresql_query_tool")));
    
    // Create connection profile store
    let app_data_dir = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME").map(|home| format!("{}/.config", home)))
        .unwrap_or_else(|_| ".".to_string());
    let profiles_path = std::path::Path::new(&app_data_dir)
        .join("postgresql_query_tool")
        .join("connection_profiles.json");
    
    let connection_profile_store = match ConnectionProfileStore::new(&profiles_path) {
        Ok(store) => Arc::new(Mutex::new(store)),
        Err(e) => {
            eprintln!("Failed to initialize connection profile store: {}", e);
            std::process::exit(1);
        }
    };
    
    // Create connection health service
    let connection_health_service = Arc::new(Mutex::new(ConnectionHealthService::new()));
    
    println!("🦀 [Rust] Database connection, pool, credential vault, profile store, and health service created successfully");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(simple_db)
        .manage(connection_pool)
        .manage(credential_vault)
        .manage(connection_profile_store)
        .manage(connection_health_service)
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_database_logger,
            connect_database,
            disconnect_database,
            is_connected,
            get_connection_status,
            get_pool_status,
            execute_query,
            get_tables,
            get_table_columns,
            get_detailed_table_columns,
            get_enum_values,
            build_safe_query,
            query_table,
            get_table_foreign_keys,
            get_table_indexes,
            get_all_indexes,
            create_index,
            drop_index,
            get_views,
            get_stored_procedures,
            get_materialized_views,
            update_row,
            insert_row,
            delete_row,
            begin_transaction,
            commit_transaction,
            rollback_transaction,
            execute_transaction,
            execute_streaming_query,
            export_table_sql,
            export_table_csv_json,
            export_query_result_sql,
            import_sql_file,
            import_sql_from_file,
            save_export_to_file,
            // Connection Profile Management Commands
            create_sample_connection_profile,
            validate_connection_profile,
            generate_connection_string,
            get_default_connection_config,
            get_ssl_modes,
            get_environments,
            // Credential Vault Commands
            initialize_credential_vault,
            store_profile_credentials,
            retrieve_profile_credentials,
            update_profile_credentials,
            delete_profile_credentials,
            has_profile_credentials,
            list_profiles_with_credentials,
            rotate_vault_master_key,
            // Connection Profile Store Commands
            initialize_profile_store,
            create_connection_profile,
            get_connection_profile,
            update_connection_profile,
            delete_connection_profile,
            get_all_connection_profiles,
            search_connection_profiles,
            get_profiles_by_tag,
            get_profiles_by_folder,
            get_favorite_profiles,
            get_recent_profiles,
            mark_profile_used,
            get_profile_storage_stats,
            create_profile_from_params,
            validate_profile_data,
            get_all_profile_tags,
            get_all_profile_folders,
            bulk_update_profiles,
            bulk_delete_profiles,
            // Connection Health Commands
            test_connection_config,
            test_connection_profile,
            test_connection_by_profile_id,
            validate_connection_config,
            get_profile_health_history,
            get_profile_current_health,
            calculate_profile_uptime,
            batch_test_profiles,
            quick_connection_test,
            get_connection_troubleshooting_suggestions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
