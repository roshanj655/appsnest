import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import SearchableSelect from '@/components/SearchableSelect'
import ExcelImport from '@/components/ExcelImport'

type Expense = {
  _id: string
  title: string
  amount: number
  category: string
  kind?: 'shop' | 'personal'
  expenseDate: string
  notes?: string
  businessUnitId?: string | { _id: string }
  status: 'active' | 'inactive'
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const categories = [
  { value: 'personal', label: 'Personal (owner draw)' },
  { value: 'home', label: 'Home' },
  { value: 'family', label: 'Family' },
  { value: 'rent', label: 'Shop rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'transport', label: 'Transport' },
  { value: 'salary', label: 'Salary' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other shop cost' }
]

const personalCategories = new Set(['personal', 'home', 'family'])

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  title: '',
  amount: 0,
  category: 'other',
  kind: 'shop' as 'shop' | 'personal',
  expenseDate: today(),
  notes: '',
  businessUnitId: ''
}

const Expenses = () => {
  const [items, setItems] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [shopTotal, setShopTotal] = useState(0)
  const [personalTotal, setPersonalTotal] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Expense | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  const fetchExpenses = async () => {
    try {
      const res = await axios.get('/api/expenses', { ...authHeaders(), ...listParams })
      setItems(listItems(res.data))
      setTotal(Number(res.data?.amountTotal) || 0)
      setShopTotal(Number(res.data?.shopTotal) || 0)
      setPersonalTotal(Number(res.data?.personalTotal) || 0)
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
    clearFieldErrors()
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, expenseDate: today(), businessUnitId: defaultUnitFormValue() })
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const openEdit = (expense: Expense) => {
    setEditingId(expense._id)
    const kind =
      expense.kind ||
      (personalCategories.has(expense.category) ? 'personal' : 'shop')
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      kind,
      expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : today(),
      notes: expense.notes || '',
      businessUnitId: typeof expense.businessUnitId === 'object' ? expense.businessUnitId?._id || '' : expense.businessUnitId || ''
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
    if (!formData.title.trim()) errors['exp-title'] = requiredMsg('Expense title')
    if (formData.amount < 0) errors['exp-amount'] = 'Amount cannot be negative.'
    if (showFieldErrors(errors)) return
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
        description="Shop costs reduce profit. Personal/home payments use shop cash but are tracked separately."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/reports/personal-expenses">Personal / home report</Link>
            </Button>
            <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
              {showForm ? 'Close Form' : 'Add Expense'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All active</p>
            <p className="mt-1 text-2xl font-semibold">₹{total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shop expenses</p>
            <p className="mt-1 text-2xl font-semibold">₹{shopTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Personal / home draws</p>
            <p className="mt-1 text-2xl font-semibold">₹{personalTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</CardTitle>
            <CardDescription>
              Choose Personal / Home when the shop pays for home or personal needs. Choose Shop for rent, salary, and other business costs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            {!editingId && (
              <div className="mb-5">
                <ExcelImport
                  samplePath="/api/expenses/import/sample"
                  importPath="/api/expenses/import"
                  fileName="expenses-import-sample.xlsx"
                  onImported={fetchExpenses}
                />
              </div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField id="exp-title" label="Title" error={fieldErrors['exp-title']} required>
                  <Input
                    id="exp-title"
                    value={formData.title}
                    onChange={(e) => {
                      clearFieldError('exp-title')
                      setFormData({ ...formData, title: e.target.value })
                    }}
                    placeholder="Fuel, rent, personal draw"
                    invalid={Boolean(fieldErrors['exp-title'])}
                  />
                </FormField>
                <FormField id="exp-amount" label="Amount" error={fieldErrors['exp-amount']} required>
                  <Input
                    id="exp-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => {
                      clearFieldError('exp-amount')
                      setFormData({ ...formData, amount: Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['exp-amount'])}
                  />
                </FormField>
                <FormField id="exp-kind" label="Payment type" error={fieldErrors['exp-kind']} required>
                  <SearchableSelect
                    id="exp-kind"
                    value={formData.kind}
                    onChange={(kind) => {
                      clearFieldError('exp-kind')
                      const nextKind = kind === 'personal' ? 'personal' : 'shop'
                      setFormData({
                        ...formData,
                        kind: nextKind,
                        category:
                          nextKind === 'personal'
                            ? personalCategories.has(formData.category)
                              ? formData.category
                              : 'personal'
                            : personalCategories.has(formData.category)
                              ? 'other'
                              : formData.category
                      })
                    }}
                    options={[
                      { value: 'shop', label: 'Shop expense (affects profit)' },
                      { value: 'personal', label: 'Personal / home (owner draw)' }
                    ]}
                    invalid={Boolean(fieldErrors['exp-kind'])}
                  />
                </FormField>
                <FormField id="exp-category" label="Category" error={fieldErrors['exp-category']}>
                  <SearchableSelect
                    id="exp-category"
                    value={formData.category}
                    onChange={(category) => {
                      clearFieldError('exp-category')
                      setFormData({
                        ...formData,
                        category,
                        kind: personalCategories.has(category) ? 'personal' : 'shop'
                      })
                    }}
                    options={categories
                      .filter((category) =>
                        formData.kind === 'personal'
                          ? personalCategories.has(category.value)
                          : !personalCategories.has(category.value)
                      )
                      .map((category) => ({ value: category.value, label: category.label }))}
                    invalid={Boolean(fieldErrors['exp-category'])}
                  />
                </FormField>
                <FormField id="exp-date" label="Date" error={fieldErrors['exp-date']}>
                  <Input
                    id="exp-date"
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => {
                      clearFieldError('exp-date')
                      setFormData({ ...formData, expenseDate: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['exp-date'])}
                  />
                </FormField>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => setFormData({ ...formData, businessUnitId })}
                />
                <FormField id="exp-notes" label="Notes" error={fieldErrors['exp-notes']} className="md:col-span-2">
                  <Input
                    id="exp-notes"
                    value={formData.notes}
                    onChange={(e) => {
                      clearFieldError('exp-notes')
                      setFormData({ ...formData, notes: e.target.value })
                    }}
                    placeholder="Optional details"
                    invalid={Boolean(fieldErrors['exp-notes'])}
                  />
                </FormField>
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
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No expenses yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.expenseDate ? new Date(row.expenseDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="capitalize">
                      {row.kind || (personalCategories.has(row.category) ? 'personal' : 'shop')}
                    </TableCell>
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
