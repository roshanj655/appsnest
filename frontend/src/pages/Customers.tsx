import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import ExcelImport from '@/components/ExcelImport'

type Party = {
  _id: string
  name: string
  email?: string
  phone: string
  gstin?: string
  creditLimit?: number
  notes?: string
  address?: string
  status?: 'active' | 'inactive'
}

type FormData = { name: string; email: string; phone: string; gstin: string; creditLimit: number; notes: string; address: string }
type ConfirmKind = 'disable' | 'enable' | 'delete'

const emptyForm: FormData = { name: '', email: '', phone: '', gstin: '', creditLimit: 0, notes: '', address: '' }

type PartyPageProps = {
  title: string
  description: string
  addLabel: string
  apiPath: string
  noun: string
}

const PartyDirectory = ({ title, description, addLabel, apiPath, noun }: PartyPageProps) => {
  const [rows, setRows] = useState<Party[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Party | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  useEffect(() => {
    fetchRows()
  }, [apiPath])

  const fetchRows = async () => {
    try {
      const res = await axios.get(apiPath, { ...authHeaders(), ...listParams })
      setRows(listItems(res.data))
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || `Unable to load ${noun}s.`)
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(emptyForm)
    clearFieldErrors()
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const openEdit = (row: Party) => {
    setEditingId(row._id)
    setFormData({
      name: row.name,
      email: row.email || '',
      phone: row.phone,
      gstin: row.gstin || '',
      creditLimit: row.creditLimit || 0,
      notes: row.notes || '',
      address: row.address || ''
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
    if (!formData.name.trim()) errors['party-name'] = requiredMsg(`${noun} name`)
    if (!formData.phone.trim()) errors['party-phone'] = requiredMsg('Phone number')
    if (formData.email.trim() && !isValidEmail(formData.email)) errors['party-email'] = emailMsg
    if (showFieldErrors(errors)) return
    try {
      setSaving(true)
      if (editingId) {
        await axios.put(`${apiPath}/${editingId}`, formData, authHeaders())
      } else {
        await axios.post(apiPath, formData, authHeaders())
      }
      closeForm()
      fetchRows()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || `Unable to save ${noun}.`)
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
        await axios.delete(`${apiPath}/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `${apiPath}/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'inactive' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchRows()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : addLabel}
          </Button>
        }
      />

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? `Edit ${noun}` : `Add New ${noun}`}</CardTitle>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            {!editingId && (
              <div className="mb-5">
                <ExcelImport
                  samplePath={`${apiPath}/import/sample`}
                  importPath={`${apiPath}/import`}
                  fileName={`${noun.toLowerCase()}s-import-sample.xlsx`}
                  onImported={fetchRows}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id="party-name" label="Name" error={fieldErrors['party-name']} required>
                  <Input
                    id="party-name"
                    value={formData.name}
                    onChange={(e) => {
                      clearFieldError('party-name')
                      setFormData({ ...formData, name: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-name'])}
                  />
                </FormField>
                <FormField id="party-email" label="Email" error={fieldErrors['party-email']}>
                  <Input
                    id="party-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      clearFieldError('party-email')
                      setFormData({ ...formData, email: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-email'])}
                  />
                </FormField>
                <FormField id="party-phone" label="Phone" error={fieldErrors['party-phone']} required>
                  <Input
                    id="party-phone"
                    value={formData.phone}
                    onChange={(e) => {
                      clearFieldError('party-phone')
                      setFormData({ ...formData, phone: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-phone'])}
                  />
                </FormField>
                <FormField id="party-gstin" label="GSTIN" error={fieldErrors['party-gstin']}>
                  <Input
                    id="party-gstin"
                    value={formData.gstin}
                    onChange={(e) => {
                      clearFieldError('party-gstin')
                      setFormData({ ...formData, gstin: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-gstin'])}
                  />
                </FormField>
                <FormField id="party-credit" label="Credit Limit" error={fieldErrors['party-credit']}>
                  <Input
                    id="party-credit"
                    type="number"
                    min={0}
                    value={formData.creditLimit}
                    onChange={(e) => {
                      clearFieldError('party-credit')
                      setFormData({ ...formData, creditLimit: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['party-credit'])}
                  />
                </FormField>
                <FormField id="party-address" label="Address" error={fieldErrors['party-address']}>
                  <Input
                    id="party-address"
                    value={formData.address}
                    onChange={(e) => {
                      clearFieldError('party-address')
                      setFormData({ ...formData, address: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-address'])}
                  />
                </FormField>
                <FormField id="party-notes" label="Notes" error={fieldErrors['party-notes']} className="md:col-span-3">
                  <Input
                    id="party-notes"
                    value={formData.notes}
                    onChange={(e) => {
                      clearFieldError('party-notes')
                      setFormData({ ...formData, notes: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['party-notes'])}
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? `Update ${noun}` : `Save ${noun}`}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{title} Directory</CardTitle>
          <CardDescription>{rows.length} records in your system.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell>{row.email || '-'}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell className="capitalize">{row.status || 'active'}</TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      isActive={row.status !== 'inactive'}
                      onEdit={() => openEdit(row)}
                      onToggle={() => {
                        setConfirmRow(row)
                        setConfirmKind(row.status === 'inactive' ? 'enable' : 'disable')
                      }}
                      onDelete={() => {
                        setConfirmRow(row)
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
        title={confirmKind === 'delete' ? `Delete ${noun}` : confirmKind === 'disable' ? `Disable ${noun}` : `Enable ${noun}`}
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

export { PartyDirectory }

export const Customers = () => (
  <PartyDirectory
    title="Customers"
    description="Keep customer contact details accurate and ready for billing and follow-up."
    addLabel="Add Customer"
    apiPath="/api/customers"
    noun="Customer"
  />
)

export default Customers
