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
import { authHeaders, listItems, listParams } from '@/lib/api'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import { printPosReceipt } from '@/lib/print'

interface FormItem {
  productId: string
  variantId: string
  quantity: number
  sellingPrice: number
  actualSoldAmount: number
  price: number
  discount: number
  gst: number
  total: number
}

const Sales = () => {
  const [sales, setSales] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmKind, setConfirmKind] = useState<'cancel' | 'enable' | 'delete' | null>(null)
  const [confirmRow, setConfirmRow] = useState<any>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [emailTo, setEmailTo] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([])
  const [invoiceError, setInvoiceError] = useState('')
  const [formData, setFormData] = useState<{
    customerId: string
    businessUnitId: string
    items: FormItem[]
    paymentMode: string
    status: string
  }>({
    customerId: '',
    businessUnitId: defaultUnitFormValue(),
    items: [],
    paymentMode: 'cash',
    status: 'completed'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [salesRes, productsRes, customersRes] = await Promise.all([
        axios.get('/api/sales', { headers: { Authorization: `Bearer ${token}` }, ...listParams }),
        axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` }, ...listParams }),
        axios.get('/api/customers', { headers: { Authorization: `Bearer ${token}` }, ...listParams })
      ])
      setSales(listItems(salesRes.data))
      setProducts(listItems(productsRes.data))
      setCustomers(listItems(customersRes.data))
    } catch (err) {
      console.error(err)
    }
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', variantId: '', quantity: 1, sellingPrice: 0, actualSoldAmount: 0, price: 0, discount: 0, gst: 0, total: 0 }]
    })
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, itemIndex) => itemIndex !== index)
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
          newItems[index].sellingPrice = variants[0].sellingPrice
          newItems[index].actualSoldAmount = variants[0].sellingPrice
          newItems[index].price = variants[0].sellingPrice
        } else if (!variants.length) {
          newItems[index].sellingPrice = product.sellingPrice
          newItems[index].actualSoldAmount = product.sellingPrice
          newItems[index].price = product.sellingPrice
        } else {
          newItems[index].sellingPrice = 0
          newItems[index].actualSoldAmount = 0
          newItems[index].price = 0
        }
        newItems[index].gst = product.gst || 0
        newItems[index].total = (newItems[index].price * newItems[index].quantity) - newItems[index].discount + (newItems[index].price * newItems[index].quantity * (newItems[index].gst || 0) / 100)
      }
    } else if (field === 'variantId') {
      const product = products.find((p: any) => p._id === newItems[index].productId)
      const variant = (product?.variants || []).find((row: any) => String(row._id) === String(value))
      if (variant) {
        newItems[index].sellingPrice = variant.sellingPrice
        newItems[index].actualSoldAmount = variant.sellingPrice
        newItems[index].price = variant.sellingPrice
        newItems[index].gst = product.gst || 0
        newItems[index].total = (variant.sellingPrice * newItems[index].quantity) - newItems[index].discount + (variant.sellingPrice * newItems[index].quantity * (product.gst || 0) / 100)
      }
    } else if (field === 'actualSoldAmount') {
      const item = newItems[index]
      item.actualSoldAmount = Number(value)
      item.price = item.actualSoldAmount
      item.total = (item.price * item.quantity) - item.discount + (item.price * item.quantity * item.gst / 100)
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
    try {
      const token = localStorage.getItem('token')
      const totals = calculateTotals()
      const formDataObj = new FormData()
      
      formDataObj.append('customerId', formData.customerId)
      formDataObj.append('businessUnitId', formData.businessUnitId)
      formDataObj.append('items', JSON.stringify(formData.items))
      formDataObj.append('paymentMode', formData.paymentMode)
      formDataObj.append('status', formData.status)
      formDataObj.append('subtotal', totals.subtotal.toString())
      formDataObj.append('discount', totals.totalDiscount.toString())
      formDataObj.append('gst', totals.totalGst.toString())
      formDataObj.append('total', totals.total.toString())
      
      selectedFiles.forEach(file => {
        formDataObj.append('attachments', file)
      })
      
      if (editingId) {
        await axios.put(`/api/sales/${editingId}`, {
          customerId: formData.customerId,
          items: formData.items,
          paymentMode: formData.paymentMode,
          status: formData.status,
          subtotal: totals.subtotal,
          discount: totals.totalDiscount,
          gst: totals.totalGst,
          total: totals.total
        }, { headers: { Authorization: `Bearer ${token}` } })
      } else {
        await axios.post('/api/sales', formDataObj, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({ customerId: '', businessUnitId: defaultUnitFormValue(), items: [], paymentMode: 'cash', status: 'completed' })
      setSelectedFiles([])
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const openEdit = (sale: any) => {
    setEditingId(sale._id)
    setFormData({
      customerId: sale.customerId?._id || sale.customerId || '',
      businessUnitId: sale.businessUnitId?._id || sale.businessUnitId || defaultUnitFormValue(),
      items: (sale.items || []).map((item: any) => ({
        productId: item.productId?._id || item.productId || '',
        variantId: item.variantId ? String(item.variantId) : '',
        quantity: item.quantity,
        sellingPrice: item.sellingPrice ?? item.price,
        actualSoldAmount: item.actualSoldAmount ?? item.price,
        price: item.actualSoldAmount ?? item.price,
        discount: item.discount || 0,
        gst: item.gst || 0,
        total: item.total
      })),
      paymentMode: sale.paymentMode || 'cash',
      status: sale.status || 'completed'
    })
    setShowForm(true)
  }

  const runConfirm = async () => {
    if (!confirmKind || !confirmRow) return
    setConfirmBusy(true)
    try {
      if (confirmKind === 'delete') {
        await axios.delete(`/api/sales/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/sales/${confirmRow._id}`,
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

  const downloadInvoice = async (saleId: string, format = 'a4') => {
    setInvoiceError('')
    try {
      const response = await axios.get(`/api/sales/${saleId}/invoice`, {
        ...authHeaders(),
        params: format === 'a4' ? {} : { format },
        responseType: 'blob'
      })
      const contentType = String(response.headers['content-type'] || '')
      if (!contentType.includes('pdf')) {
        const text = await (response.data as Blob).text()
        throw new Error(text || 'Invoice could not be generated.')
      }
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${saleId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error downloading invoice:', err)
      let message = 'Unable to download A4 invoice.'
      const blob = err.response?.data
      if (blob instanceof Blob) {
        const text = await blob.text()
        try {
          const parsed = JSON.parse(text)
          message = parsed.message || message
        } catch {
          message = text || message
        }
      } else if (err.message) {
        message = err.message
      }
      setInvoiceError(message)
    }
  }

  const downloadAttachment = async (saleId: string, attachmentId: string, filename: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`/api/sales/${saleId}/attachments/${attachmentId}/download`, {
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

  const sendEmail = async () => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`/api/sales/${selectedSale._id}/email`, {
        to: emailTo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert('Invoice sent successfully!')
      setShowEmailDialog(false)
      setSelectedSale(null)
      setEmailTo('')
    } catch (err) {
      console.error('Error sending email:', err)
      alert('Failed to send invoice')
    }
  }

  const uploadNewAttachment = async () => {
    if (!selectedSale || newAttachmentFiles.length === 0) return
    try {
      const token = localStorage.getItem('token')
      const formDataObj = new FormData()
      newAttachmentFiles.forEach(file => {
        formDataObj.append('attachments', file)
      })
      await axios.post(`/api/sales/${selectedSale._id}/attachments`, formDataObj, {
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
        title="Sales"
        description="Manage sales, invoices, and customer transactions"
        actions={
          <Button type="button" onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingId(null)
            } else {
              setEditingId(null)
              setFormData({ customerId: '', businessUnitId: defaultUnitFormValue(), items: [], paymentMode: 'cash', status: 'completed' })
              setShowForm(true)
            }
          }}>
            {showForm ? 'Cancel' : 'New Sale'}
          </Button>
        }
      />

      {invoiceError && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{invoiceError}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Edit Sale' : 'Create New Sale'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="customer" className="text-xs font-semibold">Customer</Label>
                  <select
                    id="customer"
                    className="app-input w-full h-10 px-3 border rounded-xl"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((customer: any) => (
                      <option key={customer._id} value={customer._id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => setFormData({ ...formData, businessUnitId })}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="payment" className="text-xs font-semibold">Payment Mode</Label>
                  <select
                    id="payment"
                    className="app-input w-full h-10 px-3 border rounded-xl"
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sale-barcode" className="text-xs font-semibold">Barcode / SKU search</Label>
                <Input
                  id="sale-barcode"
                  placeholder="Scan or type barcode or SKU, then press Enter"
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const code = (e.target as HTMLInputElement).value.trim()
                    if (!code) return
                    try {
                      const res = await axios.get('/api/products/lookup', { ...authHeaders(), params: { code } })
                      const product = res.data
                      const variant = product.matchedVariant
                      if ((product.variants || []).length && !variant) {
                        return
                      }
                      const line = {
                        productId: product._id,
                        variantId: variant?._id ? String(variant._id) : '',
                        quantity: 1,
                        sellingPrice: variant ? variant.sellingPrice : product.sellingPrice,
                        actualSoldAmount: variant ? variant.sellingPrice : product.sellingPrice,
                        price: variant ? variant.sellingPrice : product.sellingPrice,
                        discount: 0,
                        gst: product.gst || 0,
                        total: 0
                      }
                      line.total = (line.price * line.quantity) + (line.price * line.quantity * line.gst / 100)
                      const emptyIndex = formData.items.findIndex((item) => !item.productId)
                      if (emptyIndex >= 0) {
                        const next = [...formData.items]
                        next[emptyIndex] = line
                        setFormData({ ...formData, items: next })
                      } else {
                        setFormData({ ...formData, items: [...formData.items, line] })
                      }
                      ;(e.target as HTMLInputElement).value = ''
                    } catch {
                      return
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">Items</Label>
                  <Button type="button" variant="secondary" onClick={addItem}>
                    + Add Item
                  </Button>
                </div>
                {formData.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add at least one product line to this sale.</p>
                )}
                {formData.items.map((item: any, index: number) => (
                  <div key={index} className="relative grid grid-cols-2 gap-3 rounded-xl border p-3 pt-10 md:grid-cols-8">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-2 h-8 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeItem(index)}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      Close
                    </Button>
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                      <Label htmlFor={`sale-product-${index}`} className="text-xs font-semibold">Product</Label>
                      <select
                        id={`sale-product-${index}`}
                        className="app-input h-10 w-full px-3 border rounded-xl"
                        value={item.productId}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map((product: any) => (
                          <option key={product._id} value={product._id}>{product.name} - ₹{product.sellingPrice}</option>
                        ))}
                      </select>
                    </div>
                    {(() => {
                      const product = products.find((row: any) => row._id === item.productId)
                      const variants = product?.variants || []
                      if (!variants.length) return null
                      return (
                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                          <Label htmlFor={`sale-variant-${index}`} className="text-xs font-semibold">Variant</Label>
                          <select
                            id={`sale-variant-${index}`}
                            className="app-input h-10 w-full px-3 border rounded-xl"
                            value={item.variantId}
                            onChange={(e) => updateItem(index, 'variantId', e.target.value)}
                            required
                          >
                            <option value="">Select variant</option>
                            {variants.map((variant: any) => (
                              <option key={variant._id} value={variant._id}>
                                {variant.name} · stk {variant.stock}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-qty-${index}`} className="text-xs font-semibold">Quantity</Label>
                      <Input
                        id={`sale-qty-${index}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-list-${index}`} className="text-xs font-semibold">Selling Price</Label>
                      <Input id={`sale-list-${index}`} type="number" value={item.sellingPrice} readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-actual-${index}`} className="text-xs font-semibold">Actual Sold Amount</Label>
                      <Input
                        id={`sale-actual-${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.actualSoldAmount}
                        onChange={(e) => updateItem(index, 'actualSoldAmount', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-discount-${index}`} className="text-xs font-semibold">Discount</Label>
                      <Input
                        id={`sale-discount-${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-gst-${index}`} className="text-xs font-semibold">GST %</Label>
                      <Input
                        id={`sale-gst-${index}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.gst}
                        onChange={(e) => updateItem(index, 'gst', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`sale-total-${index}`} className="text-xs font-semibold">Line Total</Label>
                      <Input id={`sale-total-${index}`} type="number" value={item.total} readOnly className="bg-gray-100" />
                    </div>
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

              <div className="space-y-1.5">
                <Label htmlFor="attachments" className="text-xs font-semibold">Attach Files</Label>
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
                  Save Sale
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale: any) => (
                  <TableRow key={sale._id}>
                    <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                    <TableCell>{sale.customerId?.name || 'Walk-in'}</TableCell>
                    <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>₹{sale.total.toFixed(2)}</TableCell>
                    <TableCell>{sale.paymentMode}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {sale.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {sale.attachments && sale.attachments.length > 0 ? (
                        <div>
                          <span className="text-sm text-gray-600">{sale.attachments.length} file(s)</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sale.attachments.map((attachment: any) => (
                              <Button
                                key={attachment._id}
                                variant="link"
                                size="sm"
                                onClick={() => downloadAttachment(sale._id, attachment._id, attachment.filename)}
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
                          onClick={() => downloadInvoice(sale._id)}
                          className="text-xs p-0 h-auto"
                        >
                          Invoice (A4)
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => printPosReceipt(sale._id, { reprint: true })}
                          className="text-xs p-0 h-auto text-purple-600"
                        >
                          Reprint POS
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSelectedSale(sale)
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
                            setSelectedSale(sale)
                            setEmailTo(sale.customerId?.email || '')
                            setShowEmailDialog(true)
                          }}
                          className="text-xs p-0 h-auto text-emerald-600"
                        >
                          Send Email
                        </Button>
                        <RecordActions
                          isActive={sale.status !== 'cancelled'}
                          disableLabel="Cancel"
                          enableLabel="Restore"
                          onEdit={() => openEdit(sale)}
                          onToggle={() => {
                            setConfirmRow(sale)
                            setConfirmKind(sale.status === 'cancelled' ? 'enable' : 'cancel')
                          }}
                          onDelete={() => {
                            setConfirmRow(sale)
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
              <CardTitle className="text-lg">Send Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="emailTo">To:</Label>
                <Input
                  id="emailTo"
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEmailDialog(false)
                    setSelectedSale(null)
                    setEmailTo('')
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={sendEmail}>
                  Send
                </Button>
              </div>
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
              {selectedSale?.attachments && selectedSale.attachments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Current Attachments:</h4>
                  <ul className="space-y-1">
                    {selectedSale.attachments.map((attachment: any) => (
                      <li key={attachment._id} className="flex justify-between items-center text-sm">
                        <span>{attachment.filename}</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => downloadAttachment(selectedSale._id, attachment._id, attachment.filename)}
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
                    setSelectedSale(null)
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
        title={confirmKind === 'delete' ? 'Delete sale' : confirmKind === 'cancel' ? 'Cancel sale' : 'Restore sale'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.invoiceNumber}?`
            : confirmKind === 'cancel'
              ? `Do you want to cancel ${confirmRow?.invoiceNumber}? Stock will be restored.`
              : `Do you want to restore ${confirmRow?.invoiceNumber}?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'cancel' ? 'Cancel sale' : 'Restore'}
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

export default Sales
