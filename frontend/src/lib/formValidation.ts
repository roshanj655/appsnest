import { useCallback, useState } from 'react'

export type FieldErrors = Record<string, string>

export const requiredMsg = (label: string) => `${label} is required.`

export const emailMsg = 'Enter a valid email address.'

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export const scrollToField = (fieldId: string) => {
  if (typeof document === 'undefined' || !fieldId) return
  const run = () => {
    const el = document.querySelector(`[data-field="${CSS.escape(fieldId)}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not(.sr-only), select, textarea, [role="combobox"], button:not([type="submit"]):not([type="button"])'
    )
    const input = el.querySelector<HTMLElement>('input:not([type="hidden"]):not(.sr-only), select, textarea')
    ;(input || focusable)?.focus({ preventScroll: true })
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
}

export const scrollToFirstError = (errors: FieldErrors) => {
  const first = Object.keys(errors)[0]
  if (first) scrollToField(first)
}

export function useFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const clearFieldErrors = useCallback(() => setFieldErrors({}), [])

  const clearFieldError = useCallback((fieldId: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }, [])

  const showFieldErrors = useCallback((errors: FieldErrors) => {
    setFieldErrors(errors)
    const keys = Object.keys(errors)
    if (keys.length) scrollToFirstError(errors)
    return keys.length > 0
  }, [])

  return {
    fieldErrors,
    setFieldErrors,
    clearFieldErrors,
    clearFieldError,
    showFieldErrors
  }
}
