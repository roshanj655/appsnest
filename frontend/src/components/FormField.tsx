import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FormFieldProps = {
  id: string
  label: string
  error?: string
  required?: boolean
  className?: string
  hint?: string
  children: ReactNode
}

export const FieldError = ({ id, error }: { id?: string; error?: string }) => {
  if (!error) return null
  return (
    <p id={id ? `${id}-error` : undefined} className="text-sm text-red-600" role="alert">
      {error}
    </p>
  )
}

export const FormField = ({ id, label, error, required, className, hint, children }: FormFieldProps) => {
  return (
    <div className={cn('space-y-2', className)} data-field={id}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {children}
      <FieldError id={id} error={error} />
      {!error && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default FormField
