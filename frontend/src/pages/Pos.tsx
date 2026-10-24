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

const cartKey = (item: { productId: string; variantId?: string }) => `${item.productId}:${item.variantId || ''}`

const lineTotal = (item: CartItem) => {
  const base = item.actualSoldAmount * item.quantity
  return base + (base * (item.gst || 0)) / 100
}

const Pos = () => {
  const scanRef = useRef<HTMLInputElement>(null)
  const [scan, setScan] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
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

  const addProduct = (product: any) => {
    const variant = product.matchedVariant
    if ((product.variants || []).length && !variant) {
      setMessage(`Scan a variant barcode for ${product.name}.`)
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
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    clearFieldError('pos-scan')
    const code = scan.trim()
    if (!code) {
      showFieldErrors({ 'pos-scan': requiredMsg('Barcode / SKU') })
      return
    }
    setMessage('')
    try {
      const res = await axios.get('/api/products/lookup', {
        ...authHeaders(),
        params: { code }
      })
      clearFieldErrors()
      addProduct(res.data)
      setScan('')
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Barcode not found.')
      setScan('')
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
      errors['pos-cart'] = 'Scan at least one item before checkout.'
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
    <div className="space-y-4 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="POS counter"
        description="Scan first. F12 completes the bill and reprints as a POS slip."
        actions={
          lastSale ? (
            <Button type="button" variant="outline" onClick={() => printPosReceipt(lastSale._id, { reprint: true })}>
              Reprint last POS
            </Button>
          ) : null
        }
      />

      <form onSubmit={handleScan} noValidate className="rounded-2xl border bg-card p-4">
        <FormField id="pos-scan" label="Barcode / SKU" error={fieldErrors['pos-scan']} required>
          <Input
            id="pos-scan"
            ref={scanRef}
            autoFocus
            value={scan}
            onChange={(e) => {
              clearFieldError('pos-scan')
              setScan(e.target.value)
            }}
            placeholder="Scan item and press Enter"
            className="h-14 text-xl"
            autoComplete="off"
            invalid={Boolean(fieldErrors['pos-scan'])}
          />
        </FormField>
        {message && <p className="mt-2 text-sm text-amber-700">{message}</p>}
      </form>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cart ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-field="pos-cart">
            <FieldError id="pos-cart" error={fieldErrors['pos-cart']} />
            {cart.length === 0 && !fieldErrors['pos-cart'] && (
              <p className="text-sm text-muted-foreground">Waiting for scan…</p>
            )}
            {cart.map((item, index) => (
              <div key={cartKey(item)} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · ₹{item.actualSoldAmount.toFixed(2)}</p>
                </div>
                <FormField
                  id={`pos-item-${index}-qty`}
                  label="Qty"
                  error={fieldErrors[`pos-item-${index}-qty`]}
                  required
                  className="items-center"
                >
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      clearFieldError(`pos-item-${index}-qty`)
                      clearFieldError('pos-cart')
                      setQty(cartKey(item), item.quantity - 1)
                    }}>-</Button>
                    <Input
                      id={`pos-item-${index}-qty`}
                      className="h-9 w-16 text-center"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        clearFieldError(`pos-item-${index}-qty`)
                        clearFieldError('pos-cart')
                        setQty(cartKey(item), e.target.value === '' ? 0 : Number(e.target.value))
                      }}
                      invalid={Boolean(fieldErrors[`pos-item-${index}-qty`])}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      clearFieldError(`pos-item-${index}-qty`)
                      clearFieldError('pos-cart')
                      setQty(cartKey(item), item.quantity + 1)
                    }}>+</Button>
                  </div>
                </FormField>
                <p className="w-24 text-right font-semibold">₹{lineTotal(item).toFixed(2)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
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
                <SearchableSelect
                  id="pos-payment"
                  value={paymentMode}
                  onChange={(value) => {
                    clearFieldError('pos-payment')
                    setPaymentMode(value)
                  }}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'upi', label: 'UPI' },
                    { value: 'card', label: 'Card' },
                    { value: 'bank', label: 'Bank' }
                  ]}
                  invalid={Boolean(fieldErrors['pos-payment'])}
                />
              </FormField>
              <FormField
                id="pos-received"
                label="Amount received"
                error={fieldErrors['pos-received']}
                hint="Partial pay keeps the sale total and tracks outstanding. Excess is treated as change/advance."
              >
                <Input
                  id="pos-received"
                  type="number"
                  min={0}
                  step="0.01"
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
                <p className="text-xs text-muted-foreground pt-1">Sale revenue (not cash)</p>
                <p className="text-3xl font-semibold">₹{listTotal.toFixed(2)}</p>
              </div>
              <Button type="button" className="h-12 w-full" disabled={busy} onClick={checkout}>
                {busy ? 'Saving…' : 'Complete & print POS (F12)'}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={!cart.length} onClick={() => {
                setCart([])
                clearFieldErrors()
                focusScan()
              }}>
                Clear cart
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today at this counter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recent.map((sale: any) => (
                <div key={sale._id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">₹{Number(sale.total || 0).toFixed(2)} · {sale.paymentMode}</p>
                  </div>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => printPosReceipt(sale._id, { reprint: true })}>
                    Reprint POS
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Pos
