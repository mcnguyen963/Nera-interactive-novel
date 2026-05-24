import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockAuth = vi.hoisted(() => ({
  register: vi.fn(),
}))

vi.mock('../../stores', () => ({
  useAuthStore: vi.fn(() => ({
    register: mockAuth.register,
  })),
}))

import { RegisterForm } from './RegisterForm'

describe('RegisterForm', () => {
  const onSwitchToLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderForm() {
    const utils = render(<RegisterForm onSwitchToLogin={onSwitchToLogin} />)
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

  it('calls register with email and password on submit', async () => {
    mockAuth.register.mockResolvedValue(undefined)
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'new@example.com')
    await userEvent.type(passwordInput, 'password123')

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(mockAuth.register).toHaveBeenCalledWith('new@example.com', 'password123')
  })

  it('shows success message on successful registration', async () => {
    mockAuth.register.mockResolvedValue(undefined)
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'new@example.com')
    await userEvent.type(passwordInput, 'password123')

    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(
      screen.getByText('Account created! Check your email for a verification link.'),
    ).toBeDefined()
  })

  it('shows error message on failed registration', async () => {
    mockAuth.register.mockRejectedValue(
      new Error('Firebase: Email already in use (auth/email-already-in-use).'),
    )
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'existing@example.com')
    await userEvent.type(passwordInput, 'password123')

    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText(/Email already in use/)).toBeDefined()
  })

  it('shows generic error when register rejects with non-Error', async () => {
    mockAuth.register.mockRejectedValue('network error')
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'new@example.com')
    await userEvent.type(passwordInput, 'password123')

    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText('Registration failed')).toBeDefined()
  })

  it('navigates to login form on "Already have an account?" click', () => {
    renderForm()
    fireEvent.click(screen.getByText('Already have an account? Sign in'))
    expect(onSwitchToLogin).toHaveBeenCalledOnce()
  })

  it('disables button while loading', async () => {
    mockAuth.register.mockReturnValue(new Promise(() => {}))
    const { emailInput, passwordInput } = renderForm()

    await userEvent.type(emailInput, 'new@example.com')
    await userEvent.type(passwordInput, 'password123')

    const btn = screen.getByRole('button', { name: 'Create Account' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)

    fireEvent.click(btn)

    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Creating account\u2026')
  })
})
