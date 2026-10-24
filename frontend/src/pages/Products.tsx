import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import ExcelImport from '@/components/ExcelImport'
import { useNavigate } from 'react-router-dom'

type Product = {
  _id: string
  name: string
  sku: string
  barcode?: string
  brand?: string
  unit?: string
  purchasePrice: number
  sellingPrice: number
  maxSellingPrice?: number
  minSellingPrice?: number
  onlinePrice?: number
  onlineVisible?: boolean
  mrp?: number
  stock: number
  averageCost?: number
  lastPurchaseCost?: number
  inventoryValue?: number
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
  maxSellingPrice: number
  minSellingPrice: number
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
    maxSellingPrice: number
    minSellingPrice: number
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
  maxSellingPrice: 0,
  minSellingPrice: 0,
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
  maxSellingPrice: 0,
  minSellingPrice: 0,
  stock: 0
}

const notNegativeMsg = 'Cannot be negative.'

type ConfirmKind = 'disable' | 'enable' | 'delete'

const Products = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Product | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

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
    clearFieldErrors()
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, businessUnitId: defaultUnitFormValue() })
    setErrorMessage('')
    clearFieldErrors()
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
      maxSellingPrice: product.maxSellingPrice || product.sellingPrice || 0,
      minSellingPrice: product.minSellingPrice || 0,
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
        maxSellingPrice: (variant as any).maxSellingPrice || variant.sellingPrice || 0,
        minSellingPrice: (variant as any).minSellingPrice || 0,
        stock: variant.stock
      }))
    })
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    clearFieldErrors()
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) errors['product-name'] = requiredMsg('Product name')
    if (!formData.sku.trim()) errors['product-sku'] = requiredMsg('SKU')

    if (formData.sellingPrice < 0) errors['selling-price'] = notNegativeMsg
    if (formData.maxSellingPrice < 0) errors['max-selling-price'] = notNegativeMsg
    if (formData.minSellingPrice < 0) errors['min-selling-price'] = notNegativeMsg
    if (formData.mrp < 0) errors['product-mrp'] = notNegativeMsg
    if (formData.onlinePrice < 0) errors['online-price'] = notNegativeMsg
    if (formData.gst < 0) errors['product-gst'] = notNegativeMsg
    if (formData.minStock < 0) errors['product-min'] = notNegativeMsg
    if (formData.maxStock < 0) errors['product-max'] = notNegativeMsg
    if (formData.purchasePrice < 0) errors['purchase-price'] = notNegativeMsg
    if (formData.stock < 0) errors['product-stock'] = notNegativeMsg

    formData.variants.forEach((variant, index) => {
      if (variant.purchasePrice < 0) errors[`variant-${index}-purchasePrice`] = notNegativeMsg
      if (variant.sellingPrice < 0) errors[`variant-${index}-sellingPrice`] = notNegativeMsg
      if (variant.stock < 0) errors[`variant-${index}-stock`] = notNegativeMsg
    })

    const namedVariants = formData.variants.filter((variant) => variant.name.trim())
    if (!editingId) {
      if (!namedVariants.length && Number(formData.stock) > 0 && Number(formData.purchasePrice) <= 0) {
        errors['purchase-price'] = 'Enter opening stock quantity and the cost per unit for that stock.'
      }
      formData.variants.forEach((variant, index) => {
        if (!variant.name.trim()) return
        if (Number(variant.stock) > 0 && Number(variant.purchasePrice) <= 0) {
          errors[`variant-${index}-purchasePrice`] =
            `Enter opening cost for variant "${variant.name}" along with its opening stock.`
        }
      })
    }

    if (showFieldErrors(errors)) return

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
            <CardDescription>
              {editingId
                ? 'Catalog details can be edited here. Stock and cost change only through purchase, sale, or adjustment.'
                : 'Add opening quantity and the cost you paid for that stock. Later purchases will keep this history and update the average cost.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            {!editingId && (
              <div className="mb-5">
                <ExcelImport
                  samplePath="/api/products/import/sample"
                  importPath="/api/products/import"
                  fileName="products-import-sample.xlsx"
                  onImported={fetchProducts}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField id="product-name" label="Product Name" error={fieldErrors['product-name']} required>
                  <Input
                    id="product-name"
                    value={formData.name}
                    onChange={(e) => {
                      clearFieldError('product-name')
                      setFormData({ ...formData, name: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-name'])}
                  />
                </FormField>
                <FormField id="product-sku" label="SKU" error={fieldErrors['product-sku']} required>
                  <Input
                    id="product-sku"
                    value={formData.sku}
                    onChange={(e) => {
                      clearFieldError('product-sku')
                      setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                    }}
                    invalid={Boolean(fieldErrors['product-sku'])}
                  />
                </FormField>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => {
                    clearFieldError('business-unit')
                    setFormData({ ...formData, businessUnitId })
                  }}
                  error={fieldErrors['business-unit']}
                />
                <FormField id="product-barcode" label="Barcode" error={fieldErrors['product-barcode']}>
                  <Input
                    id="product-barcode"
                    value={formData.barcode}
                    onChange={(e) => {
                      clearFieldError('product-barcode')
                      setFormData({ ...formData, barcode: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-barcode'])}
                  />
                </FormField>
                <FormField id="product-brand" label="Brand" error={fieldErrors['product-brand']}>
                  <Input
                    id="product-brand"
                    value={formData.brand}
                    onChange={(e) => {
                      clearFieldError('product-brand')
                      setFormData({ ...formData, brand: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-brand'])}
                  />
                </FormField>
                <FormField id="product-unit" label="Unit" error={fieldErrors['product-unit']}>
                  <Input
                    id="product-unit"
                    value={formData.unit}
                    onChange={(e) => {
                      clearFieldError('product-unit')
                      setFormData({ ...formData, unit: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-unit'])}
                  />
                </FormField>
                <FormField id="product-location" label="Rack / Location" error={fieldErrors['product-location']}>
                  <Input
                    id="product-location"
                    value={formData.location}
                    onChange={(e) => {
                      clearFieldError('product-location')
                      setFormData({ ...formData, location: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-location'])}
                  />
                </FormField>
                <FormField id="selling-price" label="Default Selling Price" error={fieldErrors['selling-price']} required>
                  <Input
                    id="selling-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => {
                      clearFieldError('selling-price')
                      setFormData({ ...formData, sellingPrice: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['selling-price'])}
                  />
                </FormField>
                <FormField id="max-selling-price" label="Maximum Selling Price" error={fieldErrors['max-selling-price']}>
                  <Input
                    id="max-selling-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.maxSellingPrice}
                    onChange={(e) => {
                      clearFieldError('max-selling-price')
                      setFormData({ ...formData, maxSellingPrice: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['max-selling-price'])}
                  />
                </FormField>
                <FormField id="min-selling-price" label="Minimum Selling Price" error={fieldErrors['min-selling-price']}>
                  <Input
                    id="min-selling-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.minSellingPrice}
                    onChange={(e) => {
                      clearFieldError('min-selling-price')
                      setFormData({ ...formData, minSellingPrice: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['min-selling-price'])}
                  />
                </FormField>
                <FormField id="product-mrp" label="MRP" error={fieldErrors['product-mrp']}>
                  <Input
                    id="product-mrp"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => {
                      clearFieldError('product-mrp')
                      setFormData({ ...formData, mrp: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['product-mrp'])}
                  />
                </FormField>
                <FormField id="online-price" label="Online Price" error={fieldErrors['online-price']}>
                  <Input
                    id="online-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.onlinePrice}
                    onChange={(e) => {
                      clearFieldError('online-price')
                      setFormData({ ...formData, onlinePrice: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['online-price'])}
                  />
                </FormField>
                <FormField id="product-gst" label="GST %" error={fieldErrors['product-gst']}>
                  <Input
                    id="product-gst"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.gst}
                    onChange={(e) => {
                      clearFieldError('product-gst')
                      setFormData({ ...formData, gst: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['product-gst'])}
                  />
                </FormField>
                <FormField id="product-min" label="Min Stock" error={fieldErrors['product-min']}>
                  <Input
                    id="product-min"
                    type="number"
                    min={0}
                    value={formData.minStock}
                    onChange={(e) => {
                      clearFieldError('product-min')
                      setFormData({ ...formData, minStock: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['product-min'])}
                  />
                </FormField>
                <FormField id="product-max" label="Max Stock" error={fieldErrors['product-max']}>
                  <Input
                    id="product-max"
                    type="number"
                    min={0}
                    value={formData.maxStock}
                    onChange={(e) => {
                      clearFieldError('product-max')
                      setFormData({ ...formData, maxStock: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['product-max'])}
                  />
                </FormField>
                <FormField id="product-hsn" label="HSN" error={fieldErrors['product-hsn']}>
                  <Input
                    id="product-hsn"
                    value={formData.hsn}
                    onChange={(e) => {
                      clearFieldError('product-hsn')
                      setFormData({ ...formData, hsn: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-hsn'])}
                  />
                </FormField>
                <FormField id="product-desc" label="Description" error={fieldErrors['product-desc']} className="md:col-span-2">
                  <Input
                    id="product-desc"
                    value={formData.description}
                    onChange={(e) => {
                      clearFieldError('product-desc')
                      setFormData({ ...formData, description: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-desc'])}
                  />
                </FormField>
                <FormField id="product-notes" label="Notes" error={fieldErrors['product-notes']}>
                  <Input
                    id="product-notes"
                    value={formData.notes}
                    onChange={(e) => {
                      clearFieldError('product-notes')
                      setFormData({ ...formData, notes: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['product-notes'])}
                  />
                </FormField>
                {!editingId && formData.variants.length === 0 && (
                  <div className="md:col-span-3 space-y-3 rounded-2xl border border-cyan-400/30 bg-cyan-50/60 p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Opening stock</h4>
                      <p className="text-xs text-muted-foreground">
                        Enter how many units you already have and what you paid per unit. Example: 100 units at ₹95.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <FormField id="product-stock" label="Opening quantity" error={fieldErrors['product-stock']} required>
                        <Input
                          id="product-stock"
                          type="number"
                          min={0}
                          value={formData.stock}
                          onChange={(e) => {
                            clearFieldError('product-stock')
                            setFormData({ ...formData, stock: e.target.value === '' ? 0 : Number(e.target.value) })
                          }}
                          invalid={Boolean(fieldErrors['product-stock'])}
                        />
                      </FormField>
                      <FormField id="purchase-price" label="Cost per unit" error={fieldErrors['purchase-price']} required>
                        <Input
                          id="purchase-price"
                          type="number"
                          min={0}
                          step="0.01"
                          value={formData.purchasePrice}
                          onChange={(e) => {
                            clearFieldError('purchase-price')
                            setFormData({ ...formData, purchasePrice: e.target.value === '' ? 0 : Number(e.target.value) })
                          }}
                          invalid={Boolean(fieldErrors['purchase-price'])}
                        />
                      </FormField>
                      <div className="space-y-2">
                        <Label>Opening value</Label>
                        <div className="flex h-10 items-center rounded-xl border bg-white px-3 text-sm font-semibold">
                          ₹{(Number(formData.stock || 0) * Number(formData.purchasePrice || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {editingId && (
                  <div className="md:col-span-3 grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Current stock</p>
                      <p className="font-semibold">{Number(products.find((row) => row._id === editingId)?.stock || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Average cost</p>
                      <p className="font-semibold">₹{Number(products.find((row) => row._id === editingId)?.averageCost || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last purchase cost</p>
                      <p className="font-semibold">₹{Number(products.find((row) => row._id === editingId)?.lastPurchaseCost || formData.purchasePrice || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Inventory value</p>
                      <p className="font-semibold">₹{Number(products.find((row) => row._id === editingId)?.inventoryValue || 0).toFixed(2)}</p>
                    </div>
                    <p className="md:col-span-4 text-xs text-muted-foreground">
                      To add more stock with a new price, create a purchase. Do not edit stock here.
                    </p>
                  </div>
                )}
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
                    {editingId
                      ? 'Existing variant stock cannot be typed here. Add stock with a purchase. New variants can still get opening quantity and cost.'
                      : 'For each variant, enter opening quantity and the cost you paid for that stock.'}
                  </p>
                  {formData.variants.map((variant, index) => {
                    const nameId = `variant-${index}-name`
                    const skuId = `variant-${index}-sku`
                    const barcodeId = `variant-${index}-barcode`
                    const attributesId = `variant-${index}-attributes`
                    const purchasePriceId = `variant-${index}-purchasePrice`
                    const sellingPriceId = `variant-${index}-sellingPrice`
                    const stockId = `variant-${index}-stock`
                    return (
                      <div key={variant._id || index} className="grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-7">
                        <FormField id={nameId} label="Name" error={fieldErrors[nameId]} className="space-y-1">
                          <Input
                            id={nameId}
                            placeholder="Name"
                            value={variant.name}
                            onChange={(e) => {
                              clearFieldError(nameId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], name: e.target.value }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[nameId])}
                          />
                        </FormField>
                        <FormField id={skuId} label="SKU" error={fieldErrors[skuId]} className="space-y-1">
                          <Input
                            id={skuId}
                            placeholder="SKU"
                            value={variant.sku}
                            onChange={(e) => {
                              clearFieldError(skuId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], sku: e.target.value }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[skuId])}
                          />
                        </FormField>
                        <FormField id={barcodeId} label="Barcode" error={fieldErrors[barcodeId]} className="space-y-1">
                          <Input
                            id={barcodeId}
                            placeholder="Barcode"
                            value={variant.barcode}
                            onChange={(e) => {
                              clearFieldError(barcodeId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], barcode: e.target.value }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[barcodeId])}
                          />
                        </FormField>
                        <FormField id={attributesId} label="Size / color" error={fieldErrors[attributesId]} className="space-y-1">
                          <Input
                            id={attributesId}
                            placeholder="Size / color"
                            value={variant.attributes}
                            onChange={(e) => {
                              clearFieldError(attributesId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], attributes: e.target.value }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[attributesId])}
                          />
                        </FormField>
                        <FormField id={purchasePriceId} label="Opening cost" error={fieldErrors[purchasePriceId]} className="space-y-1">
                          <Input
                            id={purchasePriceId}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Cost"
                            value={variant.purchasePrice}
                            onChange={(e) => {
                              clearFieldError(purchasePriceId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], purchasePrice: e.target.value === '' ? 0 : Number(e.target.value) }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[purchasePriceId])}
                          />
                        </FormField>
                        <FormField id={sellingPriceId} label="Selling price" error={fieldErrors[sellingPriceId]} className="space-y-1">
                          <Input
                            id={sellingPriceId}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Sell"
                            value={variant.sellingPrice}
                            onChange={(e) => {
                              clearFieldError(sellingPriceId)
                              const variants = [...formData.variants]
                              variants[index] = { ...variants[index], sellingPrice: e.target.value === '' ? 0 : Number(e.target.value) }
                              setFormData({ ...formData, variants })
                            }}
                            invalid={Boolean(fieldErrors[sellingPriceId])}
                          />
                        </FormField>
                        <FormField id={stockId} label="Opening stock" error={fieldErrors[stockId]} className="space-y-1">
                          <div className="flex gap-2">
                            <Input
                              id={stockId}
                              type="number"
                              min={0}
                              placeholder="Stock"
                              value={variant.stock}
                              onChange={(e) => {
                                clearFieldError(stockId)
                                const variants = [...formData.variants]
                                variants[index] = { ...variants[index], stock: e.target.value === '' ? 0 : Number(e.target.value) }
                                const stock = variants.reduce((sum, row) => sum + Number(row.stock || 0), 0)
                                setFormData({ ...formData, variants, stock })
                              }}
                              invalid={Boolean(fieldErrors[stockId])}
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
                                clearFieldErrors()
                              }}
                            >
                              ×
                            </Button>
                          </div>
                        </FormField>
                      </div>
                    )
                  })}
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
                <TableHead>Last purchase</TableHead>
                <TableHead>Avg cost</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>₹{Number(product.lastPurchaseCost ?? product.purchasePrice).toFixed(2)}</TableCell>
                  <TableCell>₹{Number(product.averageCost ?? product.purchasePrice).toFixed(2)}</TableCell>
                  <TableCell>₹{product.sellingPrice}</TableCell>
                  <TableCell className={product.stock <= 10 ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>
                    {product.stock}
                    {product.variants?.length ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">({product.variants.length} variants)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>₹{Number(product.inventoryValue ?? product.stock * (product.averageCost ?? product.purchasePrice)).toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{product.status || 'active'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/stock-history?productId=${product._id}`)}>
                        History
                      </Button>
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
                    </div>
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
