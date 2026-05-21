import { describe, it, expect, beforeEach, vi } from 'vitest'

let mockCurrentUser: any = null
let mockDocSnap: any = { exists: () => false }

const firebaseMock = vi.hoisted(() => ({ auth: {}, db: {} }))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: any, cb: (u: any) => void) => {
    setTimeout(() => cb(mockCurrentUser), 0)
    return () => {}
  }),
  signInWithEmailAndPassword: vi.fn(async (_auth: any, _email: string, _pass: string) => ({ user: { uid: 'u1', email: _email } })),
  createUserWithEmailAndPassword: vi.fn(async (_auth: any, email: string, _pass: string) => ({
    user: { uid: 'u1', email },
  })),
  signOut: vi.fn(async () => {}),
  sendPasswordResetEmail: vi.fn(async () => {}),
  sendEmailVerification: vi.fn(async () => {}),
  GoogleAuthProvider: vi.fn(function fn() { return {} } as any),
  signInWithPopup: vi.fn(async () => ({
    user: { uid: 'u1', email: 'test@test.com', emailVerified: false, displayName: null, photoURL: null },
  })),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'u1' })),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(async () => mockDocSnap),
}))

vi.mock('../lib/firebase', () => firebaseMock)

import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    mockCurrentUser = null
    mockDocSnap = { exists: () => false }
    useAuthStore.setState(useAuthStore.getInitialState())
  })

  describe('initial state', () => {
    it('starts with no user and loading true', () => {
      const s = useAuthStore.getState()
      expect(s.user).toBeNull()
      expect(s.profile).toBeNull()
      expect(s.loading).toBe(true)
      expect(s.initialized).toBe(false)
    })
  })

  describe('initialize', () => {
    it('sets user when authenticated', async () => {
      mockCurrentUser = { uid: 'u1', email: 't@t.com' }
      useAuthStore.getState().initialize()
      await vi.waitFor(() => {
        const s = useAuthStore.getState()
        expect(s.user).toEqual(mockCurrentUser)
        expect(s.loading).toBe(false)
        expect(s.initialized).toBe(true)
      })
    })

    it('sets user to null when not authenticated', async () => {
      mockCurrentUser = null
      useAuthStore.getState().initialize()
      await vi.waitFor(() => {
        const s = useAuthStore.getState()
        expect(s.user).toBeNull()
        expect(s.loading).toBe(false)
        expect(s.initialized).toBe(true)
      })
    })

    it('loads profile when user exists and doc exists', async () => {
      mockCurrentUser = { uid: 'u1', email: 't@t.com' }
      mockDocSnap = {
        exists: () => true,
        data: () => ({ email: 't@t.com', emailVerified: true, createdAt: 100, updatedAt: 100 }),
      }
      useAuthStore.getState().initialize()
      await vi.waitFor(() => {
        expect(useAuthStore.getState().profile).toBeTruthy()
      })
      expect(useAuthStore.getState().profile!.email).toBe('t@t.com')
    })
  })

  describe('login', () => {
    it('calls signInWithEmailAndPassword', async () => {
      await expect(useAuthStore.getState().login('a@a.com', 'pass')).resolves.toBeUndefined()
    })
  })

  describe('register', () => {
    it('creates user and sets profile', async () => {
      await useAuthStore.getState().register('new@user.com', 'pass123')
      const s = useAuthStore.getState()
      expect(s.profile).toBeTruthy()
      expect(s.profile!.email).toBe('new@user.com')
    })
  })

  describe('logout', () => {
    it('clears profile and calls signOut', async () => {
      useAuthStore.setState({ profile: { email: 't@t.com', emailVerified: false, createdAt: 0, updatedAt: 0 } })
      await useAuthStore.getState().logout()
      expect(useAuthStore.getState().profile).toBeNull()
    })
  })

  describe('resetPassword', () => {
    it('calls sendPasswordResetEmail', async () => {
      await expect(useAuthStore.getState().resetPassword('a@a.com')).resolves.toBeUndefined()
    })
  })

  describe('signInWithGoogle', () => {
    it('signs in and creates profile for new user', async () => {
      await useAuthStore.getState().signInWithGoogle()
      const s = useAuthStore.getState()
      expect(s.profile).toBeTruthy()
      expect(s.profile!.email).toBeTruthy()
    })

    it('loads profile for existing user', async () => {
      mockDocSnap = {
        exists: () => true,
        data: () => ({ email: 'exist@t.com', emailVerified: true, createdAt: 50, updatedAt: 50 }),
      }
      await useAuthStore.getState().signInWithGoogle()
      expect(useAuthStore.getState().profile!.email).toBe('exist@t.com')
    })
  })

  describe('refreshProfile', () => {
    it('does nothing without user', async () => {
      await expect(useAuthStore.getState().refreshProfile()).resolves.toBeUndefined()
    })

    it('loads profile when user exists', async () => {
      useAuthStore.setState({ user: { uid: 'u1' } as any })
      mockDocSnap = {
        exists: () => true,
        data: () => ({ email: 'refreshed@t.com', emailVerified: true, createdAt: 50, updatedAt: 60 }),
      }
      await useAuthStore.getState().refreshProfile()
      expect(useAuthStore.getState().profile!.email).toBe('refreshed@t.com')
    })
  })
})
