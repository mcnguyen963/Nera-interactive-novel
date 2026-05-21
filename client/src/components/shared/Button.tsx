import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary'
  children: ReactNode
}

export function Button({ variant = 'default', children, className = '', ...props }: ButtonProps) {
  const base = 'bg-none border border-[var(--rule)] text-[var(--ink2)] px-3 py-[5px] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] text-[0.82rem] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed'
  const primary = 'bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[#8a4c28] hover:text-white'
  const cls = `${base} ${variant === 'primary' ? primary : ''} ${className}`

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
