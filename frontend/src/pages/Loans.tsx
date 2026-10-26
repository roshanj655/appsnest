import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActions from '@/components/RecordActions'
import ReportChart from '@/components/ReportChart'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { BusinessUnitSelect, defaultUnitFormValue } from '@/components/BusinessUnitSelect'
import SearchableSelect from '@/components/SearchableSelect'

type Loan = {
  _id: string
  lenderName: string
  phone?: string
  purpose?: string
  notes?: string
  principalAmount: number
  interestRate?: number
  expectedInterest?: number
  startDate: string
  dueDate?: string
  principalPaid: number
  interestPaid: number
  outstandingPrincipal: number
  outstandingInterest: number
  status: 'active' | 'closed' | 'cancelled'
  repayments?: Array<{
    _id: string
    amount: number
    principalAmount: number
    interestAmount: number
    type: string
    method: string
    paidAt: string
    status: string
  }>
  businessUnitId?: string | { _id: string }
}

type ConfirmKind = 'disable' | 'enable' | 'delete'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  lenderName: '',
  phone: '',
  purpose: '',
  notes: '',
  principalAmount: 0,
  interestRate: 0,
  expectedInterest: 0,
  startDate: today(),
  dueDate: '',
  businessUnitId: ''
}

const Loans = () => {
  const [loans, setLoans] = useState<Loan[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)
  const [confirmRow, setConfirmRow] = useState<Loan | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null)
  const [repayForm, setRepayForm] = useState({
    amount: 0,
    type: 'mixed',
    method: 'cash',
    reference: '',
    notes: '',
    paidAt: today()
  })
  const [repayBusy, setRepayBusy] = useState(false)
  const [repayError, setRepayError] = useState('')
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()
  const {
    fieldErrors: repayFieldErrors,
    clearFieldErrors: clearRepayFieldErrors,
    clearFieldError: clearRepayFieldError,
    showFieldErrors: showRepayFieldErrors
  } = useFieldErrors()

  const fetchLoans = async () => {
    try {
      const res = await axios.get('/api/loans', { ...authHeaders(), ...listParams })
      setLoans(listItems(res.data))
      setSummary(res.data?.summary || null)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to load loans.')
    }
  }

  useEffect(() => {
    fetchLoans()
  }, [])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ ...emptyForm, startDate: today(), businessUnitId: defaultUnitFormValue() })
    clearFieldErrors()
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData({ ...emptyForm, startDate: today(), businessUnitId: defaultUnitFormValue() })
    setErrorMessage('')
    clearFieldErrors()
    setShowForm(true)
  }

  const openEdit = (loan: Loan) => {
    setEditingId(loan._id)
    setFormData({
      lenderName: loan.lenderName,
      phone: loan.phone || '',
      purpose: loan.purpose || '',
      notes: loan.notes || '',
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate || 0,
      expectedInterest: loan.expectedInterest || 0,
      startDate: loan.startDate ? loan.startDate.slice(0, 10) : today(),
      dueDate: loan.dueDate ? loan.dueDate.slice(0, 10) : '',
      businessUnitId: typeof loan.businessUnitId === 'object' ? loan.businessUnitId?._id || '' : loan.businessUnitId || ''
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
    if (!formData.lenderName.trim()) errors['loan-lender'] = requiredMsg('Lender name')
    if (formData.principalAmount <= 0) errors['loan-principal'] = 'Principal amount must be greater than zero.'
    if (showFieldErrors(errors)) return
    try {
      setSaving(true)
      const payload = {
        ...formData,
        lenderName: formData.lenderName.trim(),
        dueDate: formData.dueDate || undefined
      }
      if (editingId) {
        await axios.put(`/api/loans/${editingId}`, payload, authHeaders())
      } else {
        await axios.post('/api/loans', payload, authHeaders())
      }
      closeForm()
      fetchLoans()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to save loan.')
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
        await axios.delete(`/api/loans/${confirmRow._id}`, authHeaders())
      } else {
        await axios.put(
          `/api/loans/${confirmRow._id}`,
          { status: confirmKind === 'disable' ? 'cancelled' : 'active' },
          authHeaders()
        )
      }
      setConfirmKind(null)
      setConfirmRow(null)
      if (editingId === confirmRow._id) closeForm()
      fetchLoans()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Unable to complete this action.')
    } finally {
      setConfirmBusy(false)
    }
  }

  const closeRepay = () => {
    setRepayLoan(null)
    clearRepayFieldErrors()
  }

  const openRepay = (loan: Loan) => {
    setRepayLoan(loan)
    setRepayError('')
    clearRepayFieldErrors()
    setRepayForm({
      amount: 0,
      type: 'mixed',
      method: 'cash',
      reference: '',
      notes: '',
      paidAt: today()
    })
  }

  const submitRepayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayLoan) return
    setRepayError('')
    clearRepayFieldErrors()
    const outstanding =
      Number(repayLoan.outstandingPrincipal || 0) + Number(repayLoan.outstandingInterest || 0)
    const errors: Record<string, string> = {}
    if (repayForm.amount <= 0) errors['repay-amount'] = 'Enter how much you paid (for example 1000).'
    else if (repayForm.amount > outstanding + 0.009) {
      errors['repay-amount'] = `Cannot pay more than outstanding ₹${outstanding.toFixed(2)}.`
    }
    if (showRepayFieldErrors(errors)) return
    setRepayBusy(true)
    try {
      await axios.post(
        `/api/loans/${repayLoan._id}/repayments`,
        {
          amount: repayForm.amount,
          type: repayForm.type,
          method: repayForm.method,
          reference: repayForm.reference || undefined,
          notes: repayForm.notes || undefined,
          paidAt: repayForm.paidAt
        },
        authHeaders()
      )
      closeRepay()
      fetchLoans()
    } catch (err: any) {
      setRepayError(err.response?.data?.message || 'Unable to record repayment.')
    } finally {
      setRepayBusy(false)
    }
  }

  const historyRows = useMemo(() => {
    const rows: Array<{
      key: string
      date: string
      lender: string
      event: string
      principal: number
      interest: number
      total: number
      method: string
      status: string
      balanceAfter?: string
    }> = []

    for (const loan of loans) {
      rows.push({
        key: `${loan._id}-taken`,
        date: loan.startDate ? String(loan.startDate).slice(0, 10) : '—',
        lender: loan.lenderName,
        event: 'Loan taken',
        principal: Number(loan.principalAmount || 0),
        interest: Number(loan.expectedInterest || 0),
        total: Number(loan.principalAmount || 0),
        method: '—',
        status: loan.status,
        balanceAfter: `Pending ₹${(
          Number(loan.outstandingPrincipal || 0) + Number(loan.outstandingInterest || 0)
        ).toFixed(2)}`
      })

      for (const payment of loan.repayments || []) {
        rows.push({
          key: `${loan._id}-${payment._id}`,
          date: payment.paidAt ? String(payment.paidAt).slice(0, 10) : '—',
          lender: loan.lenderName,
          event: payment.status === 'reversed' ? 'Payment reversed' : 'Payment paid',
          principal: Number(payment.principalAmount || 0),
          interest: Number(payment.interestAmount || 0),
          total: Number(payment.amount || 0),
          method: payment.method || '—',
          status: payment.status || 'active'
        })
      }
    }

    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [loans])

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Shop loans"
        description="Track money borrowed to buy stock. Principal is not sales profit. Only interest paid affects net profit."
        actions={
          <Button type="button" onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Close Form' : 'Add Loan'}
          </Button>
        }
      />

      {summary && (
        <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Principal borrowed</p>
              <p className="text-2xl font-semibold">₹{Number(summary.principalBorrowed || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Outstanding principal</p>
              <p className="text-2xl font-semibold">₹{Number(summary.outstandingPrincipal || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Outstanding interest</p>
              <p className="text-2xl font-semibold">₹{Number(summary.outstandingInterest || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">Interest paid</p>
              <p className="text-2xl font-semibold">₹{Number(summary.interestPaid || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ReportChart
            title="Loan pending"
            description="How much principal and interest is still due."
            type="pie"
            xKey="name"
            data={[
              { name: 'Pending principal', value: Number(summary.outstandingPrincipal || 0), color: '#f43f5e' },
              { name: 'Pending interest', value: Number(summary.outstandingInterest || 0), color: '#f59e0b' },
              { name: 'Principal paid', value: Number(summary.principalPaid || 0), color: '#10b981' },
              { name: 'Interest paid', value: Number(summary.interestPaid || 0), color: '#64748b' }
            ]}
            series={[{ key: 'value', name: 'Amount', color: '#10b981' }]}
          />
          <ReportChart
            title="Pending by lender"
            description="Active loans still owed."
            type="bar"
            layout="vertical"
            xKey="name"
            data={loans
              .filter((loan) => loan.status === 'active')
              .map((loan) => ({
                name: String(loan.lenderName || 'Loan').slice(0, 18),
                value:
                  Number(loan.outstandingPrincipal || 0) + Number(loan.outstandingInterest || 0)
              }))}
            series={[{ key: 'value', name: 'Pending', color: '#22d3ee' }]}
          />
        </div>
        </>
      )}

      {errorMessage && !showForm && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Loan' : 'Add Loan'}</CardTitle>
            <CardDescription>Record funds taken from a person/bank to purchase inventory or run the shop.</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
            )}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormField id="loan-lender" label="Lender name" error={fieldErrors['loan-lender']} required>
                  <Input
                    id="loan-lender"
                    value={formData.lenderName}
                    onChange={(e) => {
                      clearFieldError('loan-lender')
                      setFormData({ ...formData, lenderName: e.target.value })
                    }}
                    placeholder="Person / bank / relative"
                    invalid={Boolean(fieldErrors['loan-lender'])}
                  />
                </FormField>
                <FormField id="loan-phone" label="Phone" error={fieldErrors['loan-phone']}>
                  <Input
                    id="loan-phone"
                    value={formData.phone}
                    onChange={(e) => {
                      clearFieldError('loan-phone')
                      setFormData({ ...formData, phone: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['loan-phone'])}
                  />
                </FormField>
                <FormField id="loan-principal" label="Principal amount" error={fieldErrors['loan-principal']} required>
                  <Input
                    id="loan-principal"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.principalAmount}
                    onChange={(e) => {
                      clearFieldError('loan-principal')
                      setFormData({ ...formData, principalAmount: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['loan-principal'])}
                  />
                </FormField>
                <FormField id="loan-interest-rate" label="Interest rate % (optional)" error={fieldErrors['loan-interest-rate']}>
                  <Input
                    id="loan-interest-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.interestRate}
                    onChange={(e) => {
                      clearFieldError('loan-interest-rate')
                      setFormData({ ...formData, interestRate: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['loan-interest-rate'])}
                  />
                </FormField>
                <FormField id="loan-expected-interest" label="Expected interest amount" error={fieldErrors['loan-expected-interest']}>
                  <Input
                    id="loan-expected-interest"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.expectedInterest}
                    onChange={(e) => {
                      clearFieldError('loan-expected-interest')
                      setFormData({ ...formData, expectedInterest: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(fieldErrors['loan-expected-interest'])}
                  />
                </FormField>
                <FormField id="loan-start" label="Start date" error={fieldErrors['loan-start']}>
                  <Input
                    id="loan-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      clearFieldError('loan-start')
                      setFormData({ ...formData, startDate: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['loan-start'])}
                  />
                </FormField>
                <FormField id="loan-due" label="Due date" error={fieldErrors['loan-due']}>
                  <Input
                    id="loan-due"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => {
                      clearFieldError('loan-due')
                      setFormData({ ...formData, dueDate: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['loan-due'])}
                  />
                </FormField>
                <BusinessUnitSelect
                  value={formData.businessUnitId}
                  onChange={(businessUnitId) => setFormData({ ...formData, businessUnitId })}
                />
                <FormField id="loan-purpose" label="Purpose" error={fieldErrors['loan-purpose']} className="md:col-span-2">
                  <Input
                    id="loan-purpose"
                    value={formData.purpose}
                    onChange={(e) => {
                      clearFieldError('loan-purpose')
                      setFormData({ ...formData, purpose: e.target.value })
                    }}
                    placeholder="e.g. Stock purchase for Puja season"
                    invalid={Boolean(fieldErrors['loan-purpose'])}
                  />
                </FormField>
                <FormField id="loan-notes" label="Notes" error={fieldErrors['loan-notes']} className="md:col-span-3">
                  <Input
                    id="loan-notes"
                    value={formData.notes}
                    onChange={(e) => {
                      clearFieldError('loan-notes')
                      setFormData({ ...formData, notes: e.target.value })
                    }}
                    invalid={Boolean(fieldErrors['loan-notes'])}
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update Loan' : 'Save Loan'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Loan list</CardTitle>
          <CardDescription>{loans.length} loan record(s).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Outstanding principal</TableHead>
                <TableHead>Outstanding interest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">No loans recorded yet.</TableCell>
                </TableRow>
              ) : (
                loans.map((loan) => (
                  <TableRow key={loan._id}>
                    <TableCell className="font-medium">
                      <div>{loan.lenderName}</div>
                      {loan.phone && <div className="text-xs text-muted-foreground">{loan.phone}</div>}
                    </TableCell>
                    <TableCell>{loan.purpose || '—'}</TableCell>
                    <TableCell>₹{Number(loan.principalAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(loan.outstandingPrincipal || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(loan.outstandingInterest || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        loan.status === 'active'
                          ? 'bg-amber-500/15 text-amber-700'
                          : loan.status === 'closed'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-red-500/15 text-red-700'
                      }`}>
                        {loan.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(Number(loan.outstandingPrincipal || 0) > 0 || Number(loan.outstandingInterest || 0) > 0) &&
                          loan.status === 'active' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => openRepay(loan)}>
                            Repay
                          </Button>
                        )}
                        <RecordActions
                          isActive={loan.status !== 'cancelled'}
                          disableLabel="Cancel"
                          enableLabel="Restore"
                          onEdit={() => openEdit(loan)}
                          onToggle={() => {
                            setConfirmKind(loan.status === 'cancelled' ? 'enable' : 'disable')
                            setConfirmRow(loan)
                          }}
                          onDelete={() => {
                            setConfirmKind('delete')
                            setConfirmRow(loan)
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan history</CardTitle>
          <CardDescription>
            Table of every loan taken and every payment made. Paying ₹1000 on a ₹10,000 loan leaves ₹9,000 pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Lender</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No loan history yet.
                  </TableCell>
                </TableRow>
              ) : (
                historyRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell className="font-medium">{row.lender}</TableCell>
                    <TableCell>
                      <div>{row.event}</div>
                      {row.balanceAfter && (
                        <div className="text-xs text-muted-foreground">{row.balanceAfter}</div>
                      )}
                    </TableCell>
                    <TableCell>₹{row.principal.toFixed(2)}</TableCell>
                    <TableCell>₹{row.interest.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">₹{row.total.toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{row.method}</TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {repayLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Repay loan · {repayLoan.lenderName}</CardTitle>
            </CardHeader>
            <CardContent>
              {repayError && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{repayError}</div>
              )}
              <p className="mb-3 text-sm text-muted-foreground">
                Outstanding: principal ₹{Number(repayLoan.outstandingPrincipal || 0).toFixed(2)} · interest ₹
                {Number(repayLoan.outstandingInterest || 0).toFixed(2)} · total ₹
                {(
                  Number(repayLoan.outstandingPrincipal || 0) + Number(repayLoan.outstandingInterest || 0)
                ).toFixed(2)}
                . Enter only the amount you paid now (example: 1000). Do not enter the full loan unless you are clearing it.
              </p>
              <form onSubmit={submitRepayment} noValidate className="space-y-3">
                <FormField id="repay-amount" label="Amount paid now" error={repayFieldErrors['repay-amount']} required>
                  <Input
                    id="repay-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 1000"
                    value={repayForm.amount || ''}
                    onChange={(e) => {
                      clearRepayFieldError('repay-amount')
                      setRepayForm({ ...repayForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })
                    }}
                    invalid={Boolean(repayFieldErrors['repay-amount'])}
                  />
                </FormField>
                <FormField id="repay-type" label="Apply as" error={repayFieldErrors['repay-type']}>
                  <SearchableSelect
                    id="repay-type"
                    value={repayForm.type}
                    onChange={(type) => {
                      clearRepayFieldError('repay-type')
                      setRepayForm({ ...repayForm, type })
                    }}
                    options={[
                      { value: 'mixed', label: 'Interest first, then principal' },
                      { value: 'principal', label: 'Principal only' },
                      { value: 'interest', label: 'Interest only' }
                    ]}
                    invalid={Boolean(repayFieldErrors['repay-type'])}
                  />
                </FormField>
                <FormField id="repay-method" label="Method" error={repayFieldErrors['repay-method']}>
                  <SearchableSelect
                    id="repay-method"
                    value={repayForm.method}
                    onChange={(method) => {
                      clearRepayFieldError('repay-method')
                      setRepayForm({ ...repayForm, method })
                    }}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'bank', label: 'Bank Transfer' },
                      { value: 'other', label: 'Other' }
                    ]}
                    invalid={Boolean(repayFieldErrors['repay-method'])}
                  />
                </FormField>
                <FormField id="repay-paid-at" label="Date" error={repayFieldErrors['repay-paid-at']}>
                  <Input
                    id="repay-paid-at"
                    type="date"
                    value={repayForm.paidAt}
                    onChange={(e) => {
                      clearRepayFieldError('repay-paid-at')
                      setRepayForm({ ...repayForm, paidAt: e.target.value })
                    }}
                    invalid={Boolean(repayFieldErrors['repay-paid-at'])}
                  />
                </FormField>
                <FormField id="repay-reference" label="Reference" error={repayFieldErrors['repay-reference']}>
                  <Input
                    id="repay-reference"
                    value={repayForm.reference}
                    onChange={(e) => {
                      clearRepayFieldError('repay-reference')
                      setRepayForm({ ...repayForm, reference: e.target.value })
                    }}
                    invalid={Boolean(repayFieldErrors['repay-reference'])}
                  />
                </FormField>
                <FormField id="repay-notes" label="Notes" error={repayFieldErrors['repay-notes']}>
                  <Input
                    id="repay-notes"
                    value={repayForm.notes}
                    onChange={(e) => {
                      clearRepayFieldError('repay-notes')
                      setRepayForm({ ...repayForm, notes: e.target.value })
                    }}
                    invalid={Boolean(repayFieldErrors['repay-notes'])}
                  />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeRepay} disabled={repayBusy}>Cancel</Button>
                  <Button type="submit" disabled={repayBusy}>
                    {repayBusy ? 'Saving…' : 'Record repayment'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmKind && confirmRow)}
        title={confirmKind === 'delete' ? 'Delete loan' : confirmKind === 'disable' ? 'Cancel loan' : 'Restore loan'}
        description={
          confirmKind === 'delete'
            ? `Delete or cancel loan from ${confirmRow?.lenderName}?`
            : confirmKind === 'disable'
              ? `Cancel loan from ${confirmRow?.lenderName}?`
              : `Restore loan from ${confirmRow?.lenderName}?`
        }
        confirmLabel={confirmKind === 'delete' ? 'Delete' : confirmKind === 'disable' ? 'Cancel loan' : 'Restore'}
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

export default Loans
