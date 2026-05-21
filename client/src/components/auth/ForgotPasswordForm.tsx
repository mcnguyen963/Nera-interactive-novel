import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../stores'
import { Button } from '../shared'

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuthStore()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSuccess('Password reset email sent!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="font-[var(--font-head)] text-[var(--accent)] text-[0.9rem] tracking-[0.15em] border-b border-[var(--rule)] pb-3 mb-1">
        Reset Password
      </h2>

      {error && (
        <div className="text-red-600 text-[0.82rem] bg-red-50 p-2 rounded">{error}</div>
      )}
      {success && (
        <div className="text-green-700 text-[0.82rem] bg-green-50 p-2 rounded">{success}</div>
      )}

      <p className="text-[var(--ink3)] text-[0.85rem] italic">
        Enter your email address and we'll send you a password reset link.
      </p>

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

      <Button type="submit" variant="primary" disabled={loading}>
        {loading ? 'Sending…' : 'Send Reset Email'}
      </Button>

      <div className="text-center text-[0.78rem]">
        <button type="button" onClick={onSwitchToLogin} className="text-[var(--accent)] underline bg-none border-none cursor-pointer">
          Back to sign in
        </button>
      </div>
    </form>
  )
}
