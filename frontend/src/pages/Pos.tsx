import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField, FieldError } from '@/components/FormField'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import { printPosReceipt } from '@/lib/print'
import SearchableSelect, { partySelectOption } from '@/components/SearchableSelect'

type CartItem = {
  productId: string
  variantId: string
  name: string
  sku: string
  quantity: number
  sellingPrice: number
  actualSoldAmount: number
  gst: number
  stock: number
}

type Suggestion = {
  key: string
  product: any
  variant: any | null
  label: string
  description: string
}

const cartKey = (item: { productId: string; variantId?: string }) => `${item.productId}:${item.variantId || ''}`

const lineTotal = (item: CartItem) => {
  const base = item.actualSoldAmount * item.quantity
  return base + (base * (item.gst || 0)) / 100
}

const buildSuggestions = (products: any[], query: string): Suggestion[] => {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const rows: Suggestion[] = []
  for (const product of products) {
    if (product.status === 'inactive') continue
    const variants = product.variants || []
    if (variants.length) {
      for (const variant of variants) {
        const haystack = [
          product.name,
          product.sku,
          product.barcode,
          variant.name,
          variant.sku,
          variant.barcode
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q) && !q.split(/\s+/).every((part) => haystack.includes(part))) continue
        rows.push({
          key: `${product._id}:${variant._id}`,
          product,
          variant,
          label: `${product.name} (${variant.name})`,
          description: [
            variant.sku || product.sku,
            `Stock ${Number(variant.stock || 0)}`,
            `₹${Number(variant.sellingPrice ?? product.sellingPrice ?? 0).toFixed(2)}`
          ]
            .filter(Boolean)
            .join(' · ')
        })
      }
    } else {
      const haystack = [product.name, product.sku, product.barcode, product.brand]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q) && !q.split(/\s+/).every((part) => haystack.includes(part))) continue
      rows.push({
        key: `${product._id}:`,
        product,
        variant: null,
        label: product.name,
        description: [
          product.sku,
          `Stock ${Number(product.stock || 0)}`,
          `₹${Number(product.sellingPrice || 0).toFixed(2)}`
        ]
          .filter(Boolean)
          .join(' · ')
      })
    }
  }
  return rows.slice(0, 12)
}

const Pos = () => {
  const scanRef = useRef<HTMLInputElement>(null)
  const suggestRef = useRef<HTMLDivElement>(null)
  const [scan, setScan] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeSuggest, setActiveSuggest] = useState(0)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paidAmount, setPaidAmount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [lastSale, setLastSale] = useState<any>(null)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.actualSoldAmount * item.quantity, 0)
    const gst = cart.reduce((sum, item) => sum + (item.actualSoldAmount * item.quantity * (item.gst || 0)) / 100, 0)
    const total = subtotal + gst
    return { subtotal, gst, total }
  }, [cart])

  const received = Number(paidAmount || 0)
  const listTotal = totals.total
  const outstanding = Math.max(0, listTotal - received)
  const changeAmount = Math.max(0, received - listTotal)

  const focusScan = () => {
    window.setTimeout(() => scanRef.current?.focus(), 50)
  }

  const loadRecent = async () => {
    const res = await axios.get('/api/sales', { ...authHeaders(), params: { page: 1, limit: 12 } })
    setRecent(listItems(res.data))
  }

  useEffect(() => {
    axios.get('/api/customers', { ...authHeaders(), ...listParams }).then((res) => setCustomers(listItems(res.data)))
    loadRecent().catch(() => undefined)
    focusScan()
  }, [])

  useEffect(() => {
    setPaidAmount(Number(totals.total.toFixed(2)))
  }, [totals.total])

  useEffect(() => {
    const q = scan.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSuggestOpen(false)
      setSuggestLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const res = await axios.get('/api/products', {
          ...authHeaders(),
          params: { search: q, page: 1, limit: 30 }
        })
        if (cancelled) return
        const rows = buildSuggestions(listItems(res.data), q)
        setSuggestions(rows)
        setSuggestOpen(rows.length > 0)
        setActiveSuggest(0)
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setSuggestOpen(false)
        }
      } finally {
        if (!cancelled) setSuggestLoading(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [scan])

  useEffect(() => {
    const onDocDown = (event: MouseEvent) => {
      if (!suggestRef.current?.contains(event.target as Node) && event.target !== scanRef.current) {
        setSuggestOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const addProduct = (product: any, matchedVariant: any | null = product.matchedVariant ?? null) => {
    const variant = matchedVariant
    if ((product.variants || []).length && !variant) {
      setMessage(`Choose a variant for ${product.name}.`)
      return
    }
    const variantId = variant?._id ? String(variant._id) : ''
    const name = variant ? `${product.name} (${variant.name})` : product.name
    const sku = variant?.sku || product.sku
    const sellingPrice = variant ? Number(variant.sellingPrice) : Number(product.sellingPrice)
    const stock = variant ? Number(variant.stock) : Number(product.stock)
    const incomingKey = `${product._id}:${variantId}`
    setCart((current) => {
      const existing = current.find((item) => cartKey(item) === incomingKey)
      if (existing) {
        if (existing.quantity + 1 > stock) {
          setMessage(`${name} has only ${stock} in stock.`)
          return current
        }
        return current.map((item) =>
          cartKey(item) === incomingKey ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      if (stock < 1) {
        setMessage(`${name} is out of stock.`)
        return current
      }
      return [
        ...current,
        {
          productId: product._id,
          variantId,
          name,
          sku,
          quantity: 1,
          sellingPrice,
          actualSoldAmount: sellingPrice,
          gst: product.gst || 0,
          stock
        }
      ]
    })
    setMessage(`Added ${name}`)
  }

  const pickSuggestion = (row: Suggestion) => {
    clearFieldErrors()
    addProduct(row.product, row.variant)
    setScan('')
    setSuggestions([])
    setSuggestOpen(false)
    focusScan()
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    clearFieldError('pos-scan')
    const code = scan.trim()
    if (!code) {
      showFieldErrors({ 'pos-scan': requiredMsg('Barcode / SKU / name') })
      return
    }

    if (suggestOpen && suggestions[activeSuggest]) {
      pickSuggestion(suggestions[activeSuggest])
      return
    }

    setMessage('')
    try {
      const res = await axios.get('/api/products/lookup', {
        ...authHeaders(),
        params: { code }
      })
      clearFieldErrors()
      addProduct(res.data, res.data.matchedVariant || null)
      setScan('')
      setSuggestions([])
      setSuggestOpen(false)
    } catch (err: any) {
      if (suggestions.length === 1) {
        pickSuggestion(suggestions[0])
        return
      }
      if (suggestions.length > 1) {
        setSuggestOpen(true)
        setMessage('Pick a product from the suggestions.')
        return
      }
      setMessage(err.response?.data?.message || 'No matching product. Try typing the name for suggestions.')
    } finally {
      focusScan()
    }
  }

  const setQty = (key: string, quantity: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (cartKey(item) !== key) return item
          const next = Math.max(0, Math.min(item.stock, quantity))
          return { ...item, quantity: next }
        })
        .filter((item) => item.quantity > 0)
    )
    focusScan()
  }

  const checkout = useCallback(async () => {
    if (busy) return
    setMessage('')
    clearFieldErrors()
    const errors: Record<string, string> = {}
    if (!cart.length) {
      errors['pos-cart'] = 'Add at least one item before checkout.'
    } else {
      cart.forEach((item, index) => {
        if (!item.quantity || item.quantity <= 0) {
          errors[`pos-item-${index}-qty`] = 'Quantity must be greater than zero.'
        } else if (item.quantity > item.stock) {
          errors[`pos-item-${index}-qty`] = `Only ${item.stock} in stock.`
        }
      })
    }
    if (!paymentMode) errors['pos-payment'] = requiredMsg('Payment')
    if (received < 0) errors['pos-received'] = 'Amount received cannot be negative.'
    if (showFieldErrors(errors)) return
    setBusy(true)
    try {
      const items = cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        actualSoldAmount: item.actualSoldAmount,
        price: item.actualSoldAmount,
        discount: 0,
        gst: item.gst,
        total: lineTotal(item),
        productName: item.name
      }))
      const subtotal = items.reduce((sum, item) => sum + item.actualSoldAmount * item.quantity, 0)
      const gst = items.reduce((sum, item) => sum + (item.actualSoldAmount * item.quantity * (item.gst || 0)) / 100, 0)
      const res = await axios.post(
        '/api/sales',
        {
          customerId: customerId || undefined,
          businessUnitId: defaultUnitFormValue() || undefined,
          items,
          paymentMode,
          status: 'completed',
          source: 'pos',
          subtotal,
          discount: 0,
          gst,
          total: listTotal,
          paidAmount: received,
          changeAmount
        },
        authHeaders()
      )
      setLastSale(res.data)
      setCart([])
      setCustomerId('')
      setPaymentMode('cash')
      clearFieldErrors()
      await printPosReceipt(res.data._id)
      await loadRecent()
      setMessage(`Saved ${res.data.invoiceNumber}. POS slip sent to printer.`)
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Unable to complete this sale.')
    } finally {
      setBusy(false)
      focusScan()
    }
  }, [busy, cart, changeAmount, clearFieldErrors, customerId, listTotal, paymentMode, received, showFieldErrors])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        event.preventDefault()
        checkout()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [checkout])

  return (
    <div className="space-y-4 p-3 pb-28 sm:p-6 sm:pb-8 lg:p-8">
      <PageHeader
        title="POS counter"
        description="Type a name (e.g. dona) for suggestions, or scan barcode/SKU. F12 completes the bill."
        actions={
          lastSale ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => printPosReceipt(lastSale._id, { reprint: true })}>
              Reprint last
            </Button>
          ) : null
        }
      />

      <form onSubmit={handleScan} noValidate className="relative rounded-2xl border bg-card p-3 sm:p-4">
        <FormField id="pos-scan" label="Search / scan item" error={fieldErrors['pos-scan']} required>
          <Input
            id="pos-scan"
            ref={scanRef}
            autoFocus
            value={scan}
            onChange={(e) => {
              clearFieldError('pos-scan')
              setScan(e.target.value)
              setSuggestOpen(true)
            }}
            onFocus={() => {
              if (suggestions.length) setSuggestOpen(true)
            }}
            onKeyDown={(event) => {
              if (!suggestOpen || !suggestions.length) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveSuggest((current) => Math.min(current + 1, suggestions.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveSuggest((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Escape') {
                setSuggestOpen(false)
              }
            }}
            placeholder="Type name like dona, or scan barcode"
            className="h-14 text-lg sm:text-xl"
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            invalid={Boolean(fieldErrors['pos-scan'])}
          />
        </FormField>
        {suggestOpen && scan.trim().length >= 2 && (
          <div
            ref={suggestRef}
            className="absolute left-3 right-3 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-300 py-1 text-slate-900 shadow-2xl sm:left-4 sm:right-4"
            style={{ backgroundColor: '#ffffff', opacity: 1 }}
          >
            {suggestLoading && (
              <p className="bg-white px-3 py-3 text-sm text-slate-500">Searching…</p>
            )}
            {!suggestLoading && suggestions.length === 0 && (
              <p className="bg-white px-3 py-3 text-sm text-slate-500">No products match “{scan.trim()}”.</p>
            )}
            {!suggestLoading &&
              suggestions.map((row, index) => (
                <button
                  key={row.key}
                  type="button"
                  className={[
                    'flex w-full flex-col items-start px-3 py-3 text-left text-sm text-slate-900',
                    index === activeSuggest ? 'bg-cyan-50' : 'bg-white hover:bg-slate-50 active:bg-cyan-100'
                  ].join(' ')}
                  style={{ backgroundColor: index === activeSuggest ? '#ecfeff' : '#ffffff' }}
                  onMouseEnter={() => setActiveSuggest(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    pickSuggestion(row)
                  }}
                >
                  <span className="font-semibold text-slate-900">{row.label}</span>
                  <span className="text-xs text-slate-600">{row.description}</span>
                </button>
              ))}
          </div>
        )}
        {message && <p className="mt-2 text-sm text-amber-700">{message}</p>}
      </form>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Cart ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-field="pos-cart">
            <FieldError id="pos-cart" error={fieldErrors['pos-cart']} />
            {cart.length === 0 && !fieldErrors['pos-cart'] && (
              <p className="text-sm text-muted-foreground">Type a product name or scan a barcode to add items.</p>
            )}
            {cart.map((item, index) => (
              <div
                key={cartKey(item)}
                className="grid grid-cols-1 gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · ₹{item.actualSoldAmount.toFixed(2)}</p>
                </div>
                <FormField
                  id={`pos-item-${index}-qty`}
                  label="Qty"
                  error={fieldErrors[`pos-item-${index}-qty`]}
                  required
                >
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
                        clearFieldError(`pos-item-${index}-qty`)
                        clearFieldError('pos-cart')
                        setQty(cartKey(item), item.quantity - 1)
                      }}
                    >
                      -
                    </Button>
                    <Input
                      id={`pos-item-${index}-qty`}
                      className="h-11 w-16 text-center text-base"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => {
                        clearFieldError(`pos-item-${index}-qty`)
                        clearFieldError('pos-cart')
                        setQty(cartKey(item), e.target.value === '' ? 0 : Number(e.target.value))
                      }}
                      invalid={Boolean(fieldErrors[`pos-item-${index}-qty`])}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
                        clearFieldError(`pos-item-${index}-qty`)
                        clearFieldError('pos-cart')
                        setQty(cartKey(item), item.quantity + 1)
                      }}
                    >
                      +
                    </Button>
                  </div>
                </FormField>
                <p className="text-right text-lg font-semibold sm:w-24">₹{lineTotal(item).toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Checkout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormField id="pos-customer" label="Customer" error={fieldErrors['pos-customer']}>
                <SearchableSelect
                  id="pos-customer"
                  value={customerId}
                  onChange={(value) => {
                    clearFieldError('pos-customer')
                    setCustomerId(value)
                  }}
                  placeholder="Select customer"
                  searchPlaceholder="Search name, phone, or address…"
                  emptyLabel="Walk-in"
                  options={customers.map(partySelectOption)}
                  invalid={Boolean(fieldErrors['pos-customer'])}
                />
              </FormField>
              <FormField id="pos-payment" label="Payment" error={fieldErrors['pos-payment']} required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {['cash', 'upi', 'card', 'bank'].map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={paymentMode === mode ? 'default' : 'outline'}
                      className="min-h-11 capitalize"
                      onClick={() => {
                        clearFieldError('pos-payment')
                        setPaymentMode(mode)
                      }}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
                {fieldErrors['pos-payment'] && (
                  <p className="text-sm text-red-600" role="alert">{fieldErrors['pos-payment']}</p>
                )}
              </FormField>
              <FormField
                id="pos-received"
                label="Amount received"
                error={fieldErrors['pos-received']}
                hint="Partial pay keeps sale total and tracks outstanding."
              >
                <Input
                  id="pos-received"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="h-12 text-base"
                  value={paidAmount}
                  onChange={(e) => {
                    clearFieldError('pos-received')
                    setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value))
                  }}
                  invalid={Boolean(fieldErrors['pos-received'])}
                />
              </FormField>
              <div className="rounded-xl border px-4 py-3 space-y-1">
                <p className="flex justify-between text-sm text-muted-foreground">
                  <span>Invoice total</span>
                  <span>₹{listTotal.toFixed(2)}</span>
                </p>
                <p className="flex justify-between text-sm">
                  <span>Received</span>
                  <span>₹{received.toFixed(2)}</span>
                </p>
                {outstanding > 0 && (
                  <p className="flex justify-between text-sm text-amber-700">
                    <span>Outstanding</span>
                    <span>₹{outstanding.toFixed(2)}</span>
                  </p>
                )}
                {changeAmount > 0 && (
                  <p className="flex justify-between text-sm text-emerald-700">
                    <span>Change / advance</span>
                    <span>₹{changeAmount.toFixed(2)}</span>
                  </p>
                )}
                <p className="pt-1 text-xs text-muted-foreground">Sale revenue</p>
                <p className="text-3xl font-semibold">₹{listTotal.toFixed(2)}</p>
              </div>
              <div className="hidden gap-2 sm:grid">
                <Button type="button" className="h-12 w-full" disabled={busy} onClick={checkout}>
                  {busy ? 'Saving…' : 'Complete & print POS (F12)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={!cart.length}
                  onClick={() => {
                    setCart([])
                    clearFieldErrors()
                    focusScan()
                  }}
                >
                  Clear cart
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hidden sm:block">
            <CardHeader>
              <CardTitle>Today at this counter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.map((sale: any) => (
                <div key={sale._id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{Number(sale.total || 0).toFixed(2)} · {sale.paymentMode}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => printPosReceipt(sale._id, { reprint: true })}
                  >
                    Reprint
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:hidden safe-bottom">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{cart.length} item(s)</span>
          <span className="text-lg font-semibold">₹{listTotal.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            disabled={!cart.length}
            onClick={() => {
              setCart([])
              clearFieldErrors()
              focusScan()
            }}
          >
            Clear
          </Button>
          <Button type="button" className="min-h-12" disabled={busy || !cart.length} onClick={checkout}>
            {busy ? 'Saving…' : 'Complete sale'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Pos
