import { ConnectionProfileManagerDemo } from '@/components/ConnectionProfileManagerDemo';

/**
 * Standalone page for the Connection Profile Manager
 * This can be used as a separate route or integrated into the main app
 */
export function ProfileManagerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      <div className="container mx-auto py-8">
        <ConnectionProfileManagerDemo />
      </div>
    </div>
  );
}

export default ProfileManagerPage;