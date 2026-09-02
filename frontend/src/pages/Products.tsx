import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'

type Product = {
  _id: string
  name: string
  sku: string
  barcode?: string
  brand?: string
  unit?: string
  purchasePrice: number
  sellingPrice: number
  onlinePrice?: number
  onlineVisible?: boolean
  mrp?: number
  stock: number
  minStock?: number
  maxStock?: number
  location?: string
  gst?: number
  hsn?: string
  description?: string
  notes?: string
  variants?: Array<{
    _id?: string
    name: string
    sku?: string
    barcode?: string
    attributes?: string
    purchasePrice?: number
    sellingPrice: number
    stock: number
  }>
  status?: 'active' | 'inactive'
  businessUnitId?: string | { _id: string }
}

type ProductFormData = {
  name: string
  sku: string
  barcode: string
  brand: string
  unit: string
  purchasePrice: number
  sellingPrice: number
  onlinePrice: number
  onlineVisible: boolean
  mrp: number
  stock: number
  minStock: number
  maxStock: number
  location: string
  gst: number
  hsn: string
  description: string
  notes: string
  variants: Array<{
    _id?: string
    name: string
    sku: string
    barcode: string
    attributes: string
    purchasePrice: number
    sellingPrice: number
    stock: number
  }>
  businessUnitId: string
}

const emptyForm: ProductFormData = {
  name: '',
  sku: '',
  barcode: '',
  brand: '',
  unit: 'pcs',
  purchasePrice: 0,
  sellingPrice: 0,
  onlinePrice: 0,
  onlineVisible: false,
  mrp: 0,
  stock: 0,
  minStock: 10,
  maxStock: 0,
  location: '',
  gst: 0,
  hsn: '',
  description: '',
  notes: '',
  variants: [],
  businessUnitId: ''
}

const emptyVariant = {
  name: '',
  sku: '',
  barcode: '',
  attributes: '',
  purchasePrice: 0,
  sellingPrice: 0,
  stock: 0
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const Products = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Product | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/products', { ...authHeaders(), ...listParams })
      setProducts(listItems(res.data))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load products.')
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ ...emptyForm, businessUnitId: defaultUnitFormValue() })
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, businessUnitId: defaultUnitFormValue() })
    setErrorMessage('')
    setShowForm(true)
  }

  const openEdit = (product: Product) => {
    setEditingId(product._id)
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      brand: product.brand || '',
      unit: product.unit || 'pcs',
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      onlinePrice: product.onlinePrice || 0,
      onlineVisible: Boolean(product.onlineVisible),
      mrp: product.mrp || 0,
      stock: product.stock,
      minStock: product.minStock ?? 10,
      maxStock: product.maxStock || 0,
      location: product.location || '',
      gst: product.gst || 0,
      hsn: product.hsn || '',
      description: product.description || '',
      notes: product.notes || '',
      businessUnitId: typeof product.businessUnitId === 'object' ? product.businessUnitId?._id || '' : product.businessUnitId || '',
      variants: (product.variants || []).map((variant) => ({
        _id: variant._id,
        name: variant.name,
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        attributes: variant.attributes || '',
        purchasePrice: variant.purchasePrice ?? product.purchasePrice,
        sellingPrice: variant.sellingPrice,
        stock: variant.stock
      }))
    })
    setErrorMessage('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!formData.name.trim() || !formData.sku.trim()) {
      setErrorMessage('Product name and SKU are required.')
      return
    }
    if (formData.purchasePrice < 0 || formData.sellingPrice < 0 || formData.stock < 0) {
      setErrorMessage('Prices and stock cannot be negative.')
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...formData,
        variants: formData.variants.filter((variant) => variant.name.trim())
      }
      if (editingId) {
        await axios.put(`/api/products/${editingId}`, payload, authHeaders())
      } else {
        await axios.post('/api/products', payload, authHeaders())
      }
      closeForm()
      fetchProducts()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save product.')
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
        await axios.delete(`/api/products/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/products/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'inactive' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchProducts()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Products"
        description="Manage stock items, pricing, and your core catalog from one place."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : 'Add Product'}
          </Button>
        }
      />

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Product' : 'Add New Product'}</CardTitle>
            <CardDescription>Create a product with clean pricing and stock values.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Product Name</Label>
                  <Input id="product-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input id="product-sku" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} required />
                </div>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => setFormData({ ...formData, businessUnitId })}
                />
                <div className="space-y-2">
                  <Label htmlFor="product-barcode">Barcode</Label>
                  <Input id="product-barcode" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">Brand</Label>
                  <Input id="product-brand" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-unit">Unit</Label>
                  <Input id="product-unit" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-location">Rack / Location</Label>
                  <Input id="product-location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-stock">Current Stock</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min={0}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    disabled={formData.variants.length > 0}
                    required
                  />
                  {formData.variants.length > 0 && (
                    <p className="text-xs text-muted-foreground">Stock is the sum of variant quantities.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-min">Min Stock</Label>
                  <Input id="product-min" type="number" min={0} value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-max">Max Stock</Label>
                  <Input id="product-max" type="number" min={0} value={formData.maxStock} onChange={(e) => setFormData({ ...formData, maxStock: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase-price">Purchase Price</Label>
                  <Input id="purchase-price" type="number" min={0} step="0.01" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selling-price">Selling Price</Label>
                  <Input id="selling-price" type="number" min={0} step="0.01" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-mrp">MRP</Label>
                  <Input id="product-mrp" type="number" min={0} step="0.01" value={formData.mrp} onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="online-price">Online Price</Label>
                  <Input id="online-price" type="number" min={0} step="0.01" value={formData.onlinePrice} onChange={(e) => setFormData({ ...formData, onlinePrice: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-gst">GST %</Label>
                  <Input id="product-gst" type="number" min={0} step="0.01" value={formData.gst} onChange={(e) => setFormData({ ...formData, gst: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-hsn">HSN</Label>
                  <Input id="product-hsn" value={formData.hsn} onChange={(e) => setFormData({ ...formData, hsn: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="product-desc">Description</Label>
                  <Input id="product-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-notes">Notes</Label>
                  <Input id="product-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-3">
                  <input
                    type="checkbox"
                    checked={formData.onlineVisible}
                    onChange={(e) => setFormData({ ...formData, onlineVisible: e.target.checked })}
                  />
                  Visible for e-commerce
                </label>
                <div className="space-y-3 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <Label>Variants</Label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          variants: [...formData.variants, { ...emptyVariant, purchasePrice: formData.purchasePrice, sellingPrice: formData.sellingPrice }]
                        })
                      }
                    >
                      + Add variant
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each variant has its own SKU, barcode, prices, and stock. Sales, POS, purchases, and profit use the variant you pick or scan.
                  </p>
                  {formData.variants.map((variant, index) => (
                    <div key={variant._id || index} className="grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-7">
                      <Input
                        placeholder="Name"
                        value={variant.name}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], name: e.target.value }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <Input
                        placeholder="SKU"
                        value={variant.sku}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], sku: e.target.value }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <Input
                        placeholder="Barcode"
                        value={variant.barcode}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], barcode: e.target.value }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <Input
                        placeholder="Size / color"
                        value={variant.attributes}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], attributes: e.target.value }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Cost"
                        value={variant.purchasePrice}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], purchasePrice: Number(e.target.value) }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Sell"
                        value={variant.sellingPrice}
                        onChange={(e) => {
                          const variants = [...formData.variants]
                          variants[index] = { ...variants[index], sellingPrice: Number(e.target.value) }
                          setFormData({ ...formData, variants })
                        }}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Stock"
                          value={variant.stock}
                          onChange={(e) => {
                            const variants = [...formData.variants]
                            variants[index] = { ...variants[index], stock: Number(e.target.value) }
                            const stock = variants.reduce((sum, row) => sum + Number(row.stock || 0), 0)
                            setFormData({ ...formData, variants, stock })
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 text-red-600"
                          onClick={() => {
                            const variants = formData.variants.filter((_, i) => i !== index)
                            const stock = variants.length
                              ? variants.reduce((sum, row) => sum + Number(row.stock || 0), 0)
                              : formData.stock
                            setFormData({ ...formData, variants, stock })
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Product' : 'Save Product'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
          <CardDescription>{products.length} products currently available in your catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Purchase Price</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>₹{product.purchasePrice}</TableCell>
                  <TableCell>₹{product.sellingPrice}</TableCell>
                  <TableCell className={product.stock <= 10 ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>
                    {product.stock}
                    {product.variants?.length ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">({product.variants.length} variants)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="capitalize">{product.status || 'active'}</TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      isActive={product.status !== 'inactive'}
                      onEdit={() => openEdit(product)}
                      onToggle={() => {
                        setConfirmRow(product)
                        setConfirmKind(product.status === 'inactive' ? 'enable' : 'disable')
                      }}
                      onDelete={() => {
                        setConfirmRow(product)
                        setConfirmKind('delete')
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete product' : confirmKind === 'disable' ? 'Disable product' : 'Enable product'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.name}?`
            : confirmKind === 'disable'
              ? `Do you want to disable ${confirmRow?.name}?`
              : `Do you want to enable ${confirmRow?.name}?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'disable' ? 'Disable' : 'Enable'}
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

export default Products
