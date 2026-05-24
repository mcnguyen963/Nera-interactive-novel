import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAuth = vi.hoisted(() => ({
  login: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

vi.mock('../../stores', () => ({
  useAuthStore: vi.fn(() => ({
    login: mockAuth.login,
    signInWithGoogle: mockAuth.signInWithGoogle,
  })),
}))

import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  const onSwitchToRegister = vi.fn()
  const onSwitchToForgot = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderForm() {
    const utils = render(
      <LoginForm
        onSwitchToRegister={onSwitchToRegister}
        onSwitchToForgot={onSwitchToForgot}
      />,
    )
    return {
      emailInput: utils.container.querySelector('input[type="email"]')!,
      passwordInput: utils.container.querySelector('input[type="password"]')!,
      ...utils,
    }
  }

  it('renders email and password inputs', () => {
    const { emailInput, passwordInput } = renderForm()
    expect(screen.getByText('Email')).toBeDefined()
    expect(screen.getByText('Password')).toBeDefined()
    expect(emailInput).not.toBeNull()
    expect(passwordInput).not.toBeNull()
  })

  it('calls login with email and password on submit', async () => {
    mockAuth.login.mockResolvedValue(undefined)
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'secret123')

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(mockAuth.login).toHaveBeenCalledWith('test@example.com', 'secret123')
  })

  it('shows error message on failed login', async () => {
    mockAuth.login.mockRejectedValue(
      new Error('Firebase: The password is invalid (auth/wrong-password).'),
    )
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'wrong')

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText(/The password is invalid/)).toBeDefined()
  })

  it('shows generic error when login rejects with non-Error', async () => {
    mockAuth.login.mockRejectedValue('something went wrong')
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'pass')

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Login failed')).toBeDefined()
  })

  it('navigates to register form on "Create account" click', () => {
    renderForm()
    fireEvent.click(screen.getByText('Create account'))
    expect(onSwitchToRegister).toHaveBeenCalledOnce()
  })

  it('navigates to forgot password form on "Forgot password?" click', () => {
    renderForm()
    fireEvent.click(screen.getByText('Forgot password?'))
    expect(onSwitchToForgot).toHaveBeenCalledOnce()
  })

  it('disables button while loading', async () => {
    mockAuth.login.mockReturnValue(new Promise(() => {}))
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'a@a.com')
    await userEvent.type(passwordInput, 'pass')

    const btn = screen.getByRole('button', { name: 'Sign In' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)

    fireEvent.click(btn)

    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Signing in\u2026')
  })
})
