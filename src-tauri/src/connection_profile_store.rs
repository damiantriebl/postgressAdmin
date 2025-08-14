use crate::connection_profile::*;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during profile store operations
#[derive(Debug, Error)]
pub enum StoreError {
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    
    #[error("Profile already exists: {0}")]
    ProfileAlreadyExists(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Invalid profile data: {0}")]
    InvalidProfileData(String),
    
    #[error("Storage initialization failed: {0}")]
    InitializationError(String),
}

/// Search and filtering options for profiles
#[derive(Debug, Clone, Default)]
pub struct ProfileSearchOptions {
    pub query: Option<String>,
    pub tags: Option<Vec<String>>,
    pub folder: Option<String>,
    pub environment: Option<Environment>,
    pub is_favorite: Option<bool>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Sorting options for profile results
#[derive(Debug, Clone)]
pub enum ProfileSortBy {
    Name,
    CreatedAt,
    UpdatedAt,
    LastUsed,
    UseCount,
}

#[derive(Debug, Clone)]
pub enum SortDirection {
    Ascending,
    Descending,
}

/// Profile storage metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StorageMetadata {
    version: String,
    created_at: DateTime<Utc>,
    last_updated: DateTime<Utc>,
    profile_count: usize,
}

/// Connection profile storage system with file-based persistence
pub struct ConnectionProfileStore {
    storage_path: PathBuf,
    profiles: RwLock<HashMap<String, ConnectionProfile>>,
    metadata: RwLock<StorageMetadata>,
}

impl ConnectionProfileStore {
    /// Create a new connection profile store
    pub fn new<P: AsRef<Path>>(storage_path: P) -> Result<Self, StoreError> {
        let storage_path = storage_path.as_ref().to_path_buf();
        
        // Ensure the storage directory exists
        if let Some(parent) = storage_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                StoreError::InitializationError(format!("Failed to create storage directory: {}", e))
            })?;
        }

        let metadata = StorageMetadata {
            version: "1.0.0".to_string(),
            created_at: Utc::now(),
            last_updated: Utc::now(),
            profile_count: 0,
        };

        let store = Self {
            storage_path,
            profiles: RwLock::new(HashMap::new()),
            metadata: RwLock::new(metadata),
        };

        Ok(store)
    }

    /// Load profiles from storage
    pub async fn load_profiles(&self) -> Result<Vec<ConnectionProfile>, StoreError> {
        if !self.storage_path.exists() {
            // No storage file exists yet, return empty list
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.storage_path)?;
        let stored_data: StoredProfileData = serde_json::from_str(&content)?;

        // Validate version compatibility
        if stored_data.metadata.version != "1.0.0" {
            return Err(StoreError::InvalidProfileData(
                format!("Unsupported storage version: {}", stored_data.metadata.version)
            ));
        }

        // Update in-memory storage
        let mut profiles = self.profiles.write().await;
        let mut metadata = self.metadata.write().await;

        profiles.clear();
        for profile in &stored_data.profiles {
            profiles.insert(profile.id.clone(), profile.clone());
        }

        *metadata = stored_data.metadata;

        Ok(stored_data.profiles)
    }

    /// Save all profiles to storage
    async fn save_to_disk(&self) -> Result<(), StoreError> {
        let profiles = self.profiles.read().await;
        let mut metadata = self.metadata.write().await;

        metadata.last_updated = Utc::now();
        metadata.profile_count = profiles.len();

        let stored_data = StoredProfileData {
            metadata: (*metadata).clone(),
            profiles: profiles.values().cloned().collect(),
        };

        let content = serde_json::to_string_pretty(&stored_data)?;
        fs::write(&self.storage_path, content)?;

        Ok(())
    }

    /// Create a new connection profile
    pub async fn create_profile(&self, mut profile: ConnectionProfile) -> Result<ConnectionProfile, StoreError> {
        let mut profiles = self.profiles.write().await;

        // Check if profile with same ID already exists
        if profiles.contains_key(&profile.id) {
            return Err(StoreError::ProfileAlreadyExists(profile.id));
        }

        // Check if profile with same name already exists
        if profiles.values().any(|p| p.name == profile.name) {
            return Err(StoreError::ProfileAlreadyExists(format!("Profile with name '{}' already exists", profile.name)));
        }

        // Ensure timestamps are set
        let now = Utc::now();
        profile.created_at = now;
        profile.updated_at = now;

        // Insert profile
        let profile_id = profile.id.clone();
        profiles.insert(profile_id, profile.clone());

        // Release the write lock before saving to disk
        drop(profiles);

        // Save to disk
        self.save_to_disk().await?;

        Ok(profile)
    }

    /// Get a profile by ID
    pub async fn get_profile(&self, id: &str) -> Result<ConnectionProfile, StoreError> {
        let profiles = self.profiles.read().await;
        profiles.get(id)
            .cloned()
            .ok_or_else(|| StoreError::ProfileNotFound(id.to_string()))
    }

    /// Update an existing profile
    pub async fn update_profile(&self, id: &str, mut updated_profile: ConnectionProfile) -> Result<ConnectionProfile, StoreError> {
        let mut profiles = self.profiles.write().await;

        // Check if profile exists
        if !profiles.contains_key(id) {
            return Err(StoreError::ProfileNotFound(id.to_string()));
        }

        // Check if name conflicts with another profile
        if let Some(existing) = profiles.values().find(|p| p.name == updated_profile.name && p.id != id) {
            return Err(StoreError::ProfileAlreadyExists(
                format!("Profile with name '{}' already exists (ID: {})", updated_profile.name, existing.id)
            ));
        }

        // Preserve creation time and update timestamp
        if let Some(existing) = profiles.get(id) {
            updated_profile.created_at = existing.created_at;
            updated_profile.use_count = existing.use_count;
            updated_profile.last_used = existing.last_used;
        }
        updated_profile.updated_at = Utc::now();

        // Update profile
        profiles.insert(id.to_string(), updated_profile.clone());

        // Release the write lock before saving to disk
        drop(profiles);

        // Save to disk
        self.save_to_disk().await?;

        Ok(updated_profile)
    }

    /// Delete a profile by ID
    pub async fn delete_profile(&self, id: &str) -> Result<ConnectionProfile, StoreError> {
        let mut profiles = self.profiles.write().await;

        let removed_profile = profiles.remove(id)
            .ok_or_else(|| StoreError::ProfileNotFound(id.to_string()))?;

        // Release the write lock before saving to disk
        drop(profiles);

        // Save to disk
        self.save_to_disk().await?;

        Ok(removed_profile)
    }

    /// Get all profiles
    pub async fn get_all_profiles(&self) -> Result<Vec<ConnectionProfile>, StoreError> {
        let profiles = self.profiles.read().await;
        Ok(profiles.values().cloned().collect())
    }

    /// Search profiles with filtering and sorting options
    pub async fn search_profiles(
        &self,
        options: &ProfileSearchOptions,
        sort_by: Option<ProfileSortBy>,
        sort_direction: Option<SortDirection>,
    ) -> Result<Vec<ConnectionProfile>, StoreError> {
        let profiles = self.profiles.read().await;
        let mut results: Vec<ConnectionProfile> = profiles.values().cloned().collect();

        // Apply filters
        if let Some(query) = &options.query {
            let query_lower = query.to_lowercase();
            results.retain(|profile| {
                profile.name.to_lowercase().contains(&query_lower)
                    || profile.description.as_ref().map_or(false, |d| d.to_lowercase().contains(&query_lower))
                    || profile.config.host.to_lowercase().contains(&query_lower)
                    || profile.config.database.to_lowercase().contains(&query_lower)
                    || profile.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            });
        }

        if let Some(tags) = &options.tags {
            results.retain(|profile| {
                tags.iter().any(|tag| profile.tags.contains(tag))
            });
        }

        if let Some(folder) = &options.folder {
            results.retain(|profile| {
                profile.folder.as_ref().map_or(false, |f| f == folder)
            });
        }

        if let Some(environment) = &options.environment {
            results.retain(|profile| {
                std::mem::discriminant(&profile.metadata.environment) == std::mem::discriminant(environment)
            });
        }

        if let Some(is_favorite) = options.is_favorite {
            results.retain(|profile| profile.metadata.is_favorite == is_favorite);
        }

        // Apply sorting
        if let Some(sort_by) = sort_by {
            let direction = sort_direction.unwrap_or(SortDirection::Ascending);
            results.sort_by(|a, b| {
                let comparison = match sort_by {
                    ProfileSortBy::Name => a.name.cmp(&b.name),
                    ProfileSortBy::CreatedAt => a.created_at.cmp(&b.created_at),
                    ProfileSortBy::UpdatedAt => a.updated_at.cmp(&b.updated_at),
                    ProfileSortBy::LastUsed => {
                        match (a.last_used, b.last_used) {
                            (Some(a_time), Some(b_time)) => a_time.cmp(&b_time),
                            (Some(_), None) => std::cmp::Ordering::Greater,
                            (None, Some(_)) => std::cmp::Ordering::Less,
                            (None, None) => std::cmp::Ordering::Equal,
                        }
                    }
                    ProfileSortBy::UseCount => a.use_count.cmp(&b.use_count),
                };

                match direction {
                    SortDirection::Ascending => comparison,
                    SortDirection::Descending => comparison.reverse(),
                }
            });
        }

        // Apply pagination
        if let Some(offset) = options.offset {
            if offset < results.len() {
                results = results.into_iter().skip(offset).collect();
            } else {
                results.clear();
            }
        }

        if let Some(limit) = options.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    /// Get profiles by tag
    pub async fn get_profiles_by_tag(&self, tag: &str) -> Result<Vec<ConnectionProfile>, StoreError> {
        let options = ProfileSearchOptions {
            tags: Some(vec![tag.to_string()]),
            ..Default::default()
        };
        self.search_profiles(&options, None, None).await
    }

    /// Get profiles by folder
    pub async fn get_profiles_by_folder(&self, folder: &str) -> Result<Vec<ConnectionProfile>, StoreError> {
        let options = ProfileSearchOptions {
            folder: Some(folder.to_string()),
            ..Default::default()
        };
        self.search_profiles(&options, None, None).await
    }

    /// Get favorite profiles
    pub async fn get_favorite_profiles(&self) -> Result<Vec<ConnectionProfile>, StoreError> {
        let options = ProfileSearchOptions {
            is_favorite: Some(true),
            ..Default::default()
        };
        self.search_profiles(&options, Some(ProfileSortBy::LastUsed), Some(SortDirection::Descending)).await
    }

    /// Get recently used profiles
    pub async fn get_recent_profiles(&self, limit: usize) -> Result<Vec<ConnectionProfile>, StoreError> {
        let profiles = self.profiles.read().await;
        let mut results: Vec<ConnectionProfile> = profiles.values()
            .filter(|p| p.last_used.is_some())
            .cloned()
            .collect();

        results.sort_by(|a, b| {
            b.last_used.unwrap_or(DateTime::<Utc>::MIN_UTC)
                .cmp(&a.last_used.unwrap_or(DateTime::<Utc>::MIN_UTC))
        });

        results.truncate(limit);
        Ok(results)
    }

    /// Mark a profile as used (increment use count and update last used timestamp)
    pub async fn mark_profile_used(&self, id: &str) -> Result<ConnectionProfile, StoreError> {
        let mut profiles = self.profiles.write().await;

        let profile = profiles.get_mut(id)
            .ok_or_else(|| StoreError::ProfileNotFound(id.to_string()))?;

        profile.mark_used();
        let updated_profile = profile.clone();

        // Release the write lock before saving to disk
        drop(profiles);

        // Save to disk
        self.save_to_disk().await?;

        Ok(updated_profile)
    }

    /// Get storage statistics
    pub async fn get_storage_stats(&self) -> Result<StorageStats, StoreError> {
        let profiles = self.profiles.read().await;
        let metadata = self.metadata.read().await;

        let total_profiles = profiles.len();
        let favorite_count = profiles.values().filter(|p| p.metadata.is_favorite).count();
        let profiles_with_usage = profiles.values().filter(|p| p.use_count > 0).count();
        
        let environments: HashMap<String, usize> = profiles.values()
            .fold(HashMap::new(), |mut acc, profile| {
                let env_name = profile.metadata.environment.to_string();
                *acc.entry(env_name).or_insert(0) += 1;
                acc
            });

        let tags: HashMap<String, usize> = profiles.values()
            .flat_map(|profile| &profile.tags)
            .fold(HashMap::new(), |mut acc, tag| {
                *acc.entry(tag.clone()).or_insert(0) += 1;
                acc
            });

        Ok(StorageStats {
            total_profiles,
            favorite_count,
            profiles_with_usage,
            environments,
            tags,
            storage_version: metadata.version.clone(),
            created_at: metadata.created_at,
            last_updated: metadata.last_updated,
        })
    }
}

/// Data structure for file storage
#[derive(Debug, Serialize, Deserialize)]
struct StoredProfileData {
    metadata: StorageMetadata,
    profiles: Vec<ConnectionProfile>,
}

/// Storage statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_profiles: usize,
    pub favorite_count: usize,
    pub profiles_with_usage: usize,
    pub environments: HashMap<String, usize>,
    pub tags: HashMap<String, usize>,
    pub storage_version: String,
    pub created_at: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use tokio;

    fn create_test_profile(name: &str) -> ConnectionProfile {
        let config = AdvancedConnectionConfig {
            host: "localhost".to_string(),
            port: 5432,
            database: "testdb".to_string(),
            username: "testuser".to_string(),
            ..Default::default()
        };
        ConnectionProfile::new(name.to_string(), config)
    }

    #[tokio::test]
    async fn test_create_and_get_profile() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Test Profile");
        let profile_id = profile.id.clone();

        // Create profile
        let created = store.create_profile(profile).await.unwrap();
        assert_eq!(created.name, "Test Profile");

        // Get profile
        let retrieved = store.get_profile(&profile_id).await.unwrap();
        assert_eq!(retrieved.name, "Test Profile");
        assert_eq!(retrieved.id, profile_id);
    }

    #[tokio::test]
    async fn test_update_profile() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Original Name");
        let profile_id = profile.id.clone();

        // Create profile
        store.create_profile(profile).await.unwrap();

        // Update profile
        let mut updated_profile = store.get_profile(&profile_id).await.unwrap();
        updated_profile.name = "Updated Name".to_string();
        updated_profile.description = Some("Updated description".to_string());

        let result = store.update_profile(&profile_id, updated_profile).await.unwrap();
        assert_eq!(result.name, "Updated Name");
        assert_eq!(result.description, Some("Updated description".to_string()));

        // Verify update persisted
        let retrieved = store.get_profile(&profile_id).await.unwrap();
        assert_eq!(retrieved.name, "Updated Name");
    }

    #[tokio::test]
    async fn test_delete_profile() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("To Delete");
        let profile_id = profile.id.clone();

        // Create profile
        store.create_profile(profile).await.unwrap();

        // Delete profile
        let deleted = store.delete_profile(&profile_id).await.unwrap();
        assert_eq!(deleted.name, "To Delete");

        // Verify deletion
        let result = store.get_profile(&profile_id).await;
        assert!(matches!(result, Err(StoreError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_search_profiles() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        // Create test profiles
        let mut profile1 = create_test_profile("Development DB");
        profile1.tags = vec!["dev".to_string(), "local".to_string()];
        profile1.metadata.environment = Environment::Development;

        let mut profile2 = create_test_profile("Production DB");
        profile2.tags = vec!["prod".to_string(), "remote".to_string()];
        profile2.metadata.environment = Environment::Production;
        profile2.metadata.is_favorite = true;

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        // Search by query
        let options = ProfileSearchOptions {
            query: Some("Development".to_string()),
            ..Default::default()
        };
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Development DB");

        // Search by tag
        let options = ProfileSearchOptions {
            tags: Some(vec!["prod".to_string()]),
            ..Default::default()
        };
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Production DB");

        // Search favorites
        let options = ProfileSearchOptions {
            is_favorite: Some(true),
            ..Default::default()
        };
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Production DB");
    }

    #[tokio::test]
    async fn test_mark_profile_used() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Usage Test");
        let profile_id = profile.id.clone();

        // Create profile
        store.create_profile(profile).await.unwrap();

        // Mark as used
        let updated = store.mark_profile_used(&profile_id).await.unwrap();
        assert_eq!(updated.use_count, 1);
        assert!(updated.last_used.is_some());

        // Mark as used again
        let updated = store.mark_profile_used(&profile_id).await.unwrap();
        assert_eq!(updated.use_count, 2);
    }

    #[tokio::test]
    async fn test_persistence() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");

        let profile = create_test_profile("Persistence Test");
        let profile_id = profile.id.clone();

        // Create store and profile
        {
            let store = ConnectionProfileStore::new(&storage_path).unwrap();
            store.create_profile(profile).await.unwrap();
        }

        // Create new store instance and load
        {
            let store = ConnectionProfileStore::new(&storage_path).unwrap();
            store.load_profiles().await.unwrap();
            
            let retrieved = store.get_profile(&profile_id).await.unwrap();
            assert_eq!(retrieved.name, "Persistence Test");
        }
    }

    #[tokio::test]
    async fn test_duplicate_name_prevention() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("Duplicate Name");
        let profile2 = create_test_profile("Duplicate Name");

        // Create first profile
        store.create_profile(profile1).await.unwrap();

        // Try to create second profile with same name
        let result = store.create_profile(profile2).await;
        assert!(matches!(result, Err(StoreError::ProfileAlreadyExists(_))));
    }
}