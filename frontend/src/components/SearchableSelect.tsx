import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SearchableOption = {
  value: string
  label: string
  description?: string
  searchText?: string
}

type Props = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

const matches = (option: SearchableOption, query: string) => {
  const haystack = `${option.label} ${option.description || ''} ${option.searchText || ''} ${option.value}`.toLowerCase()
  return query.split(/\s+/).filter(Boolean).every((part) => haystack.includes(part))
}

export default function SearchableSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyLabel,
  required,
  disabled,
  className
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const allOptions = useMemo(() => {
    const rows = [...options]
    if (emptyLabel != null) {
      rows.unshift({ value: '', label: emptyLabel })
    }
    return rows
  }, [options, emptyLabel])

  const selected = allOptions.find((option) => option.value === value)

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return allOptions
    return allOptions.filter((option) => matches(option, text))
  }, [allOptions, query])

  useEffect(() => {
    const onDocDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  const showList = open || query.trim().length > 0

  return (
    <div ref={rootRef} className={cn('w-full', className)}>
      {name && <input type="hidden" name={name} value={value} />}
      {required && <input type="text" className="sr-only" value={value} required readOnly tabIndex={-1} />}
      <Input
        id={id}
        type="text"
        disabled={disabled}
        autoComplete="off"
        className="h-11 w-full bg-white text-slate-900"
        placeholder={searchPlaceholder || placeholder}
        value={open || query ? query : (selected?.label || '')}
        onFocus={() => {
          if (disabled) return
          setOpen(true)
          setQuery('')
          setActive(0)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            const option = filtered[active]
            if (option) pick(option.value)
          } else if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
      {showList && (
        <ul className="mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-300 bg-white py-1 text-slate-900 shadow-lg">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          )}
          {filtered.map((option, index) => (
            <li key={`${option.value}-${index}`}>
              <button
                type="button"
                className={cn(
                  'flex w-full flex-col items-start px-3 py-2 text-left text-sm',
                  index === active ? 'bg-cyan-50' : 'hover:bg-slate-50',
                  option.value === value ? 'font-semibold' : 'font-normal'
                )}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(option.value)
                }}
              >
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs font-normal text-slate-500">{option.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const partySelectOption = (party: {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
}): SearchableOption => {
  const location = [party.address, party.city, party.state, party.pincode].map((part) => String(part || '').trim()).filter(Boolean).join(', ')
  return {
    value: party._id,
    label: [party.name, party.phone].filter(Boolean).join(' · '),
    description: [location, party.gstin ? `GSTIN ${party.gstin}` : '', party.email].filter(Boolean).join(' · '),
    searchText: [party.name, party.phone, party.email, party.address, party.city, party.state, party.pincode, party.gstin].filter(Boolean).join(' ')
  }
}

export const productSelectOption = (product: {
  _id: string
  name: string
  sku?: string
  barcode?: string
  stock?: number
  sellingPrice?: number
  purchasePrice?: number
}): SearchableOption => ({
  value: product._id,
  label: product.sku ? `${product.name} (${product.sku})` : product.name,
  description: [
    product.barcode ? `Barcode ${product.barcode}` : '',
    product.stock != null ? `Stock ${product.stock}` : '',
    product.sellingPrice != null ? `Sell ₹${product.sellingPrice}` : '',
    product.purchasePrice != null ? `Cost ₹${product.purchasePrice}` : ''
  ].filter(Boolean).join(' · '),
  searchText: [product.name, product.sku, product.barcode].filter(Boolean).join(' ')
})
