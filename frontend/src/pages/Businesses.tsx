import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/ConfirmDialog'
import { isSuperAdmin } from '@/lib/auth'
import SearchableSelect from '@/components/SearchableSelect'

type ConfirmState = {
  title: string
  description: string
  confirmLabel: string
  variant: 'default' | 'destructive'
  action: 'disable' | 'enable' | 'delete'
  business: Business
}

type Business = {
  _id: string
  tenantId: string
  businessName: string
  ownerName: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
  businessType?: string
  status: 'active' | 'inactive' | 'suspended'
  subscriptionPlan: string
  subscriptionStartsAt?: string | null
  subscriptionEndsAt?: string | null
  createdAt: string
}

const PAGE_SIZE = 20

type FormState = {
  businessName: string
  ownerName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  country: string
  pincode: string
  businessType: string
  subscriptionPlan: string
  subscriptionStartsAt: string
  subscriptionEndsAt: string
}

const emptyForm = (): FormState => ({
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  businessType: '',
  subscriptionPlan: 'basic',
  subscriptionStartsAt: '',
  subscriptionEndsAt: ''
})

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString()
}

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

const Businesses = () => {
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [panel, setPanel] = useState<'edit' | 'subscription' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormState>(emptyForm())
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isSuperAdmin()) {
      navigate('/', { replace: true })
      return
    }
    fetchBusinesses(page)
  }, [navigate, page])

  const fetchBusinesses = async (nextPage = page) => {
    try {
      const res = await axios.get('/api/businesses', {
        ...authHeaders(),
        params: { page: nextPage, limit: PAGE_SIZE }
      })
      const payload = res.data
      if (Array.isArray(payload)) {
        const nextPages = Math.max(1, Math.ceil(payload.length / PAGE_SIZE) || 1)
        setTotal(payload.length)
        setPages(nextPages)
        setBusinesses(payload.slice((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE))
        if (nextPage > nextPages) {
          setPage(nextPages)
        }
      } else {
        const rows = Array.isArray(payload?.items) ? payload.items : []
        const nextTotal = Number(payload?.total) || 0
        const nextPages = Math.max(1, Number(payload?.pages) || 1)
        setBusinesses(rows)
        setTotal(nextTotal)
        setPages(nextPages)
        if (nextPage > nextPages) {
          setPage(nextPages)
        }
      }
    } catch (err: any) {
      setBusinesses([])
      setTotal(0)
      setPages(1)
      setErrorMessage(err.response?.data?.message || 'Unable to load businesses.')
    } finally {
      setLoading(false)
    }
  }

  const openPanel = (mode: 'edit' | 'subscription', business: Business) => {
    setSelectedId(business._id)
    setPanel(mode)
    setErrorMessage('')
    setSuccessMessage('')
    clearFieldErrors()
    setFormData({
      businessName: business.businessName || '',
      ownerName: business.ownerName || '',
      email: business.email || '',
      phone: business.phone || '',
      address: business.address || '',
      city: business.city || '',
      state: business.state || '',
      country: business.country || 'India',
      pincode: business.pincode || '',
      businessType: business.businessType || '',
      subscriptionPlan: business.subscriptionPlan || 'basic',
      subscriptionStartsAt: toDateInput(business.subscriptionStartsAt),
      subscriptionEndsAt: toDateInput(business.subscriptionEndsAt)
    })
  }

  const closePanel = () => {
    setPanel(null)
    setSelectedId(null)
    setFormData(emptyForm())
    clearFieldErrors()
  }

  const requestToggleStatus = (business: Business) => {
    const willDisable = business.status === 'active'
    setConfirmState({
      title: willDisable ? 'Disable account' : 'Enable account',
      description: willDisable
        ? `Do you want to disable ${business.businessName}? Users of this account will not be able to log in.`
        : `Do you want to enable ${business.businessName}?`,
      confirmLabel: willDisable ? 'Disable' : 'Enable',
      variant: willDisable ? 'destructive' : 'default',
      action: willDisable ? 'disable' : 'enable',
      business
    })
  }

  const requestDelete = (business: Business) => {
    setConfirmState({
      title: 'Delete account',
      description: `Do you want to delete ${business.businessName}? This removes the tenant account, its users, and tenant data.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
      action: 'delete',
      business
    })
  }

  const closeConfirm = () => {
    if (confirmBusy) return
    setConfirmState(null)
  }

  const runConfirmedAction = async () => {
    if (!confirmState) return
    const { action, business } = confirmState
    setConfirmBusy(true)
    setErrorMessage('')

    try {
      if (action === 'delete') {
        await axios.delete(`/api/businesses/${business._id}`, authHeaders())
        if (selectedId === business._id) {
          closePanel()
        }
        setSuccessMessage(`${business.businessName} was deleted.`)
      } else {
        const nextStatus = action === 'disable' ? 'inactive' : 'active'
        await axios.patch(`/api/businesses/${business._id}/status`, { status: nextStatus }, authHeaders())
        setSuccessMessage(`${business.businessName} is now ${nextStatus}.`)
      }
      setConfirmState(null)
      fetchBusinesses(page)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setErrorMessage('')
    setSuccessMessage('')
    clearFieldErrors()

    if (panel === 'edit') {
      const errors: Record<string, string> = {}
      if (!formData.businessName.trim()) errors.businessName = requiredMsg('Business name')
      if (!formData.ownerName.trim()) errors.ownerName = requiredMsg('Owner name')
      if (!formData.email.trim()) errors.email = requiredMsg('Email')
      else if (!isValidEmail(formData.email)) errors.email = emailMsg
      if (!formData.phone.trim()) errors.phone = requiredMsg('Phone')
      if (showFieldErrors(errors)) return
    }

    try {
      if (panel === 'subscription') {
        await axios.patch(
          `/api/businesses/${selectedId}/subscription`,
          {
            subscriptionPlan: formData.subscriptionPlan,
            subscriptionStartsAt: formData.subscriptionStartsAt,
            subscriptionEndsAt: formData.subscriptionEndsAt
          },
          authHeaders()
        )
        setSuccessMessage('Subscription period saved.')
      } else {
        await axios.put(`/api/businesses/${selectedId}`, formData, authHeaders())
        setSuccessMessage('Business details saved.')
      }
      closePanel()
      fetchBusinesses(page)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save changes.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Businesses"
        description="Manage tenant accounts, subscription periods, and access."
        actions={
          <Button asChild>
            <Link to="/register">Register Business</Link>
          </Button>
        }
      />

      {successMessage && (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      {panel && (
        <Card>
          <CardHeader>
            <CardTitle>{panel === 'subscription' ? 'Subscription period' : 'Edit business'}</CardTitle>
            <CardDescription>
              {panel === 'subscription'
                ? 'Set the plan and the dates this tenant can access the product.'
                : 'Update account details for this tenant.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="space-y-5">
              {panel === 'edit' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField id="businessName" label="Business name" error={fieldErrors.businessName} required>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      invalid={Boolean(fieldErrors.businessName)}
                      onChange={(e) => {
                        setFormData({ ...formData, businessName: e.target.value })
                        clearFieldError('businessName')
                      }}
                    />
                  </FormField>
                  <FormField id="ownerName" label="Owner name" error={fieldErrors.ownerName} required>
                    <Input
                      id="ownerName"
                      value={formData.ownerName}
                      invalid={Boolean(fieldErrors.ownerName)}
                      onChange={(e) => {
                        setFormData({ ...formData, ownerName: e.target.value })
                        clearFieldError('ownerName')
                      }}
                    />
                  </FormField>
                  <FormField id="email" label="Email" error={fieldErrors.email} required>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      invalid={Boolean(fieldErrors.email)}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value })
                        clearFieldError('email')
                      }}
                    />
                  </FormField>
                  <FormField id="phone" label="Phone" error={fieldErrors.phone} required>
                    <Input
                      id="phone"
                      value={formData.phone}
                      invalid={Boolean(fieldErrors.phone)}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value })
                        clearFieldError('phone')
                      }}
                    />
                  </FormField>
                  <FormField id="address" label="Address" error={fieldErrors.address}>
                    <Input
                      id="address"
                      value={formData.address}
                      invalid={Boolean(fieldErrors.address)}
                      onChange={(e) => {
                        setFormData({ ...formData, address: e.target.value })
                        clearFieldError('address')
                      }}
                    />
                  </FormField>
                  <FormField id="city" label="City" error={fieldErrors.city}>
                    <Input
                      id="city"
                      value={formData.city}
                      invalid={Boolean(fieldErrors.city)}
                      onChange={(e) => {
                        setFormData({ ...formData, city: e.target.value })
                        clearFieldError('city')
                      }}
                    />
                  </FormField>
                  <FormField id="state" label="State" error={fieldErrors.state}>
                    <Input
                      id="state"
                      value={formData.state}
                      invalid={Boolean(fieldErrors.state)}
                      onChange={(e) => {
                        setFormData({ ...formData, state: e.target.value })
                        clearFieldError('state')
                      }}
                    />
                  </FormField>
                  <FormField id="pincode" label="Pincode" error={fieldErrors.pincode}>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      invalid={Boolean(fieldErrors.pincode)}
                      onChange={(e) => {
                        setFormData({ ...formData, pincode: e.target.value })
                        clearFieldError('pincode')
                      }}
                    />
                  </FormField>
                  <FormField id="businessType" label="Business type" error={fieldErrors.businessType}>
                    <Input
                      id="businessType"
                      value={formData.businessType}
                      invalid={Boolean(fieldErrors.businessType)}
                      onChange={(e) => {
                        setFormData({ ...formData, businessType: e.target.value })
                        clearFieldError('businessType')
                      }}
                    />
                  </FormField>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id="subscriptionPlan" label="Plan" error={fieldErrors.subscriptionPlan}>
                  <SearchableSelect
                    id="subscriptionPlan"
                    value={formData.subscriptionPlan}
                    invalid={Boolean(fieldErrors.subscriptionPlan)}
                    onChange={(subscriptionPlan) => {
                      setFormData({ ...formData, subscriptionPlan })
                      clearFieldError('subscriptionPlan')
                    }}
                    options={[
                      { value: 'basic', label: 'Basic' },
                      { value: 'pro', label: 'Pro' },
                      { value: 'enterprise', label: 'Enterprise' }
                    ]}
                  />
                </FormField>
                <FormField id="subscriptionStartsAt" label="Starts" error={fieldErrors.subscriptionStartsAt}>
                  <Input
                    id="subscriptionStartsAt"
                    type="date"
                    value={formData.subscriptionStartsAt}
                    invalid={Boolean(fieldErrors.subscriptionStartsAt)}
                    onChange={(e) => {
                      setFormData({ ...formData, subscriptionStartsAt: e.target.value })
                      clearFieldError('subscriptionStartsAt')
                    }}
                  />
                </FormField>
                <FormField id="subscriptionEndsAt" label="Ends" error={fieldErrors.subscriptionEndsAt}>
                  <Input
                    id="subscriptionEndsAt"
                    type="date"
                    value={formData.subscriptionEndsAt}
                    invalid={Boolean(fieldErrors.subscriptionEndsAt)}
                    onChange={(e) => {
                      setFormData({ ...formData, subscriptionEndsAt: e.target.value })
                      clearFieldError('subscriptionEndsAt')
                    }}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closePanel}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All tenants</CardTitle>
          <CardDescription>
            {total} registered {total === 1 ? 'business' : 'businesses'} · 20 per page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-foreground">
                      No businesses yet. Use Register Business to create the first tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  businesses.map((business) => (
                    <TableRow key={business._id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{business.businessName}</div>
                        <div className="text-xs text-muted-foreground">{business.email}</div>
                        <div className="text-xs text-muted-foreground">Tenant {business.tenantId}</div>
                      </TableCell>
                      <TableCell>
                        <div>{business.ownerName}</div>
                        <div className="text-xs text-muted-foreground">{business.phone}</div>
                      </TableCell>
                      <TableCell className="capitalize">{business.subscriptionPlan}</TableCell>
                      <TableCell>
                        {formatDate(business.subscriptionStartsAt)} – {formatDate(business.subscriptionEndsAt)}
                      </TableCell>
                      <TableCell className="capitalize">{business.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPanel('subscription', business)}>
                            Subscription
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openPanel('edit', business)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => requestToggleStatus(business)}>
                            {business.status === 'active' ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => requestDelete(business)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'No rows'
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-foreground">
                Page {page} of {pages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        busy={confirmBusy}
        onConfirm={runConfirmedAction}
        onCancel={closeConfirm}
      />
    </div>
  )
}

export default Businesses
