import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  user: null as any,
  profile: null as any,
  logout: vi.fn(),
}))

const storyState = vi.hoisted(() => ({
  story: null as any,
  saveToCloud: vi.fn(),
  loadFromCloud: vi.fn(),
  deleteFromCloud: vi.fn(),
  listCloudStories: vi.fn(),
  isSyncing: false,
}))

const uiState = vi.hoisted(() => ({
  addToast: vi.fn(),
  openSettings: vi.fn(),
}))

vi.mock('../../stores', () => ({
  useAuthStore: vi.fn(() => ({
    user: authState.user,
    profile: authState.profile,
    logout: authState.logout,
  })),
  useStoryStore: vi.fn(() => ({
    story: storyState.story,
    saveToCloud: storyState.saveToCloud,
    loadFromCloud: storyState.loadFromCloud,
    deleteFromCloud: storyState.deleteFromCloud,
    listCloudStories: storyState.listCloudStories,
    isSyncing: storyState.isSyncing,
  })),
  useUiStore: vi.fn(() => ({
    addToast: uiState.addToast,
    openSettings: uiState.openSettings,
  })),
}))

import { Header } from './Header'

const mockUser = {
  uid: 'user-123',
  emailVerified: true,
  email: 'test@example.com',
}

const mockUserUnverified = {
  uid: 'user-456',
  emailVerified: false,
  email: 'unverified@example.com',
}

const mockProfile = {
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockProfileNoDisplayName = {
  email: 'only-email@example.com',
  emailVerified: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockStory = {
  id: 'story-1',
  userId: 'user-123',
  title: 'Test Story',
  subtitle: 'A test',
  scenarioId: 'scenario-1',
  scenario: {
    setting: 'A fantasy world',
    companion: 'A guide',
    player: 'A hero',
    hook: 'Start',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockCloudStory = (id: string, updatedAt: number) => ({
  id,
  userId: 'user-123',
  title: `Story ${id}`,
  subtitle: '',
  scenarioId: 'scenario-1',
  scenario: {
    setting: '',
    companion: '',
    player: '',
    hook: '',
  },
  createdAt: Date.now(),
  updatedAt,
})

function resetStores() {
  authState.user = null
  authState.profile = null
  storyState.story = null
  storyState.isSyncing = false
  vi.clearAllMocks()
}

// =========================================================================
// UNIT TESTS
// =========================================================================

describe('Header', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('unit - app name', () => {
    it('renders the NERA app name', () => {
      render(<Header />)
      expect(screen.getByText('NERA')).toBeDefined()
    })
  })

  describe('unit - user info display', () => {
    it('shows profile displayName when profile exists', () => {
      authState.user = mockUser
      authState.profile = mockProfile
      render(<Header />)
      expect(screen.getByText('Test User')).toBeDefined()
    })

    it('shows profile email when displayName is not set', () => {
      authState.user = mockUser
      authState.profile = mockProfileNoDisplayName
      render(<Header />)
      expect(screen.getByText('only-email@example.com')).toBeDefined()
    })

    it('does not show profile info when profile is null', () => {
      authState.user = mockUser
      render(<Header />)
      expect(screen.queryByText('test@example.com')).toBeNull()
    })
  })

  describe('unit - sign out', () => {
    it('shows Sign Out button when user is logged in', () => {
      authState.user = mockUser
      render(<Header />)
      const btn = screen.getByText('Sign out')
      expect(btn).toBeDefined()
      expect(btn.tagName).toBe('BUTTON')
    })

    it('calls logout when Sign Out is clicked', () => {
      authState.user = mockUser
      render(<Header />)
      fireEvent.click(screen.getByText('Sign out'))
      expect(authState.logout).toHaveBeenCalledTimes(1)
    })

    it('does not show Sign Out button when user is null', () => {
      render(<Header />)
      expect(screen.queryByText('Sign out')).toBeNull()
    })
  })

  describe('unit - settings button', () => {
    it('renders settings gear button with Settings title', () => {
      render(<Header />)
      const btn = screen.getByTitle('Settings')
      expect(btn).toBeDefined()
    })

    it('calls openSettings when settings gear is clicked', () => {
      render(<Header />)
      fireEvent.click(screen.getByTitle('Settings'))
      expect(uiState.openSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('unit - email verification warning', () => {
    it('shows verify email warning when user exists but email is not verified', () => {
      authState.user = mockUserUnverified
      render(<Header />)
      expect(screen.getByText('Verify email to use API')).toBeDefined()
    })

    it('does not show verify email warning when user is verified', () => {
      authState.user = mockUser
      render(<Header />)
      expect(screen.queryByText('Verify email to use API')).toBeNull()
    })

    it('does not show verify email warning when user is null', () => {
      render(<Header />)
      expect(screen.queryByText('Verify email to use API')).toBeNull()
    })
  })

  describe('unit - cloud story buttons', () => {
    it('shows Save to Cloud, Load from Cloud, and Delete buttons when story exists', () => {
      storyState.story = mockStory
      authState.user = mockUser
      render(<Header />)
      expect(screen.getByText('Save to Cloud')).toBeDefined()
      expect(screen.getByText('Load from Cloud')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })

    it('hides cloud buttons when story is null', () => {
      render(<Header />)
      expect(screen.queryByText('Save to Cloud')).toBeNull()
      expect(screen.queryByText('Load from Cloud')).toBeNull()
      expect(screen.queryByText('Delete')).toBeNull()
    })

    it('shows "Saving…" text on save button when isSyncing is true', () => {
      storyState.story = mockStory
      storyState.isSyncing = true
      authState.user = mockUser
      render(<Header />)
      expect(screen.getByText('Saving…')).toBeDefined()
      expect(screen.queryByText('Save to Cloud')).toBeNull()
    })

    it('disables save button when isSyncing is true', () => {
      storyState.story = mockStory
      storyState.isSyncing = true
      authState.user = mockUser
      render(<Header />)
      const btn = screen.getByText('Saving…') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('enables save button when isSyncing is false', () => {
      storyState.story = mockStory
      authState.user = mockUser
      render(<Header />)
      const btn = screen.getByText('Save to Cloud') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  describe('unit - handleSave', () => {
    it('shows success toast when saveToCloud succeeds', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      storyState.saveToCloud.mockResolvedValue(undefined)
      render(<Header />)
      fireEvent.click(screen.getByText('Save to Cloud'))
      await waitFor(() => {
        expect(storyState.saveToCloud).toHaveBeenCalledWith('user-123')
      })
      expect(uiState.addToast).toHaveBeenCalledWith('Saved to cloud ✓', 'success')
    })

    it('shows error toast when saveToCloud throws', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      storyState.saveToCloud.mockRejectedValue(new Error('network error'))
      render(<Header />)
      fireEvent.click(screen.getByText('Save to Cloud'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('Save failed', 'error')
      })
    })

    it('does nothing when save is clicked with no user', () => {
      storyState.story = mockStory
      render(<Header />)
      fireEvent.click(screen.getByText('Save to Cloud'))
      expect(storyState.saveToCloud).not.toHaveBeenCalled()
    })

    it('does nothing when save is clicked with no story', () => {
      authState.user = mockUser
      render(<Header />)
      expect(screen.queryByText('Save to Cloud')).toBeNull()
    })
  })

  describe('unit - handleLoad', () => {
    it('loads the latest story when cloud stories exist', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      const stories = [
        mockCloudStory('story-old', 1000),
        mockCloudStory('story-new', 3000),
        mockCloudStory('story-mid', 2000),
      ]
      storyState.listCloudStories.mockResolvedValue(stories)
      render(<Header />)
      fireEvent.click(screen.getByText('Load from Cloud'))
      await waitFor(() => {
        expect(storyState.listCloudStories).toHaveBeenCalledWith('user-123')
      })
      expect(storyState.loadFromCloud).toHaveBeenCalledWith('story-new', 'user-123')
      expect(uiState.addToast).toHaveBeenCalledWith('Loaded from cloud ✓', 'success')
    })

    it('shows info toast when no cloud stories exist', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      storyState.listCloudStories.mockResolvedValue([])
      render(<Header />)
      fireEvent.click(screen.getByText('Load from Cloud'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('No cloud stories found', 'info')
      })
      expect(storyState.loadFromCloud).not.toHaveBeenCalled()
    })

    it('shows error toast when listCloudStories throws', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      storyState.listCloudStories.mockRejectedValue(new Error('server error'))
      render(<Header />)
      fireEvent.click(screen.getByText('Load from Cloud'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('Load failed', 'error')
      })
      expect(storyState.loadFromCloud).not.toHaveBeenCalled()
    })

    it('does nothing when load is clicked with no user', () => {
      storyState.story = mockStory
      render(<Header />)
      fireEvent.click(screen.getByText('Load from Cloud'))
      expect(storyState.listCloudStories).not.toHaveBeenCalled()
    })
  })

  describe('unit - handleDelete', () => {
    it('shows info toast when deleteFromCloud succeeds', async () => {
      storyState.story = mockStory
      storyState.deleteFromCloud.mockResolvedValue(undefined)
      render(<Header />)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => {
        expect(storyState.deleteFromCloud).toHaveBeenCalledWith('story-1')
      })
      expect(uiState.addToast).toHaveBeenCalledWith('Deleted from cloud', 'info')
    })

    it('shows error toast when deleteFromCloud throws', async () => {
      storyState.story = mockStory
      storyState.deleteFromCloud.mockRejectedValue(new Error('permission denied'))
      render(<Header />)
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('Delete failed', 'error')
      })
    })

    it('does nothing when delete is clicked with no story', () => {
      authState.user = mockUser
      render(<Header />)
      expect(screen.queryByText('Delete')).toBeNull()
    })
  })
})

// =========================================================================
// INTEGRATION TESTS
// =========================================================================

describe('Header - integration', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('integration - sign out flow', () => {
    it('sign out button disappears after logout is called', () => {
      authState.user = mockUser
      const { rerender } = render(<Header />)
      expect(screen.getByText('Sign out')).toBeDefined()
      authState.user = null
      rerender(<Header />)
      expect(screen.queryByText('Sign out')).toBeNull()
    })
  })

  describe('integration - save then load flow', () => {
    it('full save and load cycle with toast confirmations', async () => {
      storyState.story = mockStory
      authState.user = mockUser
      storyState.saveToCloud.mockResolvedValue(undefined)
      storyState.listCloudStories.mockResolvedValue([mockCloudStory('story-1', 5000)])
      storyState.loadFromCloud.mockResolvedValue(undefined)

      render(<Header />)
      fireEvent.click(screen.getByText('Save to Cloud'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('Saved to cloud ✓', 'success')
      })
      fireEvent.click(screen.getByText('Load from Cloud'))
      await waitFor(() => {
        expect(storyState.loadFromCloud).toHaveBeenCalledWith('story-1', 'user-123')
      })
    })
  })

  describe('integration - story deletion resets UI', () => {
    it('deleting story removes cloud buttons after rerender', async () => {
      storyState.story = mockStory
      storyState.deleteFromCloud.mockResolvedValue(undefined)
      const { rerender } = render(<Header />)
      expect(screen.getByText('Delete')).toBeDefined()
      fireEvent.click(screen.getByText('Delete'))
      await waitFor(() => {
        expect(uiState.addToast).toHaveBeenCalledWith('Deleted from cloud', 'info')
      })
      storyState.story = null
      rerender(<Header />)
      expect(screen.queryByText('Delete')).toBeNull()
    })
  })

  describe('integration - settings and user info', () => {
    it('settings gear click opens settings then profile shows', () => {
      authState.user = mockUser
      authState.profile = mockProfile
      render(<Header />)
      fireEvent.click(screen.getByTitle('Settings'))
      expect(uiState.openSettings).toHaveBeenCalled()
      expect(screen.getByText('Test User')).toBeDefined()
    })
  })
})

// =========================================================================
// SYSTEM / COMPONENT TESTS
// =========================================================================

describe('Header - system', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('system - logged in state', () => {
    it('renders full header with user info, settings, and sign out', () => {
      authState.user = mockUser
      authState.profile = mockProfile
      storyState.story = mockStory
      render(<Header />)
      expect(screen.getByText('NERA')).toBeDefined()
      expect(screen.getByText('Test User')).toBeDefined()
      expect(screen.getByText('Sign out')).toBeDefined()
      expect(screen.getByTitle('Settings')).toBeDefined()
      expect(screen.getByText('Save to Cloud')).toBeDefined()
      expect(screen.getByText('Load from Cloud')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })

    it('renders header element with correct tag', () => {
      const { container } = render(<Header />)
      const header = container.querySelector('header')
      expect(header).not.toBeNull()
    })
  })

  describe('system - logged out state', () => {
    it('renders minimal header with only NERA and settings', () => {
      render(<Header />)
      expect(screen.getByText('NERA')).toBeDefined()
      expect(screen.getByTitle('Settings')).toBeDefined()
      expect(screen.queryByText('Sign out')).toBeNull()
      expect(screen.queryByText('Save to Cloud')).toBeNull()
      expect(screen.queryByText('Load from Cloud')).toBeNull()
      expect(screen.queryByText('Delete')).toBeNull()
    })

    it('does not show any user-related info', () => {
      render(<Header />)
      expect(screen.queryByText(/Verify email/)).toBeNull()
      expect(screen.queryByText(/@/)).toBeNull()
    })
  })

  describe('system - story exists but no user', () => {
    it('renders cloud buttons when story exists even without user', () => {
      storyState.story = mockStory
      render(<Header />)
      expect(screen.getByText('Save to Cloud')).toBeDefined()
      expect(screen.getByText('Load from Cloud')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })
  })

  describe('system - story exists with unverified user', () => {
    it('renders cloud buttons and verify warning simultaneously', () => {
      authState.user = mockUserUnverified
      storyState.story = mockStory
      render(<Header />)
      expect(screen.getByText('Verify email to use API')).toBeDefined()
      expect(screen.getByText('Save to Cloud')).toBeDefined()
      expect(screen.getByText('Load from Cloud')).toBeDefined()
      expect(screen.getByText('Delete')).toBeDefined()
    })
  })

  describe('system - edge cases', () => {
    it('handles user with profile but no story gracefully', () => {
      authState.user = mockUser
      authState.profile = mockProfile
      render(<Header />)
      expect(screen.getByText('Test User')).toBeDefined()
      expect(screen.getByText('Sign out')).toBeDefined()
      expect(screen.queryByText('Save to Cloud')).toBeNull()
    })

    it('handles story with no user gracefully', () => {
      storyState.story = mockStory
      render(<Header />)
      expect(screen.getByText('NERA')).toBeDefined()
      expect(screen.getByTitle('Settings')).toBeDefined()
    })
  })
})
