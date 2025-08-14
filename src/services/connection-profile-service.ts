import { invoke } from '@tauri-apps/api/core';
import type { 
  ConnectionProfile, 
  AdvancedConnectionConfig,
  ProfileSearchFilters,
  ProfileSortOptions,
  Environment,
  StorageStats
} from '@/types/database';

/**
 * Service for managing connection profiles through Tauri commands
 */
export class ConnectionProfileService {
  /**
   * Create a sample connection profile for testing
   */
  static async createSampleProfile(): Promise<ConnectionProfile> {
    try {
      const profile = await invoke<ConnectionProfile>('create_sample_connection_profile');
      
      // Convert date strings to Date objects
      return {
        ...profile,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt),
        lastUsed: profile.lastUsed ? new Date(profile.lastUsed) : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to create sample profile: ${error}`);
    }
  }

  /**
   * Validate a connection profile
   */
  static async validateProfile(profile: ConnectionProfile): Promise<boolean> {
    try {
      // Convert Date objects to strings for serialization
      const serializedProfile = {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
        lastUsed: profile.lastUsed?.toISOString(),
      };

      return await invoke<boolean>('validate_connection_profile', { 
        profile: serializedProfile 
      });
    } catch (error) {
      throw new Error(`Profile validation failed: ${error}`);
    }
  }

  /**
   * Generate a connection string from configuration
   */
  static async generateConnectionString(
    config: AdvancedConnectionConfig, 
    password: string
  ): Promise<string> {
    try {
      return await invoke<string>('generate_connection_string', { 
        config, 
        password 
      });
    } catch (error) {
      throw new Error(`Failed to generate connection string: ${error}`);
    }
  }

  /**
   * Get default connection configuration
   */
  static async getDefaultConfig(): Promise<AdvancedConnectionConfig> {
    try {
      return await invoke<AdvancedConnectionConfig>('get_default_connection_config');
    } catch (error) {
      throw new Error(`Failed to get default config: ${error}`);
    }
  }

  /**
   * Get available SSL modes
   */
  static async getSSLModes(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_ssl_modes');
    } catch (error) {
      throw new Error(`Failed to get SSL modes: ${error}`);
    }
  }

  /**
   * Get available environments
   */
  static async getEnvironments(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_environments');
    } catch (error) {
      throw new Error(`Failed to get environments: ${error}`);
    }
  }

  // ===== CONNECTION PROFILE STORE OPERATIONS =====

  /**
   * Initialize the profile store and load existing profiles
   */
  static async initializeStore(): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('initialize_profile_store');
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to initialize profile store: ${error}`);
    }
  }

  /**
   * Create a new connection profile
   */
  static async createProfile(profile: ConnectionProfile): Promise<ConnectionProfile> {
    try {
      const serializedProfile = this.serializeProfile(profile);
      const created = await invoke<ConnectionProfile>('create_connection_profile', { 
        profile: serializedProfile 
      });
      return this.deserializeProfile(created);
    } catch (error) {
      throw new Error(`Failed to create profile: ${error}`);
    }
  }

  /**
   * Get a connection profile by ID
   */
  static async getProfile(id: string): Promise<ConnectionProfile> {
    try {
      const profile = await invoke<ConnectionProfile>('get_connection_profile', { id });
      return this.deserializeProfile(profile);
    } catch (error) {
      throw new Error(`Failed to get profile: ${error}`);
    }
  }

  /**
   * Update an existing connection profile
   */
  static async updateProfile(id: string, profile: ConnectionProfile): Promise<ConnectionProfile> {
    try {
      const serializedProfile = this.serializeProfile(profile);
      const updated = await invoke<ConnectionProfile>('update_connection_profile', { 
        id, 
        profile: serializedProfile 
      });
      return this.deserializeProfile(updated);
    } catch (error) {
      throw new Error(`Failed to update profile: ${error}`);
    }
  }

  /**
   * Delete a connection profile
   */
  static async deleteProfile(id: string): Promise<ConnectionProfile> {
    try {
      const deleted = await invoke<ConnectionProfile>('delete_connection_profile', { id });
      return this.deserializeProfile(deleted);
    } catch (error) {
      throw new Error(`Failed to delete profile: ${error}`);
    }
  }

  /**
   * Get all connection profiles
   */
  static async getAllProfiles(): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_all_connection_profiles');
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to get all profiles: ${error}`);
    }
  }

  /**
   * Search connection profiles with filtering and sorting
   */
  static async searchProfiles(
    filters?: ProfileSearchFilters,
    sortOptions?: ProfileSortOptions
  ): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('search_connection_profiles', {
        query: filters?.query,
        tags: filters?.tags,
        folder: filters?.folder,
        environment: filters?.environment,
        isFavorite: filters?.isFavorite,
        limit: filters?.limit,
        offset: filters?.offset,
        sortBy: sortOptions?.field,
        sortDirection: sortOptions?.direction,
      });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to search profiles: ${error}`);
    }
  }

  /**
   * Get profiles by tag
   */
  static async getProfilesByTag(tag: string): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_profiles_by_tag', { tag });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to get profiles by tag: ${error}`);
    }
  }

  /**
   * Get profiles by folder
   */
  static async getProfilesByFolder(folder: string): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_profiles_by_folder', { folder });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to get profiles by folder: ${error}`);
    }
  }

  /**
   * Get favorite profiles
   */
  static async getFavoriteProfiles(): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_favorite_profiles');
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to get favorite profiles: ${error}`);
    }
  }

  /**
   * Get recently used profiles
   */
  static async getRecentProfiles(limit: number = 10): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('get_recent_profiles', { limit });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to get recent profiles: ${error}`);
    }
  }

  /**
   * Mark a profile as used
   */
  static async markProfileUsed(id: string): Promise<ConnectionProfile> {
    try {
      const profile = await invoke<ConnectionProfile>('mark_profile_used', { id });
      return this.deserializeProfile(profile);
    } catch (error) {
      throw new Error(`Failed to mark profile as used: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<StorageStats> {
    try {
      const stats = await invoke<StorageStats>('get_profile_storage_stats');
      return {
        ...stats,
        createdAt: new Date(stats.createdAt),
        lastUpdated: new Date(stats.lastUpdated),
      };
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }

  /**
   * Create a profile from basic parameters
   */
  static async createProfileFromParams(params: {
    name: string;
    description?: string;
    host: string;
    port: number;
    database: string;
    username: string;
    tags?: string[];
    folder?: string;
    environment?: Environment;
    isFavorite?: boolean;
  }): Promise<ConnectionProfile> {
    try {
      const profile = await invoke<ConnectionProfile>('create_profile_from_params', {
        name: params.name,
        description: params.description,
        host: params.host,
        port: params.port,
        database: params.database,
        username: params.username,
        tags: params.tags,
        folder: params.folder,
        environment: params.environment,
        isFavorite: params.isFavorite,
      });
      return this.deserializeProfile(profile);
    } catch (error) {
      throw new Error(`Failed to create profile from params: ${error}`);
    }
  }

  /**
   * Validate profile data
   */
  static async validateProfileData(profile: ConnectionProfile): Promise<boolean> {
    try {
      const serializedProfile = this.serializeProfile(profile);
      return await invoke<boolean>('validate_profile_data', { 
        profile: serializedProfile 
      });
    } catch (error) {
      throw new Error(`Failed to validate profile data: ${error}`);
    }
  }

  /**
   * Get all unique tags from profiles
   */
  static async getAllTags(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_all_profile_tags');
    } catch (error) {
      throw new Error(`Failed to get all tags: ${error}`);
    }
  }

  /**
   * Get all unique folders from profiles
   */
  static async getAllFolders(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_all_profile_folders');
    } catch (error) {
      throw new Error(`Failed to get all folders: ${error}`);
    }
  }

  /**
   * Bulk update profiles
   */
  static async bulkUpdateProfiles(updates: Array<{ id: string; profile: ConnectionProfile }>): Promise<ConnectionProfile[]> {
    try {
      const serializedUpdates = updates.map(({ id, profile }) => [
        id, 
        this.serializeProfile(profile)
      ]);
      const profiles = await invoke<ConnectionProfile[]>('bulk_update_profiles', { 
        updates: serializedUpdates 
      });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to bulk update profiles: ${error}`);
    }
  }

  /**
   * Bulk delete profiles
   */
  static async bulkDeleteProfiles(ids: string[]): Promise<ConnectionProfile[]> {
    try {
      const profiles = await invoke<ConnectionProfile[]>('bulk_delete_profiles', { ids });
      return profiles.map(this.deserializeProfile);
    } catch (error) {
      throw new Error(`Failed to bulk delete profiles: ${error}`);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Serialize a profile for sending to Rust backend
   */
  private static serializeProfile(profile: ConnectionProfile): any {
    return {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastUsed: profile.lastUsed?.toISOString(),
    };
  }

  /**
   * Deserialize a profile received from Rust backend
   */
  private static deserializeProfile(profile: any): ConnectionProfile {
    return {
      ...profile,
      createdAt: new Date(profile.createdAt || profile.created_at),
      updatedAt: new Date(profile.updatedAt || profile.updated_at),
      lastUsed: profile.lastUsed || profile.last_used ? new Date(profile.lastUsed || profile.last_used) : undefined,
      useCount: profile.useCount || profile.use_count || 0,
    };
  }

  /**
   * Test serialization by creating a profile and validating it
   */
  static async testSerialization(): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a sample profile
      const profile = await this.createSampleProfile();
      
      // Validate it
      const isValid = await this.validateProfile(profile);
      
      if (!isValid) {
        return { success: false, error: 'Profile validation failed' };
      }

      // Test connection string generation
      const connectionString = await this.generateConnectionString(
        profile.config, 
        'testpassword'
      );

      if (!connectionString.includes('postgresql://')) {
        return { success: false, error: 'Invalid connection string format' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Test the connection profile store functionality
   */
  static async testStore(): Promise<{ success: boolean; error?: string }> {
    try {
      // Initialize store
      await this.initializeStore();

      // Create a test profile
      const testProfile = await this.createSampleProfile();
      const created = await this.createProfile(testProfile);

      // Get the profile back
      const retrieved = await this.getProfile(created.id);
      if (retrieved.name !== created.name) {
        return { success: false, error: 'Profile retrieval failed' };
      }

      // Update the profile
      const updated = { ...retrieved, description: 'Updated description' };
      await this.updateProfile(created.id, updated);

      // Search for the profile
      const searchResults = await this.searchProfiles({ query: created.name });
      if (searchResults.length === 0) {
        return { success: false, error: 'Profile search failed' };
      }

      // Mark as used
      await this.markProfileUsed(created.id);

      // Get storage stats
      const stats = await this.getStorageStats();
      if (stats.totalProfiles === 0) {
        return { success: false, error: 'Storage stats failed' };
      }

      // Clean up - delete the test profile
      await this.deleteProfile(created.id);

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export for use in components
export default ConnectionProfileService;