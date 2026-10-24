import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { FormField, FieldError } from '@/components/FormField'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import SearchableSelect, { partySelectOption, productSelectOption } from '@/components/SearchableSelect'

interface FormItem {
  productId: string
  variantId: string
  quantity: number
  price: number
  discount: number
  gst: number
  total: number
}

const Purchases = () => {
  const [purchases, setPurchases] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmKind, setConfirmKind] = useState<'cancel' | 'enable' | 'delete' | null>(null)
  const [confirmRow, setConfirmRow] = useState<any>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([])
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState<{
    supplierId: string
    supplierInvoiceNumber: string
    paidAmount: number
    businessUnitId: string
    items: FormItem[]
    status: string
  }>({
    supplierId: '',
    supplierInvoiceNumber: '',
    paidAmount: 0,
    businessUnitId: defaultUnitFormValue(),
    items: [],
    status: 'completed'
  })
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()
  const {
    fieldErrors: emailFieldErrors,
    clearFieldErrors: clearEmailFieldErrors,
    clearFieldError: clearEmailFieldError,
    showFieldErrors: showEmailFieldErrors
  } = useFieldErrors()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [purchasesRes, productsRes, suppliersRes] = await Promise.all([
        axios.get('/api/purchases', { headers: { Authorization: `Bearer ${token}` }, ...listParams }),
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` }, ...listParams }),
        axios.get('/api/suppliers', { headers: { Authorization: `Bearer ${token}` }, ...listParams })
      ])
      setPurchases(listItems(purchasesRes.data))
      setProducts(listItems(productsRes.data))
      setSuppliers(listItems(suppliersRes.data))
    } catch (err) {
      console.error(err)
    }
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', variantId: '', quantity: 1, price: 0, discount: 0, gst: 0, total: 0 }]
    })
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'productId') {
      const product = products.find((p: any) => p._id === value)
      newItems[index].variantId = ''
      if (product) {
        const variants = product.variants || []
        if (variants.length === 1) {
          newItems[index].variantId = String(variants[0]._id)
          newItems[index].price = variants[0].purchasePrice ?? product.purchasePrice
        } else if (!variants.length) {
          newItems[index].price = product.purchasePrice
        } else {
          newItems[index].price = 0
        }
        newItems[index].gst = product.gst || 0
        newItems[index].total = (newItems[index].price * newItems[index].quantity) - newItems[index].discount + (newItems[index].price * newItems[index].quantity * (newItems[index].gst || 0) / 100)
      }
    } else if (field === 'variantId') {
      const product = products.find((p: any) => p._id === newItems[index].productId)
      const variant = (product?.variants || []).find((row: any) => String(row._id) === String(value))
      if (variant) {
        newItems[index].price = variant.purchasePrice ?? product.purchasePrice
        newItems[index].gst = product.gst || 0
        newItems[index].total = (newItems[index].price * newItems[index].quantity) - newItems[index].discount + (newItems[index].price * newItems[index].quantity * (product.gst || 0) / 100)
      }
    } else if (field === 'quantity' || field === 'price' || field === 'discount' || field === 'gst') {
      const item = newItems[index]
      item.total = (item.price * item.quantity) - item.discount + (item.price * item.quantity * item.gst / 100)
    }
    
    setFormData({ ...formData, items: newItems })
  }

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const totalDiscount = formData.items.reduce((sum: number, item: any) => sum + item.discount, 0)
    const totalGst = formData.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity * item.gst / 100), 0)
    const total = formData.items.reduce((sum: number, item: any) => sum + item.total, 0)
    return { subtotal, totalDiscount, totalGst, total }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  const handleNewAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewAttachmentFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    clearFieldErrors()
    const errors: Record<string, string> = {}
    if (formData.paidAmount < 0) errors['purchase-paid'] = 'Paid amount cannot be negative.'
    if (!formData.items.length) {
      errors['purchase-items'] = 'Add at least one product line to this purchase.'
    } else {
      formData.items.forEach((item, index) => {
        if (!item.productId) errors[`purchase-item-${index}-product`] = requiredMsg('Product')
        const product = products.find((row: any) => row._id === item.productId)
        const variants = product?.variants || []
        if (item.productId && variants.length && !item.variantId) {
          errors[`purchase-item-${index}-variant`] = requiredMsg('Variant')
        }
        if (!item.quantity || item.quantity <= 0) {
          errors[`purchase-item-${index}-qty`] = 'Quantity must be greater than zero.'
        }
        if (item.price < 0) {
          errors[`purchase-item-${index}-price`] = 'Price cannot be negative.'
        }
        if (item.discount < 0) {
          errors[`purchase-item-${index}-discount`] = 'Discount cannot be negative.'
        }
      })
    }
    if (showFieldErrors(errors)) return
    try {
      const token = localStorage.getItem('token')
      const totals = calculateTotals()
      const formDataObj = new FormData()
      
      formDataObj.append('supplierId', formData.supplierId)
      formDataObj.append('businessUnitId', formData.businessUnitId)
      formDataObj.append('items', JSON.stringify(formData.items))
      formDataObj.append('supplierInvoiceNumber', formData.supplierInvoiceNumber)
      formDataObj.append('paidAmount', String(formData.paidAmount || totals.total))
      formDataObj.append('subtotal', totals.subtotal.toString())
      formDataObj.append('discount', totals.totalDiscount.toString())
      formDataObj.append('gst', totals.totalGst.toString())
      formDataObj.append('total', totals.total.toString())
      
      selectedFiles.forEach(file => {
        formDataObj.append('attachments', file)
      })
      
      if (editingId) {
        await axios.put(`/api/purchases/${editingId}`, {
          supplierId: formData.supplierId,
          supplierInvoiceNumber: formData.supplierInvoiceNumber,
          paidAmount: formData.paidAmount || totals.total,
          subtotal: totals.subtotal,
          discount: totals.totalDiscount,
          gst: totals.totalGst,
          total: totals.total
        }, { headers: { Authorization: `Bearer ${token}` } })
      } else {
        await axios.post('/api/purchases', formDataObj, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      setShowForm(false)
      setEditingId(null)
      clearFieldErrors()
      setFormData({ supplierId: '', supplierInvoiceNumber: '', paidAmount: 0, businessUnitId: defaultUnitFormValue(), items: [], status: 'completed' })
      setSelectedFiles([])
      fetchData()
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Unable to save purchase.')
      console.error(err)
    }
  }

  const openEdit = (purchase: any) => {
    setEditingId(purchase._id)
    setFormError('')
    clearFieldErrors()
    setFormData({
      supplierId: purchase.supplierId?._id || purchase.supplierId || '',
      supplierInvoiceNumber: purchase.supplierInvoiceNumber || '',
      paidAmount: purchase.paidAmount ?? purchase.total ?? 0,
      businessUnitId: purchase.businessUnitId?._id || purchase.businessUnitId || defaultUnitFormValue(),
      items: (purchase.items || []).map((item: any) => ({
        productId: item.productId?._id || item.productId || '',
        variantId: item.variantId ? String(item.variantId) : '',
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        gst: item.gst || 0,
        total: item.total
      })),
      status: purchase.status || 'completed'
    })
    setShowForm(true)
  }

  const runConfirm = async () => {
    if (!confirmKind || !confirmRow) return
    setConfirmBusy(true)
    try {
      if (confirmKind === 'delete') {
        await axios.delete(`/api/purchases/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/purchases/${confirmRow._id}`,
          { status: confirmKind === 'cancel' ? 'cancelled' : 'completed' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setConfirmBusy(false)
    }
  }

  const downloadInvoice = async (purchaseId: string, format = 'a4') => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`/api/purchases/${purchaseId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { format },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `purchase-invoice-${purchaseId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error downloading purchase invoice:', err)
    }
  }

  const downloadAttachment = async (purchaseId: string, attachmentId: string, filename: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`/api/purchases/${purchaseId}/attachments/${attachmentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error downloading attachment:', err)
    }
  }

  const sendEmail = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedPurchase) return
    setEmailError('')
    clearEmailFieldErrors()
    const errors: Record<string, string> = {}
    if (!emailTo.trim()) errors['purchase-email-to'] = requiredMsg('Recipient email')
    else if (!isValidEmail(emailTo)) errors['purchase-email-to'] = emailMsg
    if (showEmailFieldErrors(errors)) return
    setEmailBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`/api/purchases/${selectedPurchase._id}/email`, {
        to: emailTo.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowEmailDialog(false)
      setSelectedPurchase(null)
      setEmailTo('')
      clearEmailFieldErrors()
    } catch (err: any) {
      setEmailError(err.response?.data?.message || 'Failed to send invoice.')
      console.error('Error sending email:', err)
    } finally {
      setEmailBusy(false)
    }
  }

  const uploadNewAttachment = async () => {
    if (!selectedPurchase || newAttachmentFiles.length === 0) return
    try {
      const token = localStorage.getItem('token')
      const formDataObj = new FormData()
      newAttachmentFiles.forEach(file => {
        formDataObj.append('attachments', file)
      })
      await axios.post(`/api/purchases/${selectedPurchase._id}/attachments`, formDataObj, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert('Attachments uploaded successfully!')
      setShowAttachmentDialog(false)
      setNewAttachmentFiles([])
      fetchData()
    } catch (err) {
      console.error('Error uploading attachments:', err)
      alert('Failed to upload attachments')
    }
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Purchases"
        description="Manage purchases, invoices, and supplier transactions"
        actions={
          <Button type="button" onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingId(null)
              clearFieldErrors()
            } else {
              setEditingId(null)
              setFormError('')
              clearFieldErrors()
              setFormData({ supplierId: '', supplierInvoiceNumber: '', paidAmount: 0, businessUnitId: defaultUnitFormValue(), items: [], status: 'completed' })
              setShowForm(true)
            }
          }}>
            {showForm ? 'Cancel' : 'New Purchase'}
          </Button>
        }
      />

      {formError && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Edit Purchase' : 'Create New Purchase'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id="purchase-supplier" label="Supplier" error={fieldErrors['purchase-supplier']}>
                  <SearchableSelect
                    id="purchase-supplier"
                    value={formData.supplierId}
                    onChange={(supplierId) => {
                      clearFieldError('purchase-supplier')
                      setFormData({ ...formData, supplierId })
                    }}
                    placeholder="Select supplier"
                    searchPlaceholder="Search name, phone, or address…"
                    emptyLabel="Select supplier"
                    options={suppliers.map(partySelectOption)}
                    invalid={Boolean(fieldErrors['purchase-supplier'])}
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
                <FormField id="purchase-invoice" label="Supplier Invoice No." error={fieldErrors['purchase-invoice']}>
                  <Input
                    id="purchase-invoice"
                    value={formData.supplierInvoiceNumber}
                    onChange={(e) => {
                      clearFieldError('purchase-invoice')
                      setFormData({ ...formData, supplierInvoiceNumber: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['purchase-invoice'])}
                  />
                </FormField>
                <FormField id="purchase-paid" label="Paid Amount" error={fieldErrors['purchase-paid']}>
                  <Input
                    id="purchase-paid"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={(e) => {
                      clearFieldError('purchase-paid')
                      setFormData({ ...formData, paidAmount: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['purchase-paid'])}
                  />
                </FormField>
              </div>

              <div className="space-y-2" data-field="purchase-items">
                <div className="flex justify-between items-center">
                  <Label>Items{formData.items.length === 0 ? <span className="text-red-600"> *</span> : null}</Label>
                  <Button type="button" variant="secondary" onClick={() => { clearFieldError('purchase-items'); addItem() }}>
                    + Add Item
                  </Button>
                </div>
                <FieldError id="purchase-items" error={fieldErrors['purchase-items']} />
                {formData.items.map((item: any, index: number) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-7">
                    <FormField
                      id={`purchase-item-${index}-product`}
                      label="Product"
                      error={fieldErrors[`purchase-item-${index}-product`]}
                      required
                    >
                      <SearchableSelect
                        id={`purchase-item-${index}-product`}
                        value={item.productId}
                        onChange={(productId) => {
                          clearFieldError(`purchase-item-${index}-product`)
                          clearFieldError(`purchase-item-${index}-variant`)
                          updateItem(index, 'productId', productId)
                        }}
                        placeholder="Select product"
                        searchPlaceholder="Search name, SKU, or barcode…"
                        options={products.map((product: any) => productSelectOption({
                          ...product,
                          purchasePrice: product.purchasePrice,
                          sellingPrice: product.sellingPrice
                        }))}
                        invalid={Boolean(fieldErrors[`purchase-item-${index}-product`])}
                      />
                    </FormField>
                    {(() => {
                      const product = products.find((row: any) => row._id === item.productId)
                      const variants = product?.variants || []
                      if (!variants.length) return <div className="hidden md:block" />
                      return (
                        <FormField
                          id={`purchase-item-${index}-variant`}
                          label="Variant"
                          error={fieldErrors[`purchase-item-${index}-variant`]}
                          required
                        >
                          <SearchableSelect
                            id={`purchase-item-${index}-variant`}
                            value={item.variantId}
                            onChange={(variantId) => {
                              clearFieldError(`purchase-item-${index}-variant`)
                              updateItem(index, 'variantId', variantId)
                            }}
                            placeholder="Select variant"
                            options={variants.map((variant: any) => ({
                              value: String(variant._id),
                              label: variant.name,
                              description: `Stock ${variant.stock}${variant.sku ? ` · ${variant.sku}` : ''}`,
                              searchText: `${variant.name} ${variant.sku || ''} ${variant.barcode || ''}`
                            }))}
                            invalid={Boolean(fieldErrors[`purchase-item-${index}-variant`])}
                          />
                        </FormField>
                      )
                    })()}
                    <FormField id={`purchase-item-${index}-qty`} label="Quantity" error={fieldErrors[`purchase-item-${index}-qty`]} required>
                      <Input
                        id={`purchase-item-${index}-qty`}
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          clearFieldError(`purchase-item-${index}-qty`)
                          updateItem(index, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`purchase-item-${index}-qty`])}
                      />
                    </FormField>
                    <FormField id={`purchase-item-${index}-price`} label="Price" error={fieldErrors[`purchase-item-${index}-price`]} required>
                      <Input
                        id={`purchase-item-${index}-price`}
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => {
                          clearFieldError(`purchase-item-${index}-price`)
                          updateItem(index, 'price', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`purchase-item-${index}-price`])}
                      />
                    </FormField>
                    <FormField id={`purchase-item-${index}-discount`} label="Discount" error={fieldErrors[`purchase-item-${index}-discount`]}>
                      <Input
                        id={`purchase-item-${index}-discount`}
                        type="number"
                        placeholder="Discount"
                        value={item.discount}
                        onChange={(e) => {
                          clearFieldError(`purchase-item-${index}-discount`)
                          updateItem(index, 'discount', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`purchase-item-${index}-discount`])}
                      />
                    </FormField>
                    <FormField id={`purchase-item-${index}-gst`} label="GST %">
                      <Input
                        id={`purchase-item-${index}-gst`}
                        type="number"
                        placeholder="GST %"
                        value={item.gst}
                        onChange={(e) => updateItem(index, 'gst', e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormField>
                    <FormField id={`purchase-item-${index}-total`} label="Line Total">
                      <Input
                        id={`purchase-item-${index}-total`}
                        type="number"
                        placeholder="Total"
                        value={item.total}
                        readOnly
                        className="bg-gray-100"
                      />
                    </FormField>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-64 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{totals.totalDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST:</span>
                    <span>₹{totals.totalGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total:</span>
                    <span>₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="attachments">Attach Files</Label>
                <Input
                  id="attachments"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                />
                {selectedFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">Selected files:</p>
                    <ul className="list-disc list-inside text-sm">
                      {selectedFiles.map((file, index) => (
                        <li key={index}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit">
                  Save Purchase
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase: any) => (
                  <TableRow key={purchase._id}>
                    <TableCell className="font-medium">{purchase.invoiceNumber}</TableCell>
                    <TableCell>{purchase.supplierId?.name || 'N/A'}</TableCell>
                    <TableCell>{new Date(purchase.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>₹{purchase.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${purchase.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {purchase.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {purchase.attachments && purchase.attachments.length > 0 ? (
                        <div>
                          <span className="text-sm text-gray-600">{purchase.attachments.length} file(s)</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {purchase.attachments.map((attachment: any) => (
                              <Button
                                key={attachment._id}
                                variant="link"
                                size="sm"
                                onClick={() => downloadAttachment(purchase._id, attachment._id, attachment.filename)}
                                className="text-xs p-0 h-auto"
                              >
                                {attachment.filename}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => downloadInvoice(purchase._id)}
                          className="text-xs p-0 h-auto"
                        >
                          Invoice (A4)
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => downloadInvoice(purchase._id, 'thermal')}
                          className="text-xs p-0 h-auto text-purple-600"
                        >
                          Receipt
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSelectedPurchase(purchase)
                            setShowAttachmentDialog(true)
                          }}
                          className="text-xs p-0 h-auto text-orange-600"
                        >
                          Attach
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSelectedPurchase(purchase)
                            setEmailTo(purchase.supplierId?.email || '')
                            setEmailError('')
                            clearEmailFieldErrors()
                            setShowEmailDialog(true)
                          }}
                          className="text-xs p-0 h-auto text-emerald-600"
                        >
                          Send Email
                        </Button>
                        <RecordActions
                          isActive={purchase.status !== 'cancelled'}
                          disableLabel="Cancel"
                          enableLabel="Restore"
                          onEdit={() => openEdit(purchase)}
                          onToggle={() => {
                            setConfirmRow(purchase)
                            setConfirmKind(purchase.status === 'cancelled' ? 'enable' : 'cancel')
                          }}
                          onDelete={() => {
                            setConfirmRow(purchase)
                            setConfirmKind('delete')
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showEmailDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Send Purchase Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {emailError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{emailError}</div>
              )}
              <form onSubmit={sendEmail} noValidate className="space-y-4">
                <FormField id="purchase-email-to" label="To" error={emailFieldErrors['purchase-email-to']} required>
                  <Input
                    id="purchase-email-to"
                    type="email"
                    value={emailTo}
                    onChange={(e) => {
                      clearEmailFieldError('purchase-email-to')
                      setEmailTo(e.target.value)
                    }}
                    placeholder="email@example.com"
                    invalid={Boolean(emailFieldErrors['purchase-email-to'])}
                  />
                </FormField>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEmailDialog(false)
                      setSelectedPurchase(null)
                      setEmailTo('')
                      setEmailError('')
                      clearEmailFieldErrors()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={emailBusy}>
                    {emailBusy ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showAttachmentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Manage Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPurchase?.attachments && selectedPurchase.attachments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Current Attachments:</h4>
                  <ul className="space-y-1">
                    {selectedPurchase.attachments.map((attachment: any) => (
                      <li key={attachment._id} className="flex justify-between items-center text-sm">
                        <span>{attachment.filename}</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => downloadAttachment(selectedPurchase._id, attachment._id, attachment.filename)}
                          className="p-0 h-auto"
                        >
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="newAttachments">Add New Attachments:</Label>
                <Input
                  id="newAttachments"
                  type="file"
                  multiple
                  onChange={handleNewAttachmentFileChange}
                />
                {newAttachmentFiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">Selected files:</p>
                    <ul className="list-disc list-inside text-sm">
                      {newAttachmentFiles.map((file, index) => (
                        <li key={index}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAttachmentDialog(false)
                    setSelectedPurchase(null)
                    setNewAttachmentFiles([])
                  }}
                >
                  Cancel
                </Button>
                {newAttachmentFiles.length > 0 && (
                  <Button onClick={uploadNewAttachment}>
                    Upload
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete purchase' : confirmKind === 'cancel' ? 'Cancel purchase' : 'Restore purchase'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.invoiceNumber}?`
            : confirmKind === 'cancel'
              ? `Do you want to cancel ${confirmRow?.invoiceNumber}? Stock will be reversed.`
              : `Do you want to restore ${confirmRow?.invoiceNumber}?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'cancel' ? 'Cancel purchase' : 'Restore'}
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

export default Purchases
