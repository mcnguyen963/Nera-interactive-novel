import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useStoryStore } from './stores'
import { AuthPage } from './components/auth'
import { Header, Sidebar } from './components/layout'
import { SettingsModal, ImageModal } from './components/novel'
import { Toast } from './components/shared'
import { HomePage, NovelPage } from './pages'

function NovelLayout() {
  return (
    <>
      <Header />
      <SettingsModal />
      <ImageModal />
      <Toast />
      <div className="flex flex-1 max-w-[1100px] mx-auto w-full">
        <Sidebar />
        <NovelPage />
      </div>
    </>
  )
}

function Dashboard() {
  return (
    <>
      <Header />
      <SettingsModal />
      <ImageModal />
      <Toast />
      <HomePage />
    </>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-3 h-3 border-2 border-[var(--rule)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <AuthPage />

  return <>{children}</>
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const story = useStoryStore((s) => s.story)

  useEffect(() => {
    const unsub = initialize()
    return () => unsub()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthGuard>
              {story ? <Navigate to="/novel" replace /> : <Dashboard />}
            </AuthGuard>
          }
        />
        <Route
          path="/novel"
          element={
            <AuthGuard>
              {!story ? <Navigate to="/" replace /> : <NovelLayout />}
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
