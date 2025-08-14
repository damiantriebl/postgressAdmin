import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionProfileManager } from '../ConnectionProfileManager';
import { Environment, SslMode } from '@/types/database';

// Mock the service
vi.mock('@/services/connection-profile-service', () => ({
  ConnectionProfileService: {
    getAllProfiles: vi.fn().mockResolvedValue([]),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    markProfileUsed: vi.fn(),
  },
}));

const mockProfiles = [
  {
    id: '1',
    name: 'Test Connection',
    description: 'A test connection',
    tags: ['test', 'development'],
    folder: 'test-folder',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      connectionTimeout: 30,
      queryTimeout: 300,
      maxConnections: 10,
      idleTimeout: 300,
      retryAttempts: 3,
      retryDelay: 1,
      sslConfig: {
        mode: SslMode.Prefer,
      },
      customParameters: {},
    },
    metadata: {
      isFavorite: true,
      autoConnect: false,
      environment: Environment.Development,
      monitoringEnabled: false,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastUsed: new Date('2024-01-01'),
    useCount: 5,
  },
];

const mockProps = {
  profiles: mockProfiles,
  onCreateProfile: vi.fn(),
  onUpdateProfile: vi.fn(),
  onDeleteProfile: vi.fn(),
  onConnectToProfile: vi.fn(),
  onRefresh: vi.fn(),
};

describe('ConnectionProfileManager', () => {
  it('renders the component with profiles', () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    expect(screen.getByText('Connection Profiles')).toBeInTheDocument();
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.getByText('localhost:5432/testdb')).toBeInTheDocument();
  });

  it('opens create dialog when Create Profile button is clicked', async () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    const createButton = screen.getByText('Create Profile');
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create Connection Profile')).toBeInTheDocument();
    });
  });

  it('filters profiles by search query', async () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search profiles...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('shows empty state when no profiles match filters', () => {
    const emptyProps = { ...mockProps, profiles: [] };
    render(<ConnectionProfileManager {...emptyProps} />);
    
    expect(screen.getByText('No connection profiles yet. Create your first profile to get started.')).toBeInTheDocument();
  });

  it('displays profile badges correctly', () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('📁 test-folder')).toBeInTheDocument();
  });

  it('shows favorite star for favorite profiles', () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('calls onConnectToProfile when Connect button is clicked', async () => {
    render(<ConnectionProfileManager {...mockProps} />);
    
    const connectButtons = screen.getAllByText('Connect');
    fireEvent.click(connectButtons[0]);
    
    expect(mockProps.onConnectToProfile).toHaveBeenCalledWith('1');
  });
});