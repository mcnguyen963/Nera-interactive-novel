import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAuth = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}))

vi.mock('../../stores', () => ({
  useAuthStore: vi.fn(() => ({
    resetPassword: mockAuth.resetPassword,
  })),
}))

import { ForgotPasswordForm } from './ForgotPasswordForm'

describe('ForgotPasswordForm', () => {
  const onSwitchToLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderForm() {
    const utils = render(<ForgotPasswordForm onSwitchToLogin={onSwitchToLogin} />)
    return {
      emailInput: utils.container.querySelector('input[type="email"]')!,
      ...utils,
    }
  }

  it('renders email input', () => {
    const { emailInput } = renderForm()
    expect(screen.getByText('Email')).toBeDefined()
    expect(emailInput).not.toBeNull()
  })

  it('calls resetPassword with email on submit', async () => {
    mockAuth.resetPassword.mockResolvedValue(undefined)
    const { emailInput } = renderForm()

    await userEvent.type(emailInput, 'user@example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }))

    expect(mockAuth.resetPassword).toHaveBeenCalledWith('user@example.com')
  })

  it('shows success message on completion', async () => {
    mockAuth.resetPassword.mockResolvedValue(undefined)
    const { emailInput } = renderForm()

    await userEvent.type(emailInput, 'user@example.com')

    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }))

    expect(screen.getByText('Password reset email sent!')).toBeDefined()
  })

  it('shows error message on failure', async () => {
    mockAuth.resetPassword.mockRejectedValue(
      new Error('Firebase: No user found with this email (auth/user-not-found).'),
    )
    const { emailInput } = renderForm()

    await userEvent.type(emailInput, 'nonexistent@example.com')

    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }))

    expect(screen.getByText(/No user found with this email/)).toBeDefined()
  })

  it('shows generic error when resetPassword rejects with non-Error', async () => {
    mockAuth.resetPassword.mockRejectedValue('some error')
    const { emailInput } = renderForm()

    await userEvent.type(emailInput, 'user@example.com')

    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }))

    expect(screen.getByText('Failed')).toBeDefined()
  })

  it('navigates back to login on "Back to sign in" click', () => {
    renderForm()
    fireEvent.click(screen.getByText('Back to sign in'))
    expect(onSwitchToLogin).toHaveBeenCalledOnce()
  })

  it('disables button while loading', async () => {
    mockAuth.resetPassword.mockReturnValue(new Promise(() => {}))
    const { emailInput } = renderForm()

    await userEvent.type(emailInput, 'user@example.com')

    const btn = screen.getByRole('button', { name: 'Send Reset Email' })
    expect(btn.disabled).toBe(false)

    fireEvent.click(btn)

    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Sending\u2026')
  })
})
