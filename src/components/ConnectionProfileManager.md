# Connection Profile Manager

A comprehensive React component for managing database connection profiles with a modern UI built using shadcn/ui components.

## Features

- ✅ **Profile Creation Form**: Create new connection profiles with validation
- ✅ **Profile List View**: Display profiles in a card-based layout
- ✅ **Edit and Delete Actions**: Modify or remove existing profiles
- ✅ **Search and Filtering**: Filter profiles by name, folder, environment
- ✅ **Tags and Folders**: Organize profiles with tags and folder structure
- ✅ **Environment Support**: Categorize profiles by environment (dev, staging, prod, etc.)
- ✅ **Favorite Profiles**: Mark profiles as favorites for quick access
- ✅ **SSL Configuration**: Configure SSL settings for secure connections
- ✅ **Form Validation**: Client-side validation with error messages
- ✅ **Responsive Design**: Works on desktop and mobile devices

## Usage

### Basic Usage

```tsx
import { ConnectionProfileManager } from '@/components/ConnectionProfileManager';
import { useConnectionProfiles } from '@/hooks/useConnectionProfiles';

function MyApp() {
  const {
    profiles,
    createProfile,
    updateProfile,
    deleteProfile,
    connectToProfile,
    refreshProfiles,
  } = useConnectionProfiles();

  return (
    <ConnectionProfileManager
      profiles={profiles}
      onCreateProfile={createProfile}
      onUpdateProfile={updateProfile}
      onDeleteProfile={deleteProfile}
      onConnectToProfile={connectToProfile}
      onRefresh={refreshProfiles}
    />
  );
}
```

### With Demo Component

```tsx
import { ConnectionProfileManagerDemo } from '@/components/ConnectionProfileManagerDemo';

function App() {
  return <ConnectionProfileManagerDemo />;
}
```

## Props

### ConnectionProfileManager Props

| Prop | Type | Description |
|------|------|-------------|
| `profiles` | `ConnectionProfile[]` | Array of connection profiles to display |
| `onCreateProfile` | `(profile: CreateConnectionProfileRequest) => Promise<void>` | Callback when creating a new profile |
| `onUpdateProfile` | `(id: string, updates: Partial<ConnectionProfile>) => Promise<void>` | Callback when updating a profile |
| `onDeleteProfile` | `(id: string) => Promise<void>` | Callback when deleting a profile |
| `onConnectToProfile` | `(id: string) => Promise<void>` | Callback when connecting to a profile |
| `onRefresh` | `() => Promise<void>` | Callback to refresh the profile list |

## Data Types

### ConnectionProfile

```typescript
interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  folder?: string;
  config: AdvancedConnectionConfig;
  metadata: ConnectionMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  useCount: number;
}
```

### AdvancedConnectionConfig

```typescript
interface AdvancedConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  connectionTimeout: number;
  queryTimeout: number;
  maxConnections: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  sslConfig: SSLConfig;
  customParameters: Record<string, string>;
  connectionStringTemplate?: string;
}
```

### ConnectionMetadata

```typescript
interface ConnectionMetadata {
  color?: string;
  icon?: string;
  isFavorite: boolean;
  autoConnect: boolean;
  environment: Environment;
  monitoringEnabled: boolean;
}
```

## Features in Detail

### Profile Creation Form

The profile creation form is organized into two tabs:

1. **Basic Settings**: Essential connection information
   - Connection name (required)
   - Host and port (required)
   - Database name (required)
   - Username and password (required)
   - Environment selection

2. **Advanced Settings**: Additional configuration options
   - Tags for organization
   - Folder assignment
   - SSL mode configuration
   - Favorite and auto-connect toggles

### Search and Filtering

- **Search**: Filter profiles by name, description, host, or database
- **Folder Filter**: Show profiles from specific folders
- **Environment Filter**: Filter by environment (development, staging, production, etc.)

### Profile Organization

- **Tags**: Add comma-separated tags to profiles for categorization
- **Folders**: Organize profiles into folders for better structure
- **Favorites**: Mark important profiles with a star for quick identification

### Validation

The component includes comprehensive form validation:

- Required field validation
- Port number validation (1-65535)
- Timeout value validation (positive numbers)
- JSON validation for custom parameters

### UI Components Used

The component uses the following shadcn/ui components:

- `Card` - Profile display cards
- `Button` - Action buttons
- `Input` - Form inputs
- `Label` - Form labels
- `Badge` - Tags and environment indicators
- `Dialog` - Create/edit modal
- `DropdownMenu` - Profile actions menu
- `Select` - Dropdown selections
- `Textarea` - Multi-line text input
- `Switch` - Boolean toggles
- `Tabs` - Form organization

## Integration with Backend

The component integrates with the backend through:

1. **ConnectionProfileService**: Handles CRUD operations
2. **useConnectionProfiles Hook**: Manages state and API calls
3. **Credential Vault**: Secure password storage (handled by backend)

## Styling

The component follows the application's dark theme with:

- Dark background gradients
- Gray color palette
- Blue accent colors
- Responsive grid layouts
- Hover effects and transitions

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Focus management in dialogs
- Semantic HTML structure

## Testing

The component includes comprehensive tests covering:

- Rendering with profiles
- Form interactions
- Search and filtering
- Profile actions (connect, edit, delete)
- Empty states

Run tests with:

```bash
npm run test
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 1.1**: Save multiple connection strings with descriptive names and tags
- **Requirement 1.3**: Display connections in organized list with names, hosts, and status
- **Requirement 1.4**: Organize connections by folders or tags with edit/delete actions

## Future Enhancements

Potential improvements for future iterations:

- Drag and drop reordering
- Bulk operations (select multiple profiles)
- Import/export functionality
- Connection health indicators
- Advanced search with multiple criteria
- Profile templates
- Connection history tracking