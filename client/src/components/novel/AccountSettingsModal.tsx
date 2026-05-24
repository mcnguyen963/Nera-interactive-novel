import { useState } from 'react'
import { useAuthStore, useUiStore } from '../../stores'
import { Button, Modal } from '../shared'

export function AccountSettingsModal() {
  const { user, profile, changeEmail, changePassword } = useAuthStore()
  const { showAccountSettings, closeAccountSettings, addToast } = useUiStore()

  const [activeTab, setActiveTab] = useState<'email' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setEmail('')
    setNewPassword('')
    setCurrentPassword('')
    setError('')
    setSuccess('')
    setLoading(false)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await changeEmail(email, currentPassword)
      setSuccess('Email updated successfully')
      resetForm()
      addToast('Email updated ✓', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await changePassword(newPassword, currentPassword)
      setSuccess('Password updated successfully')
      resetForm()
      addToast('Password updated ✓', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={showAccountSettings} onClose={() => { closeAccountSettings(); resetForm() }} className="w-[520px]">
      <div className="flex gap-4 mb-5 border-b border-[var(--rule)]">
        <button
          type="button"
          onClick={() => { setActiveTab('email'); setError(''); setSuccess('') }}
          className={`pb-3 text-[0.85rem] font-[var(--font-head)] tracking-[0.1em] border-b-2 transition-colors ${
            activeTab === 'email'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--ink3)] hover:text-[var(--ink)]'
          }`}
        >
          Change Email
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('password'); setError(''); setSuccess('') }}
          className={`pb-3 text-[0.85rem] font-[var(--font-head)] tracking-[0.1em] border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--ink3)] hover:text-[var(--ink)]'
          }`}
        >
          Change Password
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-[0.82rem] bg-red-50 p-2 rounded mb-4">{error}</div>
      )}
      {success && (
        <div className="text-green-700 text-[0.82rem] bg-green-50 p-2 rounded mb-4">{success}</div>
      )}

      {activeTab === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3.5">
          <p className="text-[var(--ink3)] text-[0.82rem] italic">
            Current email: <span className="text-[var(--ink)] not-italic">{profile?.email || user?.email}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">New Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Updating…' : 'Update Email'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] px-3 py-[7px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      )}
    </Modal>
  )
}
