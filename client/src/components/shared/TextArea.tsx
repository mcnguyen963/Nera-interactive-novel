import { useRef, useEffect, type TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
}

export function TextArea({ autoResize = true, className = '', ...props }: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoResize && ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + 'px'
    }
  }, [props.value, autoResize])

  return (
    <textarea
      ref={ref}
      className={`border-none bg-transparent text-[var(--ink)] font-[var(--font-body)] text-[0.95rem] resize-none outline-none leading-[1.6] min-h-[36px] max-h-[120px] ${className}`}
      {...props}
    />
  )
}
