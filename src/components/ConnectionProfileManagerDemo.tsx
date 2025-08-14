import { ConnectionProfileManager } from './ConnectionProfileManager';
import { useConnectionProfiles } from '@/hooks/useConnectionProfiles';
import LoadingSpinner from './LoadingSpinner';
import { Alert } from '@/components/ui/alert';

/**
 * Demo component that shows the ConnectionProfileManager in action
 * This component can be used for testing and development
 */
export function ConnectionProfileManagerDemo() {
  const {
    profiles,
    loading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    connectToProfile,
    refreshProfiles,
  } = useConnectionProfiles();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
        <span className="ml-2">Loading connection profiles...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {error && (
        <Alert className="mb-6">
          <div>
            <h4 className="font-semibold">Error</h4>
            <p>{error}</p>
          </div>
        </Alert>
      )}

      <ConnectionProfileManager
        profiles={profiles}
        onCreateProfile={createProfile}
        onUpdateProfile={updateProfile}
        onDeleteProfile={deleteProfile}
        onConnectToProfile={connectToProfile}
        onRefresh={refreshProfiles}
      />
    </div>
  );
}

export default ConnectionProfileManagerDemo;