import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  invalid?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, onChange, invalid, ...props }, ref) => {
    const [cleared, setCleared] = React.useState(false)

    React.useEffect(() => {
      if (type !== "number") return
      if (typeof value === "number" && Number.isNaN(value)) return
      if (value !== 0 && value !== "0" && value !== "" && value != null) {
        setCleared(false)
      }
    }, [type, value])

    const isInvalidNumber = typeof value === "number" && Number.isNaN(value)
    const displayValue =
      type === "number" && (cleared || isInvalidNumber) ? "" : value

    return (
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "app-input flex h-10 w-full rounded-xl border px-3 py-2 text-sm shadow-inner shadow-black/5 ring-offset-background transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-red-500 focus-visible:ring-red-400/30",
          className
        )}
        ref={ref}
        {...props}
        value={displayValue as React.ComponentProps<"input">["value"]}
        onChange={(event) => {
          if (type === "number") {
            setCleared(event.target.value === "")
          }
          onChange?.(event)
        }}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
