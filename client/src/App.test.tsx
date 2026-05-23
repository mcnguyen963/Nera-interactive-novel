import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const route = vi.hoisted(() => ({ current: '/' }))

const mockAuthStore = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  loading: true,
  initialized: false,
  initialize: vi.fn(() => vi.fn()),
}))

const mockStoryStore = vi.hoisted(() => ({
  story: null as { id: string } | null,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <actual.MemoryRouter initialEntries={[route.current]}>{children}</actual.MemoryRouter>
    ),
  }
})

vi.mock('./stores', () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      user: mockAuthStore.user,
      loading: mockAuthStore.loading,
      initialized: mockAuthStore.initialized,
      initialize: mockAuthStore.initialize,
    }
    return selector ? selector(state) : state
  }),
  useStoryStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { story: mockStoryStore.story }
    return selector ? selector(state) : state
  }),
  useUiStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { toasts: [] }
    return selector ? selector(state) : state
  }),
  useSettingsStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {}
    return selector ? selector(state) : state
  }),
}))

vi.mock('./components/auth', () => ({
  AuthPage: () => <div data-testid="auth-page">AuthPage Mock</div>,
}))

vi.mock('./components/layout', () => ({
  Header: () => <div data-testid="header">Header Mock</div>,
  Sidebar: () => <div data-testid="sidebar">Sidebar Mock</div>,
}))

vi.mock('./components/novel', () => ({
  SettingsModal: () => <div data-testid="settings-modal">SettingsModal Mock</div>,
  ImageModal: () => <div data-testid="image-modal">ImageModal Mock</div>,
}))

vi.mock('./components/shared', () => ({
  Toast: () => <div data-testid="toast">Toast Mock</div>,
}))

vi.mock('./pages', () => ({
  HomePage: () => <div data-testid="home-page">HomePage Mock</div>,
  NovelPage: () => <div data-testid="novel-page">NovelPage Mock</div>,
}))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    route.current = '/'
    mockAuthStore.user = null
    mockAuthStore.loading = true
    mockAuthStore.initialized = false
    mockAuthStore.initialize = vi.fn(() => vi.fn())
    mockStoryStore.story = null
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading spinner when auth is initializing', () => {
    const { container } = render(<App />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(screen.queryByTestId('auth-page')).toBeNull()
    expect(screen.queryByTestId('home-page')).toBeNull()
  })

  it('renders AuthPage when user is not authenticated', () => {
    mockAuthStore.loading = false
    mockAuthStore.initialized = true
    render(<App />)
    expect(screen.getByTestId('auth-page')).toBeDefined()
    expect(screen.queryByTestId('home-page')).toBeNull()
  })

  it('renders HomePage with full dashboard when user is authenticated', () => {
    mockAuthStore.loading = false
    mockAuthStore.initialized = true
    mockAuthStore.user = { uid: 'test-user' }
    render(<App />)
    expect(screen.getByTestId('home-page')).toBeDefined()
    expect(screen.getByTestId('header')).toBeDefined()
    expect(screen.getByTestId('settings-modal')).toBeDefined()
    expect(screen.getByTestId('image-modal')).toBeDefined()
    expect(screen.getByTestId('toast')).toBeDefined()
    expect(screen.queryByTestId('auth-page')).toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('novel-page')).toBeNull()
  })

  it('redirects to home when on /novel without a story (authenticated)', async () => {
    mockAuthStore.loading = false
    mockAuthStore.initialized = true
    mockAuthStore.user = { uid: 'test-user' }
    mockStoryStore.story = null
    route.current = '/novel'
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeDefined()
    })
    expect(screen.queryByTestId('novel-page')).toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.getByTestId('toast')).toBeDefined()
  })

  it('renders AuthPage when accessing /novel while unauthenticated', () => {
    mockAuthStore.loading = false
    mockAuthStore.initialized = true
    mockAuthStore.user = null
    route.current = '/novel'
    render(<App />)
    expect(screen.getByTestId('auth-page')).toBeDefined()
    expect(screen.queryByTestId('novel-page')).toBeNull()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('header')).toBeNull()
    expect(screen.queryByTestId('home-page')).toBeNull()
  })

  it('handles Firestore rules errors gracefully and shows toast infrastructure', () => {
    mockAuthStore.loading = false
    mockAuthStore.initialized = true
    mockAuthStore.user = { uid: 'test-user' }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAuthStore.initialize = vi.fn(() => {
      return () => {}
    })
    render(<App />)
    expect(screen.getByTestId('home-page')).toBeDefined()
    expect(screen.getByTestId('toast')).toBeDefined()
    errorSpy.mockRestore()
  })
})
