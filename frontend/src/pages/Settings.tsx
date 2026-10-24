import { useState, useEffect } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import SearchableSelect from '@/components/SearchableSelect'

const Settings = () => {
  const [settings, setSettings] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [passwordMessage, setPasswordMessage] = useState('')
  const {
    fieldErrors,
    clearFieldErrors,
    clearFieldError,
    showFieldErrors
  } = useFieldErrors()
  const {
    fieldErrors: passwordErrors,
    clearFieldErrors: clearPasswordErrors,
    clearFieldError: clearPasswordError,
    showFieldErrors: showPasswordErrors
  } = useFieldErrors()

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await axios.get('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setSettings(res.data)
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    clearFieldError(name)
    setSettings((prev) => ({
      ...(prev || {}),
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    clearFieldErrors()
    setSaving(true)
    setSuccess(false)

    const errors: Record<string, string> = {}
    if (!settings?.businessName?.trim()) errors.businessName = requiredMsg('Business name')
    if (!settings?.email?.trim()) errors.email = requiredMsg('Email')
    else if (!isValidEmail(settings.email)) errors.email = emailMsg
    if (!settings?.phone?.trim()) errors.phone = requiredMsg('Phone')

    if (showFieldErrors(errors)) {
      setSaving(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      await axios.put('/api/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setErrorMessage(error.response?.data?.message || 'Unable to save settings right now.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Configure business identity, invoice defaults, and core billing preferences."
      />

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Settings saved successfully.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form noValidate onSubmit={handleSubmit} className="space-y-8">
            <div>
              <div className="mb-6">
                <CardTitle>Business Information</CardTitle>
                <CardDescription className="mt-1">These details appear across invoices, reports, and system identity.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField id="businessName" label="Business Name" error={fieldErrors.businessName} required>
                  <Input
                    id="businessName"
                    type="text"
                    name="businessName"
                    value={settings?.businessName || ''}
                    invalid={Boolean(fieldErrors.businessName)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="email" label="Email" error={fieldErrors.email} required>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    value={settings?.email || ''}
                    invalid={Boolean(fieldErrors.email)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="phone" label="Phone" error={fieldErrors.phone} required>
                  <Input
                    id="phone"
                    type="text"
                    name="phone"
                    value={settings?.phone || ''}
                    invalid={Boolean(fieldErrors.phone)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="gstin" label="GSTIN" error={fieldErrors.gstin}>
                  <Input id="gstin" type="text" name="gstin" value={settings?.gstin || ''} invalid={Boolean(fieldErrors.gstin)} onChange={handleChange} />
                </FormField>
                <FormField id="pan" label="PAN" error={fieldErrors.pan}>
                  <Input id="pan" type="text" name="pan" value={settings?.pan || ''} invalid={Boolean(fieldErrors.pan)} onChange={handleChange} />
                </FormField>
                <FormField id="address" label="Address" error={fieldErrors.address} className="md:col-span-2">
                  <Input id="address" type="text" name="address" value={settings?.address || ''} invalid={Boolean(fieldErrors.address)} onChange={handleChange} />
                </FormField>
                <FormField id="city" label="City" error={fieldErrors.city}>
                  <Input id="city" type="text" name="city" value={settings?.city || ''} invalid={Boolean(fieldErrors.city)} onChange={handleChange} />
                </FormField>
                <FormField id="state" label="State" error={fieldErrors.state}>
                  <Input id="state" type="text" name="state" value={settings?.state || ''} invalid={Boolean(fieldErrors.state)} onChange={handleChange} />
                </FormField>
                <FormField id="pincode" label="Pincode" error={fieldErrors.pincode}>
                  <Input id="pincode" type="text" name="pincode" value={settings?.pincode || ''} invalid={Boolean(fieldErrors.pincode)} onChange={handleChange} />
                </FormField>
                <FormField id="country" label="Country" error={fieldErrors.country}>
                  <Input id="country" type="text" name="country" value={settings?.country || 'India'} invalid={Boolean(fieldErrors.country)} onChange={handleChange} />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <div className="mb-6">
                <CardTitle>Invoice and Printing</CardTitle>
                <CardDescription className="mt-1">Control numbering, receipt width, currency, and footer content.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField
                  id="invoicePrefix"
                  label="Sales Invoice Prefix"
                  error={fieldErrors.invoicePrefix}
                  hint="New sales use PREFIX/FY/000001, for example INV/25-26/000001. The PDF file is INV_25-26_000001.pdf."
                >
                  <Input
                    id="invoicePrefix"
                    type="text"
                    name="invoicePrefix"
                    value={settings?.invoicePrefix || 'INV'}
                    invalid={Boolean(fieldErrors.invoicePrefix)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="invoiceDueDays" label="Invoice due days" error={fieldErrors.invoiceDueDays}>
                  <Input
                    id="invoiceDueDays"
                    type="number"
                    min={0}
                    name="invoiceDueDays"
                    value={settings?.invoiceDueDays ?? 15}
                    invalid={Boolean(fieldErrors.invoiceDueDays)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="purchaseInvoicePrefix" label="Purchase Invoice Prefix" error={fieldErrors.purchaseInvoicePrefix}>
                  <Input
                    id="purchaseInvoicePrefix"
                    type="text"
                    name="purchaseInvoicePrefix"
                    value={settings?.purchaseInvoicePrefix || 'PUR'}
                    invalid={Boolean(fieldErrors.purchaseInvoicePrefix)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="thermalPrinterWidth" label="Thermal Printer Width (mm)" error={fieldErrors.thermalPrinterWidth}>
                  <SearchableSelect
                    id="thermalPrinterWidth"
                    name="thermalPrinterWidth"
                    value={String(settings?.thermalPrinterWidth || 58)}
                    invalid={Boolean(fieldErrors.thermalPrinterWidth)}
                    onChange={(value) => {
                      clearFieldError('thermalPrinterWidth')
                      setSettings((prev) => ({ ...(prev || {}), thermalPrinterWidth: Number(value) }))
                    }}
                    options={[
                      { value: '58', label: '58 mm' },
                      { value: '80', label: '80 mm' }
                    ]}
                  />
                </FormField>
                <FormField id="currency" label="Currency" error={fieldErrors.currency}>
                  <SearchableSelect
                    id="currency"
                    name="currency"
                    value={settings?.currency || 'INR'}
                    invalid={Boolean(fieldErrors.currency)}
                    onChange={(value) => {
                      clearFieldError('currency')
                      setSettings((prev) => ({ ...(prev || {}), currency: value }))
                    }}
                    options={[
                      { value: 'INR', label: 'INR (₹)' },
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'EUR', label: 'EUR (€)' },
                      { value: 'GBP', label: 'GBP (£)' }
                    ]}
                  />
                </FormField>
                <FormField id="footerText" label="Footer Text" error={fieldErrors.footerText} className="md:col-span-2">
                  <Input
                    id="footerText"
                    type="text"
                    name="footerText"
                    value={settings?.footerText || ''}
                    invalid={Boolean(fieldErrors.footerText)}
                    onChange={handleChange}
                    placeholder="Thank you for your business!"
                  />
                </FormField>
                <label htmlFor="taxEnabled" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    id="taxEnabled"
                    name="taxEnabled"
                    checked={settings?.taxEnabled ?? true}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Enable tax calculation
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <div className="mb-6">
                <CardTitle>Bank details (invoice)</CardTitle>
                <CardDescription className="mt-1">Printed on the sales tax invoice, same layout as billed invoices.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField id="bankName" label="Bank name" error={fieldErrors.bankName}>
                  <Input id="bankName" name="bankName" value={settings?.bankName || ''} invalid={Boolean(fieldErrors.bankName)} onChange={handleChange} />
                </FormField>
                <FormField id="bankBranch" label="Branch" error={fieldErrors.bankBranch}>
                  <Input id="bankBranch" name="bankBranch" value={settings?.bankBranch || ''} invalid={Boolean(fieldErrors.bankBranch)} onChange={handleChange} />
                </FormField>
                <FormField id="bankAccountName" label="Account name" error={fieldErrors.bankAccountName}>
                  <Input id="bankAccountName" name="bankAccountName" value={settings?.bankAccountName || ''} invalid={Boolean(fieldErrors.bankAccountName)} onChange={handleChange} />
                </FormField>
                <FormField id="bankAccountNumber" label="Account number" error={fieldErrors.bankAccountNumber}>
                  <Input id="bankAccountNumber" name="bankAccountNumber" value={settings?.bankAccountNumber || ''} invalid={Boolean(fieldErrors.bankAccountNumber)} onChange={handleChange} />
                </FormField>
                <FormField id="bankIfsc" label="IFSC" error={fieldErrors.bankIfsc}>
                  <Input id="bankIfsc" name="bankIfsc" value={settings?.bankIfsc || ''} invalid={Boolean(fieldErrors.bankIfsc)} onChange={handleChange} />
                </FormField>
                <FormField id="bankSwift" label="Swift code" error={fieldErrors.bankSwift}>
                  <Input id="bankSwift" name="bankSwift" value={settings?.bankSwift || ''} invalid={Boolean(fieldErrors.bankSwift)} onChange={handleChange} />
                </FormField>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <div className="mb-6">
                <CardTitle>Email (send invoice)</CardTitle>
                <CardDescription className="mt-1">
                  Gmail needs an App Password, not your normal password. Turn on 2-Step Verification, then create an app password and paste it here.
                </CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <FormField id="smtpHost" label="SMTP host" error={fieldErrors.smtpHost}>
                  <Input
                    id="smtpHost"
                    name="smtpHost"
                    value={settings?.smtpHost || ''}
                    invalid={Boolean(fieldErrors.smtpHost)}
                    onChange={handleChange}
                    placeholder="smtp.gmail.com"
                  />
                </FormField>
                <FormField id="smtpPort" label="SMTP port" error={fieldErrors.smtpPort}>
                  <Input
                    id="smtpPort"
                    type="number"
                    name="smtpPort"
                    value={settings?.smtpPort || 587}
                    invalid={Boolean(fieldErrors.smtpPort)}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField id="smtpUser" label="SMTP user (Gmail address)" error={fieldErrors.smtpUser}>
                  <Input
                    id="smtpUser"
                    name="smtpUser"
                    value={settings?.smtpUser || ''}
                    invalid={Boolean(fieldErrors.smtpUser)}
                    onChange={handleChange}
                    placeholder="you@gmail.com"
                  />
                </FormField>
                <FormField id="smtpPass" label="SMTP app password" error={fieldErrors.smtpPass}>
                  <Input
                    id="smtpPass"
                    type="password"
                    name="smtpPass"
                    value={settings?.smtpPass || ''}
                    invalid={Boolean(fieldErrors.smtpPass)}
                    onChange={handleChange}
                    placeholder="16-character app password"
                  />
                </FormField>
                <label htmlFor="smtpSecure" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    id="smtpSecure"
                    name="smtpSecure"
                    checked={Boolean(settings?.smtpSecure)}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Use SSL (port 465). Leave off for Gmail port 587.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <CardTitle>Change Password</CardTitle>
          <CardDescription className="mt-1 mb-4">Update the password for the signed-in user.</CardDescription>
          {passwordMessage && <p className="mb-3 text-sm">{passwordMessage}</p>}
          <form
            noValidate
            className="grid max-w-md gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setPasswordMessage('')
              clearPasswordErrors()

              const errors: Record<string, string> = {}
              if (!passwordForm.currentPassword.trim()) errors.currentPassword = requiredMsg('Current password')
              if (!passwordForm.newPassword.trim()) errors.newPassword = requiredMsg('New password')
              else if (passwordForm.newPassword.length < 6) {
                errors.newPassword = 'Password must be at least 6 characters long.'
              }
              if (showPasswordErrors(errors)) return

              try {
                const token = localStorage.getItem('token')
                await axios.post('/api/auth/change-password', passwordForm, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                setPasswordMessage('Password updated.')
                setPasswordForm({ currentPassword: '', newPassword: '' })
              } catch (error: any) {
                setPasswordMessage(error.response?.data?.message || 'Unable to update password.')
              }
            }}
          >
            <FormField id="currentPassword" label="Current Password" error={passwordErrors.currentPassword} required>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                invalid={Boolean(passwordErrors.currentPassword)}
                onChange={(e) => {
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  clearPasswordError('currentPassword')
                }}
              />
            </FormField>
            <FormField id="newPassword" label="New Password" error={passwordErrors.newPassword} required>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                invalid={Boolean(passwordErrors.newPassword)}
                onChange={(e) => {
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  clearPasswordError('newPassword')
                }}
              />
            </FormField>
            <Button type="submit">Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
