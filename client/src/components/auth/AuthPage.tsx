import { useState } from 'react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

type AuthView = 'login' | 'register' | 'forgot'

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login')

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="bg-[var(--page)] border border-[var(--rule)] rounded-lg p-8 w-full max-w-[420px]">
        <div className="text-center mb-6">
          <h1 className="font-[var(--font-head)] text-[1.6rem] tracking-[0.15em] text-[var(--accent)] mb-1">
            NERA
          </h1>
          <p className="text-[0.88rem] text-[var(--ink3)] italic">
            Interactive Novel
          </p>
        </div>

        {view === 'login' && (
          <LoginForm
            onSwitchToRegister={() => setView('register')}
            onSwitchToForgot={() => setView('forgot')}
          />
        )}
        {view === 'register' && (
          <RegisterForm onSwitchToLogin={() => setView('login')} />
        )}
        {view === 'forgot' && (
          <ForgotPasswordForm onSwitchToLogin={() => setView('login')} />
        )}
      </div>
    </div>
  )
}
