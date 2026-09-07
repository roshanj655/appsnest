import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import SearchableSelect, { productSelectOption } from '@/components/SearchableSelect'

type Product = {
  _id: string
  name: string
  sku: string
  stock: number
  variants?: Array<{ _id: string; name: string; stock: number }>
}

type Adjustment = {
  _id: string
  quantity: number
  direction: 'in' | 'out'
  reason: string
  notes?: string
  status: 'active' | 'cancelled'
  createdAt: string
  productId?: Product | string
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const reasons = [
  { value: 'opening', label: 'Opening stock', direction: 'in' as const },
  { value: 'found', label: 'Stock found', direction: 'in' as const },
  { value: 'damage', label: 'Damage', direction: 'out' as const },
  { value: 'loss', label: 'Loss / shortage', direction: 'out' as const },
  { value: 'expiry', label: 'Expiry', direction: 'out' as const },
  { value: 'return', label: 'Return / write-off', direction: 'out' as const },
  { value: 'correction', label: 'Count correction', direction: 'in' as const },
  { value: 'other', label: 'Other', direction: 'in' as const }
]

const emptyForm = {
  productId: '',
  variantId: '',
  quantity: 1,
  reason: 'opening',
  direction: 'in' as 'in' | 'out',
  unitCost: 0,
  notes: ''
}

const productName = (row: Adjustment) =>
  typeof row.productId === 'object' && row.productId ? row.productId.name : 'Unknown product'

const StockAdjustments = () => {
  const [items, setItems] = useState<Adjustment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Adjustment | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = async () => {
    try {
      const [adjRes, productRes] = await Promise.all([
        axios.get('/api/stock-adjustments', { ...authHeaders(), ...listParams }),
        axios.get('/api/products', { ...authHeaders(), ...listParams })
      ])
      setItems(listItems(adjRes.data))
      setProducts(listItems(productRes.data))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load stock adjustments.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const closeForm = () => {
    setShowForm(false)
    setFormData(emptyForm)
  }

  const applyReason = (reason: string) => {
    const match = reasons.find((item) => item.value === reason)
    setFormData((current) => ({
      ...current,
      reason,
      direction: match?.direction || current.direction
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!formData.productId) {
      setErrorMessage('Select a product.')
      return
    }
    const product = products.find((row) => row._id === formData.productId)
    if ((product?.variants || []).length && !formData.variantId) {
      setErrorMessage('Select a variant.')
      return
    }
    try {
      setSaving(true)
      await axios.post('/api/stock-adjustments', formData, authHeaders())
      closeForm()
      load()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save stock adjustment.')
    } finally {
      setSaving(false)
    }
  }

  const runConfirm = async () => {
    if (!confirmKind || !confirmRow) return
    setConfirmBusy(true)
    setErrorMessage('')
    try {
      if (confirmKind === 'delete') {
        await axios.delete(`/api/stock-adjustments/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/stock-adjustments/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'cancelled' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      load()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Stock Adjustments"
        description="Correct opening stock, damage, loss, and count differences without creating a purchase or sale."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : setShowForm(true))}>
            {showForm ? 'Close Form' : 'Add Adjustment'}
          </Button>
        }
      />

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Stock Adjustment</CardTitle>
            <CardDescription>Stock in increases quantity. Stock out decreases it.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="adj-product">Product</Label>
                  <SearchableSelect
                    id="adj-product"
                    value={formData.productId}
                    onChange={(productId) => setFormData({ ...formData, productId, variantId: '' })}
                    placeholder="Select product"
                    searchPlaceholder="Search name or SKU…"
                    required
                    options={products.filter((product) => product).map(productSelectOption)}
                  />
                </div>
                {(() => {
                  const product = products.find((row) => row._id === formData.productId)
                  const variants = product?.variants || []
                  if (!variants.length) return null
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="adj-variant">Variant</Label>
                      <SearchableSelect
                        id="adj-variant"
                        value={formData.variantId}
                        onChange={(variantId) => setFormData({ ...formData, variantId })}
                        placeholder="Select variant"
                        required
                        options={variants.map((variant) => ({
                          value: variant._id,
                          label: variant.name,
                          description: `Stock ${variant.stock}`,
                          searchText: variant.name
                        }))}
                      />
                    </div>
                  )
                })()}
                <div className="space-y-2">
                  <Label htmlFor="adj-reason">Reason</Label>
                  <SearchableSelect
                    id="adj-reason"
                    value={formData.reason}
                    onChange={applyReason}
                    options={reasons.map((reason) => ({ value: reason.value, label: reason.label }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adj-direction">Direction</Label>
                  <SearchableSelect
                    id="adj-direction"
                    value={formData.direction}
                    onChange={(direction) => setFormData({ ...formData, direction: direction as 'in' | 'out' })}
                    options={[
                      { value: 'in', label: 'Stock in' },
                      { value: 'out', label: 'Stock out' }
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adj-qty">Quantity</Label>
                  <Input
                    id="adj-qty"
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    required
                  />
                </div>
                {formData.direction === 'in' && (
                  <div className="space-y-2">
                    <Label htmlFor="adj-cost">Cost basis</Label>
                    <Input
                      id="adj-cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value === '' ? 0 : Number(e.target.value) })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adj-notes">Notes</Label>
                  <Input
                    id="adj-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional details"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Adjustment'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
          <CardDescription>{items.length} stock movements recorded outside sales and purchases.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No stock adjustments yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{productName(row)}</TableCell>
                    <TableCell className="capitalize">{row.reason.replace('_', ' ')}</TableCell>
                    <TableCell className={row.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}>
                      {row.direction === 'in' ? 'In' : 'Out'}
                    </TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell className="text-right">
                      <RecordActions
                        isActive={row.status === 'active'}
                        hideEdit
                        disableLabel="Cancel"
                        enableLabel="Restore"
                        onToggle={() => {
                          setConfirmRow(row)
                          setConfirmKind(row.status === 'active' ? 'disable' : 'enable')
                        }}
                        onDelete={() => {
                          setConfirmRow(row)
                          setConfirmKind('delete')
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete adjustment' : confirmKind === 'disable' ? 'Cancel adjustment' : 'Restore adjustment'}
        description={
          confirmKind === 'delete'
            ? `Delete this stock adjustment for ${productName(confirmRow as Adjustment)}? Active movements will reverse stock.`
            : confirmKind === 'disable'
              ? `Cancel this adjustment and reverse its stock effect?`
              : `Restore this adjustment and apply stock again?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'disable' ? 'Cancel movement' : 'Restore'}
        variant={confirmKind === 'enable' ? 'default' : 'destructive'}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmKind(null)
            setConfirmRow(null)
          }
        }}
      />
    </div>
  )
}

export default StockAdjustments
