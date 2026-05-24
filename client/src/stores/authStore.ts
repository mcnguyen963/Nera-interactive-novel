import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../types/firebase'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  initialized: boolean

  initialize: () => () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  refreshProfile: () => Promise<void>
  changeEmail: (newEmail: string, currentPassword: string) => Promise<void>
  changePassword: (newPassword: string, currentPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      set({ user, loading: false, initialized: true })
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid)
          const docSnap = await getDoc(docRef)
          if (docSnap.exists()) {
            set({ profile: docSnap.data() as UserProfile })
          }
        } catch {
          // Firestore read may fail if user not yet verified
        }
      }
    })
    return unsubscribe
  },

  login: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
  },

  register: async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await sendEmailVerification(cred.user)
    const now = Date.now()
    const profile: UserProfile = {
      email: cred.user.email || email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(db, 'users', cred.user.uid), profile)
    set({ profile })
  },

  logout: async () => {
    set({ profile: null })
    await signOut(auth)
  },

  resetPassword: async (email) => {
    await sendPasswordResetEmail(auth, email)
  },

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider()
    const cred = await signInWithPopup(auth, provider)
    const docRef = doc(db, 'users', cred.user.uid)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) {
      const now = Date.now()
      const profile: UserProfile = {
        email: cred.user.email || '',
        displayName: cred.user.displayName || undefined,
        photoURL: cred.user.photoURL || undefined,
        emailVerified: cred.user.emailVerified,
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(docRef, profile)
      set({ profile })
    } else {
      set({ profile: docSnap.data() as UserProfile })
    }
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const docRef = doc(db, 'users', user.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      set({ profile: docSnap.data() as UserProfile })
    }
  },

  changeEmail: async (newEmail, currentPassword) => {
    const { user, profile } = get()
    if (!user) return
    const cred = EmailAuthProvider.credential(user.email || '', currentPassword)
    await reauthenticateWithCredential(user, cred)
    await updateEmail(user, newEmail)
    if (profile) {
      set({ profile: { ...profile, email: newEmail } })
    }
  },

  changePassword: async (newPassword, currentPassword) => {
    const { user } = get()
    if (!user) return
    const cred = EmailAuthProvider.credential(user.email || '', currentPassword)
    await reauthenticateWithCredential(user, cred)
    await updatePassword(user, newPassword)
  },
}))
