import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores'
import { Button } from '../shared'

interface LoginFormProps {
  onSwitchToRegister: () => void
  onSwitchToForgot: () => void
}

export function LoginForm({ onSwitchToRegister, onSwitchToForgot }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, signInWithGoogle } = useAuthStore()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="font-[var(--font-head)] text-[var(--accent)] text-[0.9rem] tracking-[0.15em] border-b border-[var(--rule)] pb-3 mb-1">
        Sign In
      </h2>

      {error && (
        <div className="text-red-600 text-[0.82rem] bg-red-50 p-2 rounded">{error}</div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </Button>

      <div className="flex justify-between text-[0.78rem]">
        <button type="button" onClick={onSwitchToRegister} className="text-[var(--accent)] underline bg-none border-none cursor-pointer">
          Create account
        </button>
        <button type="button" onClick={onSwitchToForgot} className="text-[var(--ink3)] underline bg-none border-none cursor-pointer">
          Forgot password?
        </button>
      </div>

      <div className="flex items-center gap-3 my-1">
        <hr className="flex-1 border-[var(--rule)]" />
        <span className="text-[var(--ink3)] text-[0.75rem]">or</span>
        <hr className="flex-1 border-[var(--rule)]" />
      </div>

      <Button type="button" onClick={handleGoogle} className="justify-center">
        Sign in with Google
      </Button>
    </form>
  )
}
