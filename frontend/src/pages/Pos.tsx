import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import { printPosReceipt } from '@/lib/print'

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

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.actualSoldAmount * item.quantity, 0)
    const gst = cart.reduce((sum, item) => sum + (item.actualSoldAmount * item.quantity * (item.gst || 0)) / 100, 0)
    const total = subtotal + gst
    return { subtotal, gst, total }
  }, [cart])

  const received = Number(paidAmount || 0)
  const listTotal = totals.total
  const billedTotal = received < listTotal ? Math.max(0, received) : listTotal
  const concession = Math.max(0, listTotal - billedTotal)
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
    const code = scan.trim()
    if (!code) return
    setMessage('')
    try {
      const res = await axios.get('/api/products/lookup', {
        ...authHeaders(),
        params: { code }
      })
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
    if (!cart.length || busy) return
    setBusy(true)
    setMessage('')
    try {
      const factor = listTotal > 0 ? billedTotal / listTotal : 1
      const items = cart.map((item) => {
        const actualSoldAmount = Number((item.actualSoldAmount * factor).toFixed(4))
        const priced = { ...item, actualSoldAmount }
        return {
          productId: item.productId,
          variantId: item.variantId || undefined,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          actualSoldAmount,
          price: actualSoldAmount,
          discount: 0,
          gst: item.gst,
          total: lineTotal(priced),
          productName: item.name
        }
      })
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
          discount: concession,
          gst,
          total: billedTotal,
          paidAmount: received,
          changeAmount
        },
        authHeaders()
      )
      setLastSale(res.data)
      setCart([])
      setCustomerId('')
      setPaymentMode('cash')
      await printPosReceipt(res.data._id)
      await loadRecent()
      setMessage(`Saved ${res.data.invoiceNumber}. POS slip sent to printer.`)
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Unable to complete this sale.')
    } finally {
      setBusy(false)
      focusScan()
    }
  }, [busy, billedTotal, cart, changeAmount, concession, customerId, listTotal, paymentMode, received, totals])

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

      <form onSubmit={handleScan} className="rounded-2xl border bg-card p-4">
        <Label htmlFor="pos-scan" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Barcode / SKU
        </Label>
        <Input
          id="pos-scan"
          ref={scanRef}
          autoFocus
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="Scan item and press Enter"
          className="mt-2 h-14 text-xl"
          autoComplete="off"
        />
        {message && <p className="mt-2 text-sm text-amber-700">{message}</p>}
      </form>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cart ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Waiting for scan…</p>}
            {cart.map((item) => (
              <div key={cartKey(item)} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · ₹{item.actualSoldAmount.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => setQty(cartKey(item), item.quantity - 1)}>-</Button>
                  <Input
                    className="h-9 w-16 text-center"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setQty(cartKey(item), Number(e.target.value))}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => setQty(cartKey(item), item.quantity + 1)}>+</Button>
                </div>
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
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <select
                  className="app-input h-10 w-full rounded-xl border px-3"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Walk-in</option>
                  {customers.map((customer: any) => (
                    <option key={customer._id} value={customer._id}>{customer.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment</Label>
                <select
                  className="app-input h-10 w-full rounded-xl border px-3"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount received</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  If this is less than the selling total, the bill is saved at the received amount.
                </p>
              </div>
              <div className="rounded-xl border px-4 py-3 space-y-1">
                <p className="flex justify-between text-sm text-muted-foreground">
                  <span>Selling total</span>
                  <span>₹{listTotal.toFixed(2)}</span>
                </p>
                {concession > 0 && (
                  <p className="flex justify-between text-sm text-amber-700">
                    <span>Concession</span>
                    <span>-₹{concession.toFixed(2)}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground pt-1">Bill total</p>
                <p className="text-3xl font-semibold">₹{billedTotal.toFixed(2)}</p>
                <p className="mt-1 text-sm">
                  {concession > 0 ? `Received ₹${received.toFixed(2)}` : `Change ₹${changeAmount.toFixed(2)}`}
                </p>
              </div>
              <Button type="button" className="h-12 w-full" disabled={!cart.length || busy} onClick={checkout}>
                {busy ? 'Saving…' : 'Complete & print POS (F12)'}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={!cart.length} onClick={() => { setCart([]); focusScan() }}>
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
