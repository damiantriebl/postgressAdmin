#[cfg(test)]
mod tests {
    use super::*;
    use crate::connection_profile::*;
    use crate::connection_profile_store::*;
    use tempfile::tempdir;
    use tokio;
    use std::time::Duration;

    fn create_test_profile(name: &str) -> ConnectionProfile {
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
            ssl_config: SSLConfig::default(),
            custom_parameters: std::collections::HashMap::new(),
            connection_string_template: None,
        };
        ConnectionProfile::new(name.to_string(), config)
    }

    fn create_test_profile_with_metadata(name: &str, environment: Environment, is_favorite: bool, tags: Vec<String>) -> ConnectionProfile {
        let mut profile = create_test_profile(name);
        profile.metadata.environment = environment;
        profile.metadata.is_favorite = is_favorite;
        profile.tags = tags;
        profile
    }

    #[tokio::test]
    async fn test_store_initialization() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        
        let store = ConnectionProfileStore::new(&storage_path).unwrap();
        let profiles = store.load_profiles().await.unwrap();
        assert!(profiles.is_empty());
    }

    #[tokio::test]
    async fn test_create_profile_success() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Test Profile");
        let profile_id = profile.id.clone();

        let created = store.create_profile(profile).await.unwrap();
        assert_eq!(created.name, "Test Profile");
        assert_eq!(created.id, profile_id);
        assert!(created.created_at <= chrono::Utc::now());
        assert!(created.updated_at <= chrono::Utc::now());
    }

    #[tokio::test]
    async fn test_create_profile_duplicate_name() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("Duplicate Name");
        let profile2 = create_test_profile("Duplicate Name");

        store.create_profile(profile1).await.unwrap();
        let result = store.create_profile(profile2).await;
        
        assert!(matches!(result, Err(StoreError::ProfileAlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_get_profile_success() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Get Test");
        let profile_id = profile.id.clone();
        
        store.create_profile(profile).await.unwrap();
        let retrieved = store.get_profile(&profile_id).await.unwrap();
        
        assert_eq!(retrieved.name, "Get Test");
        assert_eq!(retrieved.id, profile_id);
    }

    #[tokio::test]
    async fn test_get_profile_not_found() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let result = store.get_profile("nonexistent-id").await;
        assert!(matches!(result, Err(StoreError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_update_profile_success() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Original Name");
        let profile_id = profile.id.clone();
        let original_created_at = profile.created_at;
        
        store.create_profile(profile).await.unwrap();

        // Update profile
        let mut updated_profile = store.get_profile(&profile_id).await.unwrap();
        updated_profile.name = "Updated Name".to_string();
        updated_profile.description = Some("Updated description".to_string());

        let result = store.update_profile(&profile_id, updated_profile).await.unwrap();
        
        assert_eq!(result.name, "Updated Name");
        assert_eq!(result.description, Some("Updated description".to_string()));
        assert_eq!(result.created_at, original_created_at); // Should preserve creation time
        assert!(result.updated_at > original_created_at); // Should update timestamp
    }

    #[tokio::test]
    async fn test_update_profile_not_found() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Test");
        let result = store.update_profile("nonexistent-id", profile).await;
        
        assert!(matches!(result, Err(StoreError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_profile_success() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("To Delete");
        let profile_id = profile.id.clone();
        
        store.create_profile(profile).await.unwrap();
        let deleted = store.delete_profile(&profile_id).await.unwrap();
        
        assert_eq!(deleted.name, "To Delete");
        
        // Verify deletion
        let result = store.get_profile(&profile_id).await;
        assert!(matches!(result, Err(StoreError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_profile_not_found() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let result = store.delete_profile("nonexistent-id").await;
        assert!(matches!(result, Err(StoreError::ProfileNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_all_profiles() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("Profile 1");
        let profile2 = create_test_profile("Profile 2");
        let profile3 = create_test_profile("Profile 3");

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();
        store.create_profile(profile3).await.unwrap();

        let all_profiles = store.get_all_profiles().await.unwrap();
        assert_eq!(all_profiles.len(), 3);
        
        let names: Vec<String> = all_profiles.iter().map(|p| p.name.clone()).collect();
        assert!(names.contains(&"Profile 1".to_string()));
        assert!(names.contains(&"Profile 2".to_string()));
        assert!(names.contains(&"Profile 3".to_string()));
    }

    #[tokio::test]
    async fn test_search_profiles_by_query() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("Development Database");
        let profile2 = create_test_profile("Production Database");
        let profile3 = create_test_profile("Test Environment");

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();
        store.create_profile(profile3).await.unwrap();

        let options = ProfileSearchOptions {
            query: Some("Development".to_string()),
            ..Default::default()
        };
        
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Development Database");
    }

    #[tokio::test]
    async fn test_search_profiles_by_tags() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Dev DB", 
            Environment::Development, 
            false, 
            vec!["dev".to_string(), "local".to_string()]
        );
        let profile2 = create_test_profile_with_metadata(
            "Prod DB", 
            Environment::Production, 
            true, 
            vec!["prod".to_string(), "remote".to_string()]
        );

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let options = ProfileSearchOptions {
            tags: Some(vec!["prod".to_string()]),
            ..Default::default()
        };
        
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Prod DB");
    }

    #[tokio::test]
    async fn test_search_profiles_by_environment() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Dev DB", 
            Environment::Development, 
            false, 
            vec![]
        );
        let profile2 = create_test_profile_with_metadata(
            "Prod DB", 
            Environment::Production, 
            false, 
            vec![]
        );

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let options = ProfileSearchOptions {
            environment: Some(Environment::Production),
            ..Default::default()
        };
        
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Prod DB");
    }

    #[tokio::test]
    async fn test_search_profiles_by_favorite() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Regular DB", 
            Environment::Development, 
            false, 
            vec![]
        );
        let profile2 = create_test_profile_with_metadata(
            "Favorite DB", 
            Environment::Production, 
            true, 
            vec![]
        );

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let options = ProfileSearchOptions {
            is_favorite: Some(true),
            ..Default::default()
        };
        
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Favorite DB");
    }

    #[tokio::test]
    async fn test_search_profiles_with_sorting() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("B Profile");
        let profile2 = create_test_profile("A Profile");
        let profile3 = create_test_profile("C Profile");

        store.create_profile(profile1).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await; // Ensure different timestamps
        store.create_profile(profile2).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        store.create_profile(profile3).await.unwrap();

        // Test name sorting ascending
        let results = store.search_profiles(
            &ProfileSearchOptions::default(), 
            Some(ProfileSortBy::Name), 
            Some(SortDirection::Ascending)
        ).await.unwrap();
        
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "A Profile");
        assert_eq!(results[1].name, "B Profile");
        assert_eq!(results[2].name, "C Profile");

        // Test name sorting descending
        let results = store.search_profiles(
            &ProfileSearchOptions::default(), 
            Some(ProfileSortBy::Name), 
            Some(SortDirection::Descending)
        ).await.unwrap();
        
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].name, "C Profile");
        assert_eq!(results[1].name, "B Profile");
        assert_eq!(results[2].name, "A Profile");
    }

    #[tokio::test]
    async fn test_search_profiles_with_pagination() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        // Create 5 profiles
        for i in 1..=5 {
            let profile = create_test_profile(&format!("Profile {}", i));
            store.create_profile(profile).await.unwrap();
        }

        // Test limit
        let options = ProfileSearchOptions {
            limit: Some(3),
            ..Default::default()
        };
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 3);

        // Test offset
        let options = ProfileSearchOptions {
            offset: Some(2),
            limit: Some(2),
            ..Default::default()
        };
        let results = store.search_profiles(&options, None, None).await.unwrap();
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_get_profiles_by_tag() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Tagged Profile", 
            Environment::Development, 
            false, 
            vec!["test-tag".to_string()]
        );
        let profile2 = create_test_profile_with_metadata(
            "Untagged Profile", 
            Environment::Development, 
            false, 
            vec![]
        );

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let results = store.get_profiles_by_tag("test-tag").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Tagged Profile");
    }

    #[tokio::test]
    async fn test_get_profiles_by_folder() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let mut profile1 = create_test_profile("Folder Profile");
        profile1.folder = Some("test-folder".to_string());
        
        let profile2 = create_test_profile("No Folder Profile");

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let results = store.get_profiles_by_folder("test-folder").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Folder Profile");
    }

    #[tokio::test]
    async fn test_get_favorite_profiles() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Favorite Profile", 
            Environment::Development, 
            true, 
            vec![]
        );
        let profile2 = create_test_profile_with_metadata(
            "Regular Profile", 
            Environment::Development, 
            false, 
            vec![]
        );

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        let results = store.get_favorite_profiles().await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Favorite Profile");
    }

    #[tokio::test]
    async fn test_mark_profile_used() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile = create_test_profile("Usage Test");
        let profile_id = profile.id.clone();
        
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
    async fn test_get_recent_profiles() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile("Profile 1");
        let profile2 = create_test_profile("Profile 2");
        let profile3 = create_test_profile("Profile 3");
        
        let id1 = profile1.id.clone();
        let id2 = profile2.id.clone();
        let id3 = profile3.id.clone();

        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();
        store.create_profile(profile3).await.unwrap();

        // Mark profiles as used with different timestamps
        store.mark_profile_used(&id1).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        store.mark_profile_used(&id2).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        store.mark_profile_used(&id3).await.unwrap();

        let recent = store.get_recent_profiles(2).await.unwrap();
        assert_eq!(recent.len(), 2);
        // Most recent should be first
        assert_eq!(recent[0].name, "Profile 3");
        assert_eq!(recent[1].name, "Profile 2");
    }

    #[tokio::test]
    async fn test_get_storage_stats() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = ConnectionProfileStore::new(&storage_path).unwrap();

        let profile1 = create_test_profile_with_metadata(
            "Dev Profile", 
            Environment::Development, 
            true, 
            vec!["dev".to_string(), "local".to_string()]
        );
        let profile2 = create_test_profile_with_metadata(
            "Prod Profile", 
            Environment::Production, 
            false, 
            vec!["prod".to_string()]
        );

        let id1 = profile1.id.clone();
        store.create_profile(profile1).await.unwrap();
        store.create_profile(profile2).await.unwrap();

        // Mark one profile as used
        store.mark_profile_used(&id1).await.unwrap();

        let stats = store.get_storage_stats().await.unwrap();
        assert_eq!(stats.total_profiles, 2);
        assert_eq!(stats.favorite_count, 1);
        assert_eq!(stats.profiles_with_usage, 1);
        assert_eq!(stats.environments.get("development"), Some(&1));
        assert_eq!(stats.environments.get("production"), Some(&1));
        assert_eq!(stats.tags.get("dev"), Some(&1));
        assert_eq!(stats.tags.get("local"), Some(&1));
        assert_eq!(stats.tags.get("prod"), Some(&1));
    }

    #[tokio::test]
    async fn test_persistence_across_instances() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");

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
    async fn test_concurrent_access() {
        let temp_dir = tempdir().unwrap();
        let storage_path = temp_dir.path().join("test_profiles.json");
        let store = std::sync::Arc::new(ConnectionProfileStore::new(&storage_path).unwrap());

        let mut handles = vec![];

        // Spawn multiple tasks that create profiles concurrently
        for i in 0..10 {
            let store_clone = store.clone();
            let handle = tokio::spawn(async move {
                let profile = create_test_profile(&format!("Concurrent Profile {}", i));
                store_clone.create_profile(profile).await
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        let mut success_count = 0;
        for handle in handles {
            if handle.await.unwrap().is_ok() {
                success_count += 1;
            }
        }

        // All profiles should be created successfully
        assert_eq!(success_count, 10);

        let all_profiles = store.get_all_profiles().await.unwrap();
        assert_eq!(all_profiles.len(), 10);
    }
}