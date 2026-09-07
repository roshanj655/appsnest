import { useState, useEffect } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SearchableSelect from '@/components/SearchableSelect'

const Settings = () => {
  const [settings, setSettings] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [passwordMessage, setPasswordMessage] = useState('')

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
    setSettings((prev) => ({
      ...(prev || {}),
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSaving(true)
    setSuccess(false)

    if (!settings?.businessName?.trim() || !settings?.email?.trim() || !settings?.phone?.trim()) {
      setSaving(false)
      setErrorMessage('Business name, email, and phone are required.')
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
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <div className="mb-6">
                <CardTitle>Business Information</CardTitle>
                <CardDescription className="mt-1">These details appear across invoices, reports, and system identity.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input id="businessName" type="text" name="businessName" value={settings?.businessName || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" name="email" value={settings?.email || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="text" name="phone" value={settings?.phone || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input id="gstin" type="text" name="gstin" value={settings?.gstin || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input id="pan" type="text" name="pan" value={settings?.pan || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" type="text" name="address" value={settings?.address || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" type="text" name="city" value={settings?.city || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" type="text" name="state" value={settings?.state || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" type="text" name="pincode" value={settings?.pincode || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" type="text" name="country" value={settings?.country || 'India'} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <div className="mb-6">
                <CardTitle>Invoice and Printing</CardTitle>
                <CardDescription className="mt-1">Control numbering, receipt width, currency, and footer content.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Sales Invoice Prefix</Label>
                  <Input id="invoicePrefix" type="text" name="invoicePrefix" value={settings?.invoicePrefix || 'INV'} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">New sales use PREFIX/FY/000001, for example INV/25-26/000001. The PDF file is INV_25-26_000001.pdf.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDueDays">Invoice due days</Label>
                  <Input id="invoiceDueDays" type="number" min={0} name="invoiceDueDays" value={settings?.invoiceDueDays ?? 15} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseInvoicePrefix">Purchase Invoice Prefix</Label>
                  <Input id="purchaseInvoicePrefix" type="text" name="purchaseInvoicePrefix" value={settings?.purchaseInvoicePrefix || 'PUR'} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="thermalPrinterWidth">Thermal Printer Width (mm)</Label>
                  <SearchableSelect
                    id="thermalPrinterWidth"
                    name="thermalPrinterWidth"
                    value={String(settings?.thermalPrinterWidth || 58)}
                    onChange={(value) => setSettings((prev) => ({ ...(prev || {}), thermalPrinterWidth: Number(value) }))}
                    options={[
                      { value: '58', label: '58 mm' },
                      { value: '80', label: '80 mm' }
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <SearchableSelect
                    id="currency"
                    name="currency"
                    value={settings?.currency || 'INR'}
                    onChange={(value) => setSettings((prev) => ({ ...(prev || {}), currency: value }))}
                    options={[
                      { value: 'INR', label: 'INR (₹)' },
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'EUR', label: 'EUR (€)' },
                      { value: 'GBP', label: 'GBP (£)' }
                    ]}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input id="footerText" type="text" name="footerText" value={settings?.footerText || ''} onChange={handleChange} placeholder="Thank you for your business!" />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input id="bankName" name="bankName" value={settings?.bankName || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankBranch">Branch</Label>
                  <Input id="bankBranch" name="bankBranch" value={settings?.bankBranch || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Account name</Label>
                  <Input id="bankAccountName" name="bankAccountName" value={settings?.bankAccountName || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account number</Label>
                  <Input id="bankAccountNumber" name="bankAccountNumber" value={settings?.bankAccountNumber || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankIfsc">IFSC</Label>
                  <Input id="bankIfsc" name="bankIfsc" value={settings?.bankIfsc || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankSwift">Swift code</Label>
                  <Input id="bankSwift" name="bankSwift" value={settings?.bankSwift || ''} onChange={handleChange} />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP host</Label>
                  <Input id="smtpHost" name="smtpHost" value={settings?.smtpHost || ''} onChange={handleChange} placeholder="smtp.gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP port</Label>
                  <Input id="smtpPort" type="number" name="smtpPort" value={settings?.smtpPort || 587} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP user (Gmail address)</Label>
                  <Input id="smtpUser" name="smtpUser" value={settings?.smtpUser || ''} onChange={handleChange} placeholder="you@gmail.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPass">SMTP app password</Label>
                  <Input id="smtpPass" type="password" name="smtpPass" value={settings?.smtpPass || ''} onChange={handleChange} placeholder="16-character app password" />
                </div>
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
            className="grid max-w-md gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setPasswordMessage('')
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
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit">Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
