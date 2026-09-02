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
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'

type Expense = {
  _id: string
  title: string
  amount: number
  category: string
  expenseDate: string
  notes?: string
  businessUnitId?: string | { _id: string }
  status: 'active' | 'inactive'
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const categories = [
  { value: 'personal', label: 'Personal' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'transport', label: 'Transport' },
  { value: 'salary', label: 'Salary' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' }
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  title: '',
  amount: 0,
  category: 'personal',
  expenseDate: today(),
  notes: '',
  businessUnitId: ''
}

const Expenses = () => {
  const [items, setItems] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Expense | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const fetchExpenses = async () => {
    try {
      const res = await axios.get('/api/expenses', { ...authHeaders(), ...listParams })
      setItems(listItems(res.data))
      setTotal(Number(res.data?.amountTotal) || 0)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load expenses.')
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ ...emptyForm, expenseDate: today(), businessUnitId: defaultUnitFormValue() })
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, expenseDate: today(), businessUnitId: defaultUnitFormValue() })
    setErrorMessage('')
    setShowForm(true)
  }

  const openEdit = (expense: Expense) => {
    setEditingId(expense._id)
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : today(),
      notes: expense.notes || '',
      businessUnitId: typeof expense.businessUnitId === 'object' ? expense.businessUnitId?._id || '' : expense.businessUnitId || ''
    })
    setErrorMessage('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!formData.title.trim()) {
      setErrorMessage('Expense title is required.')
      return
    }
    if (formData.amount < 0) {
      setErrorMessage('Amount cannot be negative.')
      return
    }
    try {
      setSaving(true)
      const payload = { ...formData, title: formData.title.trim() }
      if (editingId) {
        await axios.put(`/api/expenses/${editingId}`, payload, authHeaders())
      } else {
        await axios.post('/api/expenses', payload, authHeaders())
      }
      closeForm()
      fetchExpenses()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save expense.')
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
        await axios.delete(`/api/expenses/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/expenses/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'inactive' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchExpenses()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Misc Expenses"
        description="Record personal and other non-purchase costs so profit reports stay accurate."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : 'Add Expense'}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active expenses total</p>
          <p className="mt-1 text-2xl font-semibold">₹{total.toFixed(2)}</p>
        </CardContent>
      </Card>

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</CardTitle>
            <CardDescription>Use Personal for owner drawings and other categories for operating costs.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="exp-title">Title</Label>
                  <Input
                    id="exp-title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Fuel, rent, personal draw"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-amount">Amount</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-category">Category</Label>
                  <select
                    id="exp-category"
                    className="app-input flex h-10 w-full rounded-xl border px-3 py-2 text-sm"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    required
                  />
                </div>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => setFormData({ ...formData, businessUnitId })}
                />
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="exp-notes">Notes</Label>
                  <Input
                    id="exp-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional details"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Expense' : 'Save Expense'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense List</CardTitle>
          <CardDescription>{items.length} records. Disabled items stay in history but are excluded from profit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No expenses yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.expenseDate ? new Date(row.expenseDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="capitalize">{row.category}</TableCell>
                    <TableCell>₹{Number(row.amount).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell className="text-right">
                      <RecordActions
                        isActive={row.status === 'active'}
                        onEdit={() => openEdit(row)}
                        onToggle={() => {
                          setConfirmRow(row)
                          setConfirmKind(row.status === 'active' ? 'disable' : 'enable')
                        }}
                        onDelete={() => {
                          setConfirmRow(row)
                          setConfirmKind('delete')
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete expense' : confirmKind === 'disable' ? 'Disable expense' : 'Enable expense'}
        description={
          confirmKind === 'delete'
            ? `Do you want to delete ${confirmRow?.title}?`
            : confirmKind === 'disable'
              ? `Disable ${confirmRow?.title}? It will be excluded from profit.`
              : `Enable ${confirmRow?.title}?`
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

export default Expenses
