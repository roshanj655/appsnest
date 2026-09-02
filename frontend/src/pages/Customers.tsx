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
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setErrorMessage('')
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
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMessage(`${noun} name and phone number are required.`)
      return
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrorMessage('Enter a valid email address.')
      return
    }
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
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Credit Limit</Label>
                  <Input type="number" min={0} value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
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
