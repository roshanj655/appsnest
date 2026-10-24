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
import { printPosReceipt } from '@/lib/print'
import SearchableSelect, { partySelectOption, productSelectOption } from '@/components/SearchableSelect'

interface FormItem {
  productId: string
  variantId: string
  quantity: number
  sellingPrice: number
  maxSellingPrice: number
  actualSoldAmount: number
  price: number
  discount: number
  gst: number
  total: number
  priceOverrideReason: string
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
  const [emailError, setEmailError] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([])
  const [invoiceError, setInvoiceError] = useState('')
  const [formData, setFormData] = useState<{
    customerId: string
    businessUnitId: string
    items: FormItem[]
    paymentMode: string
    paidAmount: number
    status: string
  }>({
    customerId: '',
    businessUnitId: defaultUnitFormValue(),
    items: [],
    paymentMode: 'cash',
    paidAmount: 0,
    status: 'completed'
  })
  const [paymentSale, setPaymentSale] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'cash', reference: '', notes: '' })
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()
  const {
    fieldErrors: paymentFieldErrors,
    clearFieldErrors: clearPaymentFieldErrors,
    clearFieldError: clearPaymentFieldError,
    showFieldErrors: showPaymentFieldErrors
  } = useFieldErrors()
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
      items: [...formData.items, { productId: '', variantId: '', quantity: 1, sellingPrice: 0, maxSellingPrice: 0, actualSoldAmount: 0, price: 0, discount: 0, gst: 0, total: 0, priceOverrideReason: '' }]
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
          newItems[index].maxSellingPrice = variants[0].maxSellingPrice || product.maxSellingPrice || variants[0].sellingPrice
          newItems[index].actualSoldAmount = variants[0].sellingPrice
          newItems[index].price = variants[0].sellingPrice
        } else if (!variants.length) {
          newItems[index].sellingPrice = product.sellingPrice
          newItems[index].maxSellingPrice = product.maxSellingPrice || product.sellingPrice
          newItems[index].actualSoldAmount = product.sellingPrice
          newItems[index].price = product.sellingPrice
        } else {
          newItems[index].sellingPrice = 0
          newItems[index].maxSellingPrice = product.maxSellingPrice || 0
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
        newItems[index].maxSellingPrice = variant.maxSellingPrice || product.maxSellingPrice || variant.sellingPrice
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
    setInvoiceError('')
    clearFieldErrors()
    const errors: Record<string, string> = {}
    if (!formData.paymentMode) errors['sale-payment'] = requiredMsg('Payment mode')
    if (formData.paidAmount < 0) errors['sale-paid'] = 'Amount received cannot be negative.'
    if (!formData.items.length) {
      errors['sale-items'] = 'Add at least one product line to this sale.'
    } else {
      formData.items.forEach((item, index) => {
        if (!item.productId) errors[`sale-item-${index}-product`] = requiredMsg('Product')
        const product = products.find((row: any) => row._id === item.productId)
        const variants = product?.variants || []
        if (item.productId && variants.length && !item.variantId) {
          errors[`sale-item-${index}-variant`] = requiredMsg('Variant')
        }
        if (!item.quantity || item.quantity <= 0) {
          errors[`sale-item-${index}-qty`] = 'Quantity must be greater than zero.'
        }
        if (item.actualSoldAmount < 0) {
          errors[`sale-item-${index}-price`] = 'Actual unit price cannot be negative.'
        }
        if (item.discount < 0) {
          errors[`sale-item-${index}-discount`] = 'Discount cannot be negative.'
        }
        if (
          item.maxSellingPrice > 0 &&
          item.actualSoldAmount > item.maxSellingPrice &&
          !String(item.priceOverrideReason || '').trim()
        ) {
          errors[`sale-item-${index}-override`] = 'Override reason is required when price exceeds max.'
        }
      })
    }
    if (showFieldErrors(errors)) return
    try {
      const token = localStorage.getItem('token')
      const totals = calculateTotals()
      const formDataObj = new FormData()
      
      formDataObj.append('customerId', formData.customerId)
      formDataObj.append('businessUnitId', formData.businessUnitId)
      formDataObj.append('items', JSON.stringify(formData.items))
      formDataObj.append('paymentMode', formData.paymentMode)
      formDataObj.append('paidAmount', String(formData.paidAmount))
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
          paidAmount: formData.paidAmount,
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
      clearFieldErrors()
      setFormData({ customerId: '', businessUnitId: defaultUnitFormValue(), items: [], paymentMode: 'cash', paidAmount: 0, status: 'completed' })
      setSelectedFiles([])
      fetchData()
    } catch (err: any) {
      setInvoiceError(err.response?.data?.message || 'Unable to save sale.')
      console.error(err)
    }
  }

  const openCollectPayment = (sale: any) => {
    setPaymentSale(sale)
    setPaymentError('')
    clearPaymentFieldErrors()
    setPaymentForm({
      amount: Number(sale.outstandingAmount || Math.max(0, Number(sale.total || 0) - Number(sale.amountReceived ?? sale.paidAmount ?? 0))),
      method: sale.paymentMode || 'cash',
      reference: '',
      notes: ''
    })
  }

  const submitPayment = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!paymentSale) return
    setPaymentError('')
    clearPaymentFieldErrors()
    const outstanding = Number(paymentSale.outstandingAmount || 0)
    const errors: Record<string, string> = {}
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      errors['pay-amount'] = 'Payment amount must be greater than zero.'
    } else if (paymentForm.amount > outstanding + 0.009) {
      errors['pay-amount'] = `Amount cannot exceed outstanding ₹${outstanding.toFixed(2)}.`
    }
    if (!paymentForm.method) errors['pay-method'] = requiredMsg('Payment method')
    if (showPaymentFieldErrors(errors)) return
    setPaymentBusy(true)
    try {
      await axios.post(
        `/api/sales/${paymentSale._id}/payments`,
        paymentForm,
        authHeaders()
      )
      setPaymentSale(null)
      clearPaymentFieldErrors()
      fetchData()
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Unable to record payment.')
    } finally {
      setPaymentBusy(false)
    }
  }

  const openEdit = (sale: any) => {
    setEditingId(sale._id)
    setInvoiceError('')
    clearFieldErrors()
    setFormData({
      customerId: sale.customerId?._id || sale.customerId || '',
      businessUnitId: sale.businessUnitId?._id || sale.businessUnitId || defaultUnitFormValue(),
      items: (sale.items || []).map((item: any) => ({
        productId: item.productId?._id || item.productId || '',
        variantId: item.variantId ? String(item.variantId) : '',
        quantity: item.quantity,
        sellingPrice: item.sellingPrice ?? item.price,
        maxSellingPrice: item.maxSellingPrice || item.sellingPrice || item.price || 0,
        actualSoldAmount: item.actualSoldAmount ?? item.price,
        price: item.actualSoldAmount ?? item.price,
        discount: item.discount || 0,
        gst: item.gst || 0,
        total: item.total,
        priceOverrideReason: item.priceOverrideReason || ''
      })),
      paymentMode: sale.paymentMode || 'cash',
      paidAmount: Number(sale.amountReceived ?? sale.paidAmount ?? 0),
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

  const downloadInvoice = async (saleId: string, format = 'a4', invoiceNumber?: string) => {
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
      const headerName = String(response.headers['content-disposition'] || '').match(/filename="?([^"]+)"?/i)?.[1]
      const filename = headerName || `${invoiceNumber || 'invoice'}.pdf`
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
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

  const sendEmail = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedSale) return
    setEmailError('')
    clearEmailFieldErrors()
    const errors: Record<string, string> = {}
    if (!emailTo.trim()) errors['sale-email-to'] = requiredMsg('Recipient email')
    else if (!isValidEmail(emailTo)) errors['sale-email-to'] = emailMsg
    if (showEmailFieldErrors(errors)) return
    setEmailBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`/api/sales/${selectedSale._id}/email`, {
        to: emailTo.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setShowEmailDialog(false)
      setSelectedSale(null)
      setEmailTo('')
      clearEmailFieldErrors()
    } catch (err: any) {
      setEmailError(err.response?.data?.message || 'Failed to send invoice.')
    } finally {
      setEmailBusy(false)
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
              clearFieldErrors()
            } else {
              setEditingId(null)
              setInvoiceError('')
              clearFieldErrors()
              setFormData({ customerId: '', businessUnitId: defaultUnitFormValue(), items: [], paymentMode: 'cash', paidAmount: 0, status: 'completed' })
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField id="sale-customer" label="Customer" error={fieldErrors['sale-customer']}>
                  <SearchableSelect
                    id="sale-customer"
                    value={formData.customerId}
                    onChange={(customerId) => {
                      clearFieldError('sale-customer')
                      setFormData({ ...formData, customerId })
                    }}
                    placeholder="Select customer"
                    searchPlaceholder="Search name, phone, or address…"
                    emptyLabel="Walk-in / no customer"
                    options={customers.map(partySelectOption)}
                    invalid={Boolean(fieldErrors['sale-customer'])}
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
                <FormField id="sale-payment" label="Payment Mode" error={fieldErrors['sale-payment']} required>
                  <SearchableSelect
                    id="sale-payment"
                    value={formData.paymentMode}
                    onChange={(paymentMode) => {
                      clearFieldError('sale-payment')
                      setFormData({ ...formData, paymentMode })
                    }}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'card', label: 'Card' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'bank', label: 'Bank Transfer' },
                      { value: 'credit', label: 'Credit' }
                    ]}
                    invalid={Boolean(fieldErrors['sale-payment'])}
                  />
                </FormField>
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
                        maxSellingPrice: (variant?.maxSellingPrice || product.maxSellingPrice || (variant ? variant.sellingPrice : product.sellingPrice)) as number,
                        actualSoldAmount: variant ? variant.sellingPrice : product.sellingPrice,
                        price: variant ? variant.sellingPrice : product.sellingPrice,
                        discount: 0,
                        gst: product.gst || 0,
                        total: 0,
                        priceOverrideReason: ''
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

              <div className="space-y-2" data-field="sale-items">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold">Items{formData.items.length === 0 ? <span className="text-red-600"> *</span> : null}</Label>
                  <Button type="button" variant="secondary" onClick={() => { clearFieldError('sale-items'); addItem() }}>
                    + Add Item
                  </Button>
                </div>
                <FieldError id="sale-items" error={fieldErrors['sale-items']} />
                {formData.items.length === 0 && !fieldErrors['sale-items'] && (
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
                    <FormField
                      id={`sale-item-${index}-product`}
                      label="Product"
                      error={fieldErrors[`sale-item-${index}-product`]}
                      required
                      className="col-span-2 md:col-span-1"
                    >
                      <SearchableSelect
                        id={`sale-item-${index}-product`}
                        value={item.productId}
                        onChange={(productId) => {
                          clearFieldError(`sale-item-${index}-product`)
                          clearFieldError(`sale-item-${index}-variant`)
                          updateItem(index, 'productId', productId)
                        }}
                        placeholder="Select product"
                        searchPlaceholder="Search name, SKU, or barcode…"
                        options={products.map(productSelectOption)}
                        invalid={Boolean(fieldErrors[`sale-item-${index}-product`])}
                      />
                    </FormField>
                    {(() => {
                      const product = products.find((row: any) => row._id === item.productId)
                      const variants = product?.variants || []
                      if (!variants.length) return null
                      return (
                        <FormField
                          id={`sale-item-${index}-variant`}
                          label="Variant"
                          error={fieldErrors[`sale-item-${index}-variant`]}
                          required
                          className="col-span-2 md:col-span-1"
                        >
                          <SearchableSelect
                            id={`sale-item-${index}-variant`}
                            value={item.variantId}
                            onChange={(variantId) => {
                              clearFieldError(`sale-item-${index}-variant`)
                              updateItem(index, 'variantId', variantId)
                            }}
                            placeholder="Select variant"
                            options={variants.map((variant: any) => ({
                              value: String(variant._id),
                              label: variant.name,
                              description: `Stock ${variant.stock}${variant.sku ? ` · ${variant.sku}` : ''}`,
                              searchText: `${variant.name} ${variant.sku || ''} ${variant.barcode || ''}`
                            }))}
                            invalid={Boolean(fieldErrors[`sale-item-${index}-variant`])}
                          />
                        </FormField>
                      )
                    })()}
                    <FormField id={`sale-item-${index}-qty`} label="Quantity" error={fieldErrors[`sale-item-${index}-qty`]} required>
                      <Input
                        id={`sale-item-${index}-qty`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          clearFieldError(`sale-item-${index}-qty`)
                          updateItem(index, 'quantity', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`sale-item-${index}-qty`])}
                      />
                    </FormField>
                    <FormField id={`sale-item-${index}-list`} label="Default Price">
                      <Input id={`sale-item-${index}-list`} type="number" value={item.sellingPrice} readOnly />
                    </FormField>
                    <FormField id={`sale-item-${index}-max`} label="Max Price">
                      <Input id={`sale-item-${index}-max`} type="number" value={item.maxSellingPrice || 0} readOnly />
                    </FormField>
                    <FormField id={`sale-item-${index}-price`} label="Actual Unit Price" error={fieldErrors[`sale-item-${index}-price`]}>
                      <Input
                        id={`sale-item-${index}-price`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.actualSoldAmount}
                        onChange={(e) => {
                          clearFieldError(`sale-item-${index}-price`)
                          clearFieldError(`sale-item-${index}-override`)
                          updateItem(index, 'actualSoldAmount', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`sale-item-${index}-price`])}
                      />
                    </FormField>
                    {item.maxSellingPrice > 0 && item.actualSoldAmount > item.maxSellingPrice && (
                      <FormField
                        id={`sale-item-${index}-override`}
                        label="Override reason"
                        error={fieldErrors[`sale-item-${index}-override`]}
                        required
                        className="col-span-2 md:col-span-1"
                      >
                        <Input
                          id={`sale-item-${index}-override`}
                          placeholder="Override reason required"
                          value={item.priceOverrideReason}
                          onChange={(e) => {
                            clearFieldError(`sale-item-${index}-override`)
                            updateItem(index, 'priceOverrideReason', e.target.value)
                          }}
                          invalid={Boolean(fieldErrors[`sale-item-${index}-override`])}
                        />
                      </FormField>
                    )}
                    <FormField id={`sale-item-${index}-discount`} label="Discount" error={fieldErrors[`sale-item-${index}-discount`]}>
                      <Input
                        id={`sale-item-${index}-discount`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => {
                          clearFieldError(`sale-item-${index}-discount`)
                          updateItem(index, 'discount', e.target.value === '' ? 0 : Number(e.target.value))
                        }}
                        invalid={Boolean(fieldErrors[`sale-item-${index}-discount`])}
                      />
                    </FormField>
                    <FormField id={`sale-item-${index}-gst`} label="GST %">
                      <Input
                        id={`sale-item-${index}-gst`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.gst}
                        onChange={(e) => updateItem(index, 'gst', e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormField>
                    <FormField id={`sale-item-${index}-total`} label="Line Total">
                      <Input id={`sale-item-${index}-total`} type="number" value={item.total} readOnly className="bg-gray-100" />
                    </FormField>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  id="sale-paid"
                  label="Amount received now"
                  error={fieldErrors['sale-paid']}
                  hint="Leave below invoice total for partial/credit. Gross profit uses actual prices, not cash received."
                >
                  <Input
                    id="sale-paid"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={(e) => {
                      clearFieldError('sale-paid')
                      setFormData({ ...formData, paidAmount: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['sale-paid'])}
                  />
                </FormField>
                <div className="w-full space-y-1 md:justify-self-end md:w-64">
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
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>Outstanding after save:</span>
                    <span>₹{Math.max(0, totals.total - Number(formData.paidAmount || 0)).toFixed(2)}</span>
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
                  <TableHead>Received</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Pay status</TableHead>
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
                    <TableCell>₹{Number(sale.total || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(sale.amountReceived ?? sale.paidAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(sale.outstandingAmount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : sale.paymentStatus === 'partially_paid'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {(sale.paymentStatus || 'unpaid').replace('_', ' ')}
                      </span>
                    </TableCell>
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
                        {Number(sale.outstandingAmount || 0) > 0 && sale.status !== 'cancelled' && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => openCollectPayment(sale)}
                            className="text-xs p-0 h-auto text-emerald-700"
                          >
                            Collect payment
                          </Button>
                        )}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => downloadInvoice(sale._id, 'a4', sale.invoiceNumber)}
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
                            setEmailError('')
                            clearEmailFieldErrors()
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
            <CardContent>
              {emailError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{emailError}</div>
              )}
              <form onSubmit={sendEmail} noValidate className="space-y-4">
                <FormField id="sale-email-to" label="To" error={emailFieldErrors['sale-email-to']} required>
                  <Input
                    id="sale-email-to"
                    type="email"
                    value={emailTo}
                    onChange={(e) => {
                      clearEmailFieldError('sale-email-to')
                      setEmailTo(e.target.value)
                    }}
                    placeholder="email@example.com"
                    invalid={Boolean(emailFieldErrors['sale-email-to'])}
                  />
                </FormField>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowEmailDialog(false)
                      setSelectedSale(null)
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

      {paymentSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Collect payment · {paymentSale.invoiceNumber}</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentError && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</div>
              )}
              <p className="mb-3 text-sm text-muted-foreground">
                Outstanding ₹{Number(paymentSale.outstandingAmount || 0).toFixed(2)}. This does not create new sales revenue.
              </p>
              <form onSubmit={submitPayment} noValidate className="space-y-3">
                <FormField id="pay-amount" label="Amount" error={paymentFieldErrors['pay-amount']} required>
                  <Input
                    id="pay-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => {
                      clearPaymentFieldError('pay-amount')
                      setPaymentForm({ ...paymentForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(paymentFieldErrors['pay-amount'])}
                  />
                </FormField>
                <FormField id="pay-method" label="Method" error={paymentFieldErrors['pay-method']} required>
                  <SearchableSelect
                    id="pay-method"
                    value={paymentForm.method}
                    onChange={(method) => {
                      clearPaymentFieldError('pay-method')
                      setPaymentForm({ ...paymentForm, method })
                    }}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'card', label: 'Card' },
                      { value: 'bank', label: 'Bank Transfer' },
                      { value: 'credit', label: 'Credit' },
                      { value: 'other', label: 'Other' }
                    ]}
                    invalid={Boolean(paymentFieldErrors['pay-method'])}
                  />
                </FormField>
                <FormField id="pay-reference" label="Reference" error={paymentFieldErrors['pay-reference']}>
                  <Input
                    id="pay-reference"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="UPI ref / cheque no."
                  />
                </FormField>
                <FormField id="pay-notes" label="Notes" error={paymentFieldErrors['pay-notes']}>
                  <Input
                    id="pay-notes"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPaymentSale(null)
                      clearPaymentFieldErrors()
                    }}
                    disabled={paymentBusy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={paymentBusy}>
                    {paymentBusy ? 'Saving…' : 'Record payment'}
                  </Button>
                </div>
              </form>
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
