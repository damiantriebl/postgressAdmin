/**
 * TypeScript types for the Credential Vault system
 * These types correspond to the Rust structures in the backend
 */

export interface Credentials {
  username: string;
  password: string;
  encrypted_at: string; // ISO 8601 datetime string
}

export interface CredentialResponse {
  success: boolean;
  message: string;
}

export interface StoreCredentialsRequest {
  profile_id: string;
  username: string;
  password: string;
}

export interface RetrieveCredentialsResponse {
  success: boolean;
  username?: string;
  password?: string;
  message: string;
  encrypted_at?: string;
}

/**
 * Credential Vault Service for secure storage and retrieval of database credentials
 */
export class CredentialVaultService {
  /**
   * Initialize the credential vault
   */
  static async initialize(): Promise<CredentialResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<CredentialResponse>('initialize_credential_vault');
  }

  /**
   * Store credentials for a connection profile
   */
  static async storeCredentials(
    profileId: string,
    username: string,
    password: string
  ): Promise<CredentialResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<CredentialResponse>('store_profile_credentials', {
      request: {
        profile_id: profileId,
        username,
        password,
      } as StoreCredentialsRequest,
    });
  }

  /**
   * Retrieve credentials for a connection profile
   */
  static async retrieveCredentials(
    profileId: string
  ): Promise<RetrieveCredentialsResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<RetrieveCredentialsResponse>('retrieve_profile_credentials', {
      profileId,
    });
  }

  /**
   * Update credentials for a connection profile
   */
  static async updateCredentials(
    profileId: string,
    username: string,
    password: string
  ): Promise<CredentialResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<CredentialResponse>('update_profile_credentials', {
      request: {
        profile_id: profileId,
        username,
        password,
      } as StoreCredentialsRequest,
    });
  }

  /**
   * Delete credentials for a connection profile
   */
  static async deleteCredentials(profileId: string): Promise<CredentialResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<CredentialResponse>('delete_profile_credentials', {
      profileId,
    });
  }

  /**
   * Check if credentials exist for a connection profile
   */
  static async hasCredentials(profileId: string): Promise<boolean> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<boolean>('has_profile_credentials', {
      profileId,
    });
  }

  /**
   * List all profiles that have stored credentials
   */
  static async listProfilesWithCredentials(): Promise<string[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string[]>('list_profiles_with_credentials');
  }

  /**
   * Rotate the master encryption key
   * WARNING: This may require re-encryption of existing credentials
   */
  static async rotateMasterKey(): Promise<CredentialResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<CredentialResponse>('rotate_vault_master_key');
  }
}

/**
 * Error types that can be returned from the credential vault
 */
export enum VaultErrorType {
  KeyringError = 'KeyringError',
  EncryptionError = 'EncryptionError',
  DecryptionError = 'DecryptionError',
  SerializationError = 'SerializationError',
  ProfileNotFound = 'ProfileNotFound',
  InvalidCredentialsFormat = 'InvalidCredentialsFormat',
  MasterKeyError = 'MasterKeyError',
}

/**
 * Utility functions for working with credentials
 */
export class CredentialUtils {
  /**
   * Validate username format
   */
  static validateUsername(username: string): boolean {
    return username.length > 0 && username.length <= 255;
  }

  /**
   * Validate password strength (basic validation)
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 1) {
      errors.push('Password cannot be empty');
    }
    
    if (password.length > 1000) {
      errors.push('Password is too long (max 1000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize profile ID for safe storage
   */
  static sanitizeProfileId(profileId: string): string {
    // Remove any characters that might cause issues in keyring storage
    return profileId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Generate a secure profile ID
   */
  static generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Hook for React components to manage credential vault operations
 */
export interface UseCredentialVaultResult {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  storeCredentials: (profileId: string, username: string, password: string) => Promise<void>;
  retrieveCredentials: (profileId: string) => Promise<RetrieveCredentialsResponse>;
  updateCredentials: (profileId: string, username: string, password: string) => Promise<void>;
  deleteCredentials: (profileId: string) => Promise<void>;
  hasCredentials: (profileId: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * React hook for credential vault operations
 */
export function useCredentialVault(): UseCredentialVaultResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const initialize = useCallback(async () => {
    if (isInitialized) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CredentialVaultService.initialize();
      if (response.success) {
        setIsInitialized(true);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize credential vault');
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  const storeCredentials = useCallback(async (profileId: string, username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CredentialVaultService.storeCredentials(profileId, username, password);
      if (!response.success) {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store credentials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retrieveCredentials = useCallback(async (profileId: string): Promise<RetrieveCredentialsResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CredentialVaultService.retrieveCredentials(profileId);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retrieve credentials';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCredentials = useCallback(async (profileId: string, username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CredentialVaultService.updateCredentials(profileId, username, password);
      if (!response.success) {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update credentials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCredentials = useCallback(async (profileId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await CredentialVaultService.deleteCredentials(profileId);
      if (!response.success) {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credentials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasCredentials = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      return await CredentialVaultService.hasCredentials(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check credentials');
      return false;
    }
  }, []);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    storeCredentials,
    retrieveCredentials,
    updateCredentials,
    deleteCredentials,
    hasCredentials,
    clearError,
  };
}

import { useState, useCallback } from 'react';