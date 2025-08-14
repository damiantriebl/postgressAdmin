import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ConnectionProfile, 
  Environment, 
  SslMode,
  DEFAULT_ADVANCED_CONFIG,
  DEFAULT_METADATA,
  CreateConnectionProfileRequest
} from '@/types/database';

interface ConnectionProfileManagerProps {
  profiles: ConnectionProfile[];
  onCreateProfile: (profile: CreateConnectionProfileRequest) => Promise<void>;
  onUpdateProfile: (id: string, updates: Partial<ConnectionProfile>) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onConnectToProfile: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface ProfileFormData {
  name: string;
  description: string;
  tags: string;
  folder: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  environment: Environment;
  isFavorite: boolean;
  autoConnect: boolean;
  sslMode: SslMode;
}

const initialFormData: ProfileFormData = {
  name: '',
  description: '',
  tags: '',
  folder: '',
  host: DEFAULT_ADVANCED_CONFIG.host,
  port: DEFAULT_ADVANCED_CONFIG.port.toString(),
  database: DEFAULT_ADVANCED_CONFIG.database,
  username: DEFAULT_ADVANCED_CONFIG.username,
  password: '',
  environment: DEFAULT_METADATA.environment,
  isFavorite: DEFAULT_METADATA.isFavorite,
  autoConnect: DEFAULT_METADATA.autoConnect,
  sslMode: DEFAULT_ADVANCED_CONFIG.sslConfig.mode,
};

export function ConnectionProfileManager({
  profiles,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onConnectToProfile,
  onRefresh
}: ConnectionProfileManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | 'all'>('all');

  // Get unique folders for filtering
  const folders = Array.from(new Set(profiles.map(p => p.folder).filter(Boolean))) as string[];

  // Filter profiles based on search and filters
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = !searchQuery || 
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.config.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.config.database.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFolder = selectedFolder === 'all' || profile.folder === selectedFolder;
    const matchesEnvironment = selectedEnvironment === 'all' || profile.metadata.environment === selectedEnvironment;

    return matchesSearch && matchesFolder && matchesEnvironment;
  });

  const handleInputChange = (field: keyof ProfileFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Connection name is required';
    }
    if (!formData.host.trim()) {
      errors.host = 'Host is required';
    }
    if (!formData.database.trim()) {
      errors.database = 'Database name is required';
    }
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    if (!formData.password.trim() && !editingProfile) {
      errors.password = 'Password is required';
    }

    const port = parseInt(formData.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.port = 'Port must be a number between 1 and 65535';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const profileData: CreateConnectionProfileRequest = {
        name: formData.name,
        description: formData.description || undefined,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        folder: formData.folder || undefined,
        config: {
          ...DEFAULT_ADVANCED_CONFIG,
          host: formData.host,
          port: parseInt(formData.port, 10),
          database: formData.database,
          username: formData.username,
          sslConfig: {
            mode: formData.sslMode,
          },
        },
        metadata: {
          ...DEFAULT_METADATA,
          environment: formData.environment,
          isFavorite: formData.isFavorite,
          autoConnect: formData.autoConnect,
        },
      };

      if (editingProfile) {
        // For updates, we need to pass the full profile data
        const updateData: Partial<ConnectionProfile> = {
          name: profileData.name,
          description: profileData.description,
          tags: profileData.tags,
          folder: profileData.folder,
          config: profileData.config,
          metadata: {
            isFavorite: profileData.metadata?.isFavorite || false,
            autoConnect: profileData.metadata?.autoConnect || false,
            environment: profileData.metadata?.environment || Environment.Development,
            monitoringEnabled: profileData.metadata?.monitoringEnabled || false,
          },
          updatedAt: new Date(),
        };
        await onUpdateProfile(editingProfile.id, updateData);
      } else {
        await onCreateProfile(profileData);
      }

      setIsCreateDialogOpen(false);
      setEditingProfile(null);
      setFormData(initialFormData);
      await onRefresh();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (profile: ConnectionProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      tags: profile.tags.join(', '),
      folder: profile.folder || '',
      host: profile.config.host,
      port: profile.config.port.toString(),
      database: profile.config.database,
      username: profile.config.username,
      password: '', // Never populate password
      environment: profile.metadata.environment,
      isFavorite: profile.metadata.isFavorite,
      autoConnect: profile.metadata.autoConnect,
      sslMode: profile.config.sslConfig.mode,
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (profile: ConnectionProfile) => {
    if (window.confirm(`Are you sure you want to delete "${profile.name}"?`)) {
      try {
        await onDeleteProfile(profile.id);
        await onRefresh();
      } catch (error) {
        console.error('Failed to delete profile:', error);
      }
    }
  };

  const handleConnect = async (profile: ConnectionProfile) => {
    try {
      await onConnectToProfile(profile.id);
    } catch (error) {
      console.error('Failed to connect to profile:', error);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setEditingProfile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Connection Profiles</h2>
          <p className="text-muted-foreground">
            Manage your database connection profiles
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>Create Profile</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Edit Connection Profile' : 'Create Connection Profile'}
              </DialogTitle>
              <DialogDescription>
                {editingProfile 
                  ? 'Update the connection profile details'
                  : 'Create a new database connection profile'
                }
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Connection Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="My Database Connection"
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={formData.environment}
                      onValueChange={(value) => handleInputChange('environment', value as Environment)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(Environment).map(env => (
                          <SelectItem key={env} value={env}>
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Optional description for this connection"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="host">Host *</Label>
                    <Input
                      id="host"
                      value={formData.host}
                      onChange={(e) => handleInputChange('host', e.target.value)}
                      placeholder="localhost"
                    />
                    {formErrors.host && (
                      <p className="text-sm text-red-600">{formErrors.host}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="port">Port *</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => handleInputChange('port', e.target.value)}
                      placeholder="5432"
                    />
                    {formErrors.port && (
                      <p className="text-sm text-red-600">{formErrors.port}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="database">Database *</Label>
                    <Input
                      id="database"
                      value={formData.database}
                      onChange={(e) => handleInputChange('database', e.target.value)}
                      placeholder="postgres"
                    />
                    {formErrors.database && (
                      <p className="text-sm text-red-600">{formErrors.database}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      placeholder="postgres"
                    />
                    {formErrors.username && (
                      <p className="text-sm text-red-600">{formErrors.username}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password {!editingProfile && '*'}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder={editingProfile ? "Leave empty to keep current password" : "Enter password"}
                  />
                  {formErrors.password && (
                    <p className="text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => handleInputChange('tags', e.target.value)}
                      placeholder="development, testing"
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated tags for organization
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="folder">Folder</Label>
                    <Input
                      id="folder"
                      value={formData.folder}
                      onChange={(e) => handleInputChange('folder', e.target.value)}
                      placeholder="project-name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sslMode">SSL Mode</Label>
                  <Select
                    value={formData.sslMode}
                    onValueChange={(value) => handleInputChange('sslMode', value as SslMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(SslMode).map(mode => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isFavorite"
                      checked={formData.isFavorite}
                      onCheckedChange={(checked) => handleInputChange('isFavorite', checked)}
                    />
                    <Label htmlFor="isFavorite">Mark as favorite</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoConnect"
                      checked={formData.autoConnect}
                      onCheckedChange={(checked) => handleInputChange('autoConnect', checked)}
                    />
                    <Label htmlFor="autoConnect">Auto-connect on startup</Label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingProfile ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="folder-filter">Folder</Label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Folders</SelectItem>
                  {folders.map(folder => (
                    <SelectItem key={folder} value={folder}>
                      {folder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment-filter">Environment</Label>
              <Select value={selectedEnvironment} onValueChange={(value) => setSelectedEnvironment(value as Environment | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  {Object.values(Environment).map(env => (
                    <SelectItem key={env} value={env}>
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProfiles.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {profiles.length === 0 
                    ? "No connection profiles yet. Create your first profile to get started."
                    : "No profiles match your current filters."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredProfiles.map(profile => (
            <Card key={profile.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {profile.name}
                      {profile.metadata.isFavorite && (
                        <span className="text-yellow-500">★</span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {profile.config.host}:{profile.config.port}/{profile.config.database}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        ⋮
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleConnect(profile)}>
                        Connect
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(profile)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(profile)}
                        className="text-red-600"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.description && (
                  <p className="text-sm text-muted-foreground">
                    {profile.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">
                    {profile.metadata.environment}
                  </Badge>
                  {profile.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {profile.folder && (
                    <Badge variant="outline">
                      📁 {profile.folder}
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  {profile.lastUsed ? (
                    <p>Last used: {profile.lastUsed.toLocaleDateString()}</p>
                  ) : (
                    <p>Never used</p>
                  )}
                  <p>Used {profile.useCount} times</p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleConnect(profile)}
                    className="flex-1"
                  >
                    Connect
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEdit(profile)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}