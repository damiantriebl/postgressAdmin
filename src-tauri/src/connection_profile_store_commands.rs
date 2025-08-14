use crate::connection_profile::*;
use crate::connection_profile_store::*;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Tauri state for the connection profile store
pub type ConnectionProfileStoreState = Arc<Mutex<ConnectionProfileStore>>;

/// Initialize the connection profile store
#[tauri::command]
pub async fn initialize_profile_store(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.load_profiles().await.map_err(|e| e.to_string())
}

/// Create a new connection profile
#[tauri::command]
pub async fn create_connection_profile(
    store: State<'_, ConnectionProfileStoreState>,
    profile: ConnectionProfile,
) -> Result<ConnectionProfile, String> {
    let store = store.lock().await;
    store.create_profile(profile).await.map_err(|e| e.to_string())
}

/// Get a connection profile by ID
#[tauri::command]
pub async fn get_connection_profile(
    store: State<'_, ConnectionProfileStoreState>,
    id: String,
) -> Result<ConnectionProfile, String> {
    let store = store.lock().await;
    store.get_profile(&id).await.map_err(|e| e.to_string())
}

/// Update an existing connection profile
#[tauri::command]
pub async fn update_connection_profile(
    store: State<'_, ConnectionProfileStoreState>,
    id: String,
    profile: ConnectionProfile,
) -> Result<ConnectionProfile, String> {
    let store = store.lock().await;
    store.update_profile(&id, profile).await.map_err(|e| e.to_string())
}

/// Delete a connection profile
#[tauri::command]
pub async fn delete_connection_profile(
    store: State<'_, ConnectionProfileStoreState>,
    id: String,
) -> Result<ConnectionProfile, String> {
    let store = store.lock().await;
    store.delete_profile(&id).await.map_err(|e| e.to_string())
}

/// Get all connection profiles
#[tauri::command]
pub async fn get_all_connection_profiles(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.get_all_profiles().await.map_err(|e| e.to_string())
}

/// Search connection profiles with filtering options
#[tauri::command]
pub async fn search_connection_profiles(
    store: State<'_, ConnectionProfileStoreState>,
    query: Option<String>,
    tags: Option<Vec<String>>,
    folder: Option<String>,
    environment: Option<Environment>,
    is_favorite: Option<bool>,
    limit: Option<usize>,
    offset: Option<usize>,
    sort_by: Option<String>,
    sort_direction: Option<String>,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    
    let options = ProfileSearchOptions {
        query,
        tags,
        folder,
        environment,
        is_favorite,
        limit,
        offset,
    };

    let sort_by_enum = match sort_by.as_deref() {
        Some("name") => Some(ProfileSortBy::Name),
        Some("created_at") => Some(ProfileSortBy::CreatedAt),
        Some("updated_at") => Some(ProfileSortBy::UpdatedAt),
        Some("last_used") => Some(ProfileSortBy::LastUsed),
        Some("use_count") => Some(ProfileSortBy::UseCount),
        _ => None,
    };

    let sort_direction_enum = match sort_direction.as_deref() {
        Some("desc") => Some(SortDirection::Descending),
        _ => Some(SortDirection::Ascending),
    };

    store.search_profiles(&options, sort_by_enum, sort_direction_enum)
        .await
        .map_err(|e| e.to_string())
}

/// Get profiles by tag
#[tauri::command]
pub async fn get_profiles_by_tag(
    store: State<'_, ConnectionProfileStoreState>,
    tag: String,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.get_profiles_by_tag(&tag).await.map_err(|e| e.to_string())
}

/// Get profiles by folder
#[tauri::command]
pub async fn get_profiles_by_folder(
    store: State<'_, ConnectionProfileStoreState>,
    folder: String,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.get_profiles_by_folder(&folder).await.map_err(|e| e.to_string())
}

/// Get favorite profiles
#[tauri::command]
pub async fn get_favorite_profiles(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.get_favorite_profiles().await.map_err(|e| e.to_string())
}

/// Get recently used profiles
#[tauri::command]
pub async fn get_recent_profiles(
    store: State<'_, ConnectionProfileStoreState>,
    limit: usize,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    store.get_recent_profiles(limit).await.map_err(|e| e.to_string())
}

/// Mark a profile as used
#[tauri::command]
pub async fn mark_profile_used(
    store: State<'_, ConnectionProfileStoreState>,
    id: String,
) -> Result<ConnectionProfile, String> {
    let store = store.lock().await;
    store.mark_profile_used(&id).await.map_err(|e| e.to_string())
}

/// Get storage statistics
#[tauri::command]
pub async fn get_profile_storage_stats(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<StorageStats, String> {
    let store = store.lock().await;
    store.get_storage_stats().await.map_err(|e| e.to_string())
}

/// Create a connection profile from basic parameters (helper command)
#[tauri::command]
pub async fn create_profile_from_params(
    store: State<'_, ConnectionProfileStoreState>,
    name: String,
    description: Option<String>,
    host: String,
    port: u16,
    database: String,
    username: String,
    tags: Option<Vec<String>>,
    folder: Option<String>,
    environment: Option<Environment>,
    is_favorite: Option<bool>,
) -> Result<ConnectionProfile, String> {
    let config = AdvancedConnectionConfig {
        host,
        port,
        database,
        username,
        ..Default::default()
    };

    let metadata = ConnectionMetadata {
        is_favorite: is_favorite.unwrap_or(false),
        environment: environment.unwrap_or(Environment::Development),
        ..Default::default()
    };

    let profile = ConnectionProfile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        description,
        tags: tags.unwrap_or_default(),
        folder,
        config,
        metadata,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        last_used: None,
        use_count: 0,
    };

    let store = store.lock().await;
    store.create_profile(profile).await.map_err(|e| e.to_string())
}

/// Validate a connection profile before saving
#[tauri::command]
pub async fn validate_profile_data(
    profile: ConnectionProfile,
) -> Result<bool, String> {
    // Basic validation
    if profile.name.trim().is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    
    if profile.config.host.trim().is_empty() {
        return Err("Host cannot be empty".to_string());
    }
    
    if profile.config.database.trim().is_empty() {
        return Err("Database name cannot be empty".to_string());
    }
    
    if profile.config.username.trim().is_empty() {
        return Err("Username cannot be empty".to_string());
    }
    
    if !(1..=65535).contains(&profile.config.port) {
        return Err("Port must be between 1 and 65535".to_string());
    }

    // Validate connection timeout
    if profile.config.connection_timeout.as_secs() == 0 {
        return Err("Connection timeout must be greater than 0".to_string());
    }

    // Validate query timeout
    if profile.config.query_timeout.as_secs() == 0 {
        return Err("Query timeout must be greater than 0".to_string());
    }

    // Validate max connections
    if profile.config.max_connections == 0 {
        return Err("Max connections must be greater than 0".to_string());
    }

    Ok(true)
}

/// Get unique tags from all profiles
#[tauri::command]
pub async fn get_all_profile_tags(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<Vec<String>, String> {
    let store = store.lock().await;
    let profiles = store.get_all_profiles().await.map_err(|e| e.to_string())?;
    
    let mut tags: Vec<String> = profiles
        .iter()
        .flat_map(|profile| &profile.tags)
        .cloned()
        .collect();
    
    tags.sort();
    tags.dedup();
    
    Ok(tags)
}

/// Get unique folders from all profiles
#[tauri::command]
pub async fn get_all_profile_folders(
    store: State<'_, ConnectionProfileStoreState>,
) -> Result<Vec<String>, String> {
    let store = store.lock().await;
    let profiles = store.get_all_profiles().await.map_err(|e| e.to_string())?;
    
    let mut folders: Vec<String> = profiles
        .iter()
        .filter_map(|profile| profile.folder.clone())
        .collect();
    
    folders.sort();
    folders.dedup();
    
    Ok(folders)
}

/// Bulk update profiles (for batch operations)
#[tauri::command]
pub async fn bulk_update_profiles(
    store: State<'_, ConnectionProfileStoreState>,
    updates: Vec<(String, ConnectionProfile)>, // Vec of (id, updated_profile)
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    let mut results = Vec::new();
    
    for (id, profile) in updates {
        match store.update_profile(&id, profile).await {
            Ok(updated) => results.push(updated),
            Err(e) => return Err(format!("Failed to update profile {}: {}", id, e)),
        }
    }
    
    Ok(results)
}

/// Bulk delete profiles
#[tauri::command]
pub async fn bulk_delete_profiles(
    store: State<'_, ConnectionProfileStoreState>,
    ids: Vec<String>,
) -> Result<Vec<ConnectionProfile>, String> {
    let store = store.lock().await;
    let mut results = Vec::new();
    
    for id in ids {
        match store.delete_profile(&id).await {
            Ok(deleted) => results.push(deleted),
            Err(e) => return Err(format!("Failed to delete profile {}: {}", id, e)),
        }
    }
    
    Ok(results)
}