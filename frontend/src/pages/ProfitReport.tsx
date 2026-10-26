import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ReportChart from '@/components/ReportChart'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import SearchableSelect from '@/components/SearchableSelect'
import axios from 'axios'
import { authHeaders } from '@/lib/api'
import { requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { topN } from '@/lib/reportCharts'

const today = () => new Date().toISOString().slice(0, 10)

const ProfitReport = () => {
  const [data, setData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [repayForm, setRepayForm] = useState({
    loanId: '',
    amount: 0,
    type: 'mixed',
    method: 'cash',
    paidAt: today(),
    notes: ''
  })
  const [repayBusy, setRepayBusy] = useState(false)
  const [repayMessage, setRepayMessage] = useState('')
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()

  useEffect(() => {
    fetchProfit()
  }, [startDate, endDate])

  const fetchProfit = async () => {
    try {
      const token = localStorage.getItem('token')
      const params: any = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const res = await axios.get('/api/reports/profit', {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      setData(res.data)
      const active = (res.data?.loanSummary?.loans || []).filter((row: any) => row.status === 'active')
      if (active.length && !repayForm.loanId) {
        setRepayForm((prev) => ({
          ...prev,
          loanId: active[0]._id,
          amount: 0
        }))
      }
    } catch (error) {
      console.error('Error fetching profit report:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitRepayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setRepayMessage('')
    clearFieldErrors()
    const selected = (data?.loanSummary?.loans || []).find((row: any) => row._id === repayForm.loanId)
    const outstanding = selected
      ? Number(selected.outstandingPrincipal || 0) + Number(selected.outstandingInterest || 0)
      : 0
    const errors: Record<string, string> = {}
    if (!repayForm.loanId) errors['profit-loan'] = requiredMsg('Loan')
    if (!repayForm.amount || repayForm.amount <= 0) {
      errors['profit-loan-amount'] = 'Enter how much you paid now (for example 1000).'
    } else if (outstanding > 0 && repayForm.amount > outstanding + 0.009) {
      errors['profit-loan-amount'] = `Cannot pay more than outstanding ₹${outstanding.toFixed(2)}.`
    }
    if (showFieldErrors(errors)) return
    try {
      setRepayBusy(true)
      await axios.post(
        `/api/loans/${repayForm.loanId}/repayments`,
        {
          amount: repayForm.amount,
          type: repayForm.type,
          method: repayForm.method,
          paidAt: repayForm.paidAt,
          notes: repayForm.notes || undefined
        },
        authHeaders()
      )
      setRepayMessage('Loan payment recorded.')
      await fetchProfit()
    } catch (err: any) {
      setRepayMessage(err.response?.data?.message || 'Unable to record loan payment.')
    } finally {
      setRepayBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const loanSummary = data?.loanSummary
  const activeLoans = (loanSummary?.loans || []).filter((row: any) => row.status === 'active')
  const outstandingTotal =
    Number(loanSummary?.outstandingPrincipal || 0) + Number(loanSummary?.outstandingInterest || 0)

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Profit Report"
        description="Shop profit, pending loans, and personal/home draws from shop cash."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/loans">Shop loans</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/reports/personal-expenses">Personal / home report</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchProfit}>Apply Filters</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-6">
                <div className="text-xs text-emerald-600 font-medium">Total Revenue</div>
                <div className="text-3xl font-bold text-emerald-700">₹{Number(data.totalSales || 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-100">
              <CardContent className="p-6">
                <div className="text-xs text-red-600 font-medium">COGS</div>
                <div className="text-3xl font-bold text-red-700">₹{Number(data.totalCogs ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-100">
              <CardContent className="p-6">
                <div className="text-xs text-orange-600 font-medium">Shop Expenses</div>
                <div className="text-3xl font-bold text-orange-700">
                  ₹{Number(data.totalShopExpenses ?? data.totalMiscExpenses ?? 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-6">
                <div className="text-xs text-slate-600 font-medium">Loan Interest Paid</div>
                <div className="text-3xl font-bold text-slate-700">₹{Number(data.totalLoanInterest || 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 border-indigo-100">
              <CardContent className="p-6">
                <div className="text-xs text-indigo-600 font-medium">Net Shop Profit</div>
                <div className="text-3xl font-bold text-indigo-700">₹{Number(data.netProfit || 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`${Number(data.grossProfit || 0) >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
              <CardContent className="p-6">
                <div className={`text-xs font-medium ${Number(data.grossProfit || 0) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  Gross Profit
                </div>
                <div className={`text-3xl font-bold ${Number(data.grossProfit || 0) >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                  ₹{Number(data.grossProfit || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-rose-50 border-rose-100">
              <CardContent className="p-6">
                <div className="text-xs text-rose-600 font-medium">Loan Pending</div>
                <div className="text-3xl font-bold text-rose-700">₹{outstandingTotal.toFixed(2)}</div>
                <p className="mt-1 text-xs text-rose-700/80">
                  Principal ₹{Number(loanSummary?.outstandingPrincipal || 0).toFixed(2)} · Interest ₹
                  {Number(loanSummary?.outstandingInterest || 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-violet-50 border-violet-100">
              <CardContent className="p-6">
                <div className="text-xs text-violet-600 font-medium">Personal / Home Draws</div>
                <div className="text-3xl font-bold text-violet-700">₹{Number(data.totalPersonalDraws || 0).toFixed(2)}</div>
                <p className="mt-1 text-xs text-violet-700/80">Not deducted from shop net profit</p>
              </CardContent>
            </Card>
          </div>

          {data.note && (
            <p className="text-sm text-muted-foreground">{data.note}</p>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ReportChart
              title="Loan pending vs shop profit"
              description="How much loan is still due compared with net shop profit."
              type="bar"
              xKey="name"
              data={[
                { name: 'Net profit', value: Math.max(0, Number(data.netProfit || 0)) },
                { name: 'Loan pending', value: outstandingTotal },
                { name: 'Interest paid', value: Number(data.totalLoanInterest || 0) },
                { name: 'Personal draws', value: Number(data.totalPersonalDraws || 0) }
              ]}
              series={[{ key: 'value', name: 'Amount', color: '#22d3ee' }]}
            />
            <ReportChart
              title="Loan status mix"
              description="Outstanding principal and interest still pending."
              type="pie"
              xKey="name"
              data={[
                { name: 'Pending principal', value: Number(loanSummary?.outstandingPrincipal || 0), color: '#f43f5e' },
                { name: 'Pending interest', value: Number(loanSummary?.outstandingInterest || 0), color: '#f59e0b' },
                { name: 'Principal paid', value: Number(loanSummary?.principalPaid || 0), color: '#10b981' },
                { name: 'Interest paid', value: Number(loanSummary?.interestPaid || 0), color: '#64748b' }
              ]}
              series={[{ key: 'value', name: 'Amount', color: '#10b981' }]}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Record loan payment</CardTitle>
                <CardDescription>
                  Enter how much loan you paid. Principal does not change sales profit; interest does.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeLoans.length === 0 ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>No active loans with pending balance.</p>
                    <Button asChild>
                      <Link to="/loans">Add a shop loan</Link>
                    </Button>
                  </div>
                ) : (
                  <form noValidate onSubmit={submitRepayment} className="space-y-4">
                    {repayMessage && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{repayMessage}</div>
                    )}
                    <FormField id="profit-loan" label="Loan" error={fieldErrors['profit-loan']} required>
                      <SearchableSelect
                        id="profit-loan"
                        value={repayForm.loanId}
                        invalid={Boolean(fieldErrors['profit-loan'])}
                        onChange={(loanId) => {
                          clearFieldError('profit-loan')
                          setRepayForm({
                            ...repayForm,
                            loanId,
                            amount: 0
                          })
                        }}
                        options={activeLoans.map((loan: any) => ({
                          value: loan._id,
                          label: loan.lenderName,
                          description: `Pending ₹${(
                            Number(loan.outstandingPrincipal || 0) + Number(loan.outstandingInterest || 0)
                          ).toFixed(2)}`
                        }))}
                      />
                    </FormField>
                    <FormField
                      id="profit-loan-amount"
                      label="Amount paid now"
                      error={fieldErrors['profit-loan-amount']}
                      required
                      hint={
                        repayForm.loanId
                          ? `Outstanding ₹${(
                              Number(activeLoans.find((row: any) => row._id === repayForm.loanId)?.outstandingPrincipal || 0) +
                              Number(activeLoans.find((row: any) => row._id === repayForm.loanId)?.outstandingInterest || 0)
                            ).toFixed(2)}`
                          : undefined
                      }
                    >
                      <Input
                        id="profit-loan-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 1000"
                        value={repayForm.amount || ''}
                        invalid={Boolean(fieldErrors['profit-loan-amount'])}
                        onChange={(e) => {
                          clearFieldError('profit-loan-amount')
                          setRepayForm({ ...repayForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })
                        }}
                      />
                    </FormField>
                    <FormField id="profit-loan-type" label="Apply as">
                      <SearchableSelect
                        id="profit-loan-type"
                        value={repayForm.type}
                        onChange={(type) => setRepayForm({ ...repayForm, type })}
                        options={[
                          { value: 'mixed', label: 'Interest first, then principal' },
                          { value: 'principal', label: 'Principal only' },
                          { value: 'interest', label: 'Interest only' }
                        ]}
                      />
                    </FormField>
                    <FormField id="profit-loan-method" label="Method">
                      <SearchableSelect
                        id="profit-loan-method"
                        value={repayForm.method}
                        onChange={(method) => setRepayForm({ ...repayForm, method })}
                        options={[
                          { value: 'cash', label: 'Cash' },
                          { value: 'upi', label: 'UPI' },
                          { value: 'bank', label: 'Bank transfer' },
                          { value: 'other', label: 'Other' }
                        ]}
                      />
                    </FormField>
                    <FormField id="profit-loan-date" label="Payment date">
                      <Input
                        id="profit-loan-date"
                        type="date"
                        value={repayForm.paidAt}
                        onChange={(e) => setRepayForm({ ...repayForm, paidAt: e.target.value })}
                      />
                    </FormField>
                    <Button type="submit" disabled={repayBusy}>
                      {repayBusy ? 'Saving…' : 'Save loan payment'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending loans by lender</CardTitle>
                <CardDescription>Active loans still owed by the shop.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lender</TableHead>
                      <TableHead>Pending principal</TableHead>
                      <TableHead>Pending interest</TableHead>
                      <TableHead>Total pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLoans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No pending loans
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeLoans.map((loan: any) => (
                        <TableRow key={loan._id}>
                          <TableCell className="font-medium">{loan.lenderName}</TableCell>
                          <TableCell>₹{Number(loan.outstandingPrincipal || 0).toFixed(2)}</TableCell>
                          <TableCell>₹{Number(loan.outstandingInterest || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            ₹
                            {(
                              Number(loan.outstandingPrincipal || 0) + Number(loan.outstandingInterest || 0)
                            ).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ReportChart
              title="Revenue mix"
              description="How sales break into COGS, shop expenses, and profit."
              type="pie"
              xKey="name"
              data={[
                { name: 'COGS', value: Number(data.totalCogs || 0), color: '#f43f5e' },
                { name: 'Shop expenses', value: Number(data.totalShopExpenses ?? data.totalMiscExpenses ?? 0), color: '#f59e0b' },
                { name: 'Gross profit', value: Math.max(0, Number(data.grossProfit || 0)), color: '#10b981' }
              ]}
              series={[{ key: 'value', name: 'Amount', color: '#10b981' }]}
            />
            <ReportChart
              title="Top items by profit"
              description="Highest gross profit items in this range."
              type="bar"
              layout="vertical"
              xKey="name"
              data={topN(
                (data.itemProfits || []).map((item: any) => ({
                  name: String(item.name || 'Item').slice(0, 22),
                  value: Number(item.profit || 0)
                })),
                8
              )}
              series={[{ key: 'value', name: 'Profit', color: '#22d3ee' }]}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item-wise Profit</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity Sold</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>COGS</TableHead>
                      <TableHead>Gross Profit</TableHead>
                      <TableHead>Profit %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.itemProfits || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No sales data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.itemProfits.map((item: any, index: number) => (
                        <TableRow key={item.variantId ? `${item.productId}:${item.variantId}` : item.productId || index}>
                          <TableCell>{item.name || item.productId}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₹{Number(item.totalRevenue).toFixed(2)}</TableCell>
                          <TableCell>₹{Number(item.cogs ?? item.totalCost).toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                              ₹{Number(item.profit).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>{Number(item.profitPercent || 0).toFixed(2)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default ProfitReport
