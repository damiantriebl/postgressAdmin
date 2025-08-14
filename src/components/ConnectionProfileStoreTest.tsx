import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Database, Plus, Search, Trash2 } from 'lucide-react';
import ConnectionProfileService from '@/services/connection-profile-service';
import type { ConnectionProfile, StorageStats } from '@/types/connection-profile';

interface TestResult {
  success: boolean;
  message: string;
  duration?: number;
}

export function ConnectionProfileStoreTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runStoreTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: Initialize store
      const start1 = Date.now();
      const initialProfiles = await ConnectionProfileService.initializeStore();
      addTestResult({
        success: true,
        message: `Store initialized with ${initialProfiles.length} existing profiles`,
        duration: Date.now() - start1
      });

      // Test 2: Create a test profile
      const start2 = Date.now();
      const testProfile = await ConnectionProfileService.createProfileFromParams({
        name: `Test Profile ${Date.now()}`,
        description: 'Test profile created by store test',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        tags: ['test', 'automated'],
        environment: 'development' as any,
        isFavorite: true,
      });
      addTestResult({
        success: true,
        message: `Created test profile: ${testProfile.name}`,
        duration: Date.now() - start2
      });

      // Test 3: Get all profiles
      const start3 = Date.now();
      const allProfiles = await ConnectionProfileService.getAllProfiles();
      setProfiles(allProfiles);
      addTestResult({
        success: true,
        message: `Retrieved ${allProfiles.length} profiles`,
        duration: Date.now() - start3
      });

      // Test 4: Search profiles
      const start4 = Date.now();
      const searchResults = await ConnectionProfileService.searchProfiles({
        query: 'Test',
        isFavorite: true
      });
      addTestResult({
        success: true,
        message: `Search found ${searchResults.length} matching profiles`,
        duration: Date.now() - start4
      });

      // Test 5: Mark profile as used
      const start5 = Date.now();
      const usedProfile = await ConnectionProfileService.markProfileUsed(testProfile.id);
      addTestResult({
        success: true,
        message: `Marked profile as used (use count: ${usedProfile.useCount})`,
        duration: Date.now() - start5
      });

      // Test 6: Get recent profiles
      const start6 = Date.now();
      const recentProfiles = await ConnectionProfileService.getRecentProfiles(5);
      addTestResult({
        success: true,
        message: `Retrieved ${recentProfiles.length} recent profiles`,
        duration: Date.now() - start6
      });

      // Test 7: Get storage stats
      const start7 = Date.now();
      const storageStats = await ConnectionProfileService.getStorageStats();
      setStats(storageStats);
      addTestResult({
        success: true,
        message: `Retrieved storage stats (${storageStats.totalProfiles} total profiles)`,
        duration: Date.now() - start7
      });

      // Test 8: Update profile
      const start8 = Date.now();
      const updatedProfile = await ConnectionProfileService.updateProfile(testProfile.id, {
        ...testProfile,
        description: 'Updated test profile description'
      });
      addTestResult({
        success: true,
        message: `Updated profile: ${updatedProfile.name}`,
        duration: Date.now() - start8
      });

      // Test 9: Get profiles by tag
      const start9 = Date.now();
      const taggedProfiles = await ConnectionProfileService.getProfilesByTag('test');
      addTestResult({
        success: true,
        message: `Found ${taggedProfiles.length} profiles with 'test' tag`,
        duration: Date.now() - start9
      });

      // Test 10: Clean up - delete test profile
      const start10 = Date.now();
      await ConnectionProfileService.deleteProfile(testProfile.id);
      addTestResult({
        success: true,
        message: `Deleted test profile: ${testProfile.name}`,
        duration: Date.now() - start10
      });

      // Refresh profiles list
      const finalProfiles = await ConnectionProfileService.getAllProfiles();
      setProfiles(finalProfiles);

    } catch (error) {
      addTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setProfiles([]);
    setStats(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Profile Store Test
          </CardTitle>
          <CardDescription>
            Test the connection profile storage system functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runStoreTests} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Run Store Tests
            </Button>
            <Button 
              variant="outline" 
              onClick={clearResults}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Results
            </Button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Test Results</h3>
              {testResults.map((result, index) => (
                <Alert key={index} className={result.success ? 'border-green-200' : 'border-red-200'}>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className="flex-1">
                      {result.message}
                      {result.duration && (
                        <span className="text-muted-foreground ml-2">
                          ({result.duration}ms)
                        </span>
                      )}
                    </AlertDescription>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Storage Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalProfiles}</div>
                <div className="text-sm text-muted-foreground">Total Profiles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.favoriteCount}</div>
                <div className="text-sm text-muted-foreground">Favorites</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.profilesWithUsage}</div>
                <div className="text-sm text-muted-foreground">Used Profiles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Object.keys(stats.environments).length}</div>
                <div className="text-sm text-muted-foreground">Environments</div>
              </div>
            </div>
            
            {Object.keys(stats.tags).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.tags).map(([tag, count]) => (
                    <Badge key={tag} variant="secondary">
                      {tag} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Current Profiles ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{profile.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {profile.config.host}:{profile.config.port}/{profile.config.database}
                    </div>
                    {profile.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {profile.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {profile.metadata.isFavorite && (
                      <Badge variant="secondary">Favorite</Badge>
                    )}
                    <Badge variant="outline">
                      {profile.metadata.environment}
                    </Badge>
                    {profile.useCount > 0 && (
                      <Badge variant="outline">
                        Used {profile.useCount}x
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ConnectionProfileStoreTest;