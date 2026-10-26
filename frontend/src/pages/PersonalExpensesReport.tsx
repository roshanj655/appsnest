import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ReportChart from '@/components/ReportChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders } from '@/lib/api'

const PersonalExpensesReport = () => {
  const [data, setData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const res = await axios.get('/api/reports/personal-expenses', { ...authHeaders(), params })
      setData(res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [startDate, endDate])

  if (loading && !data) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Personal & home draws"
        description="Shop cash used for home, family, or personal needs — not shop operating cost."
        actions={
          <Button asChild variant="outline">
            <Link to="/expenses">Add personal / home payment</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="pe-start">Start Date</Label>
              <Input id="pe-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-end">End Date</Label>
              <Input id="pe-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button type="button" onClick={fetchReport}>Apply</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Total drawn from shop</p>
                <p className="text-3xl font-semibold">₹{Number(data.total || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Entries</p>
                <p className="text-3xl font-semibold">{Number(data.count || 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Note</p>
                <p className="text-sm text-muted-foreground">{data.note}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ReportChart
              title="By category"
              description="Personal, home, and family draws."
              type="pie"
              xKey="name"
              data={(data.byCategory || []).map((row: any) => ({
                name: String(row.category || 'other'),
                value: Number(row.amount || 0)
              }))}
              series={[{ key: 'value', name: 'Amount', color: '#f59e0b' }]}
            />
            <ReportChart
              title="Recent draws"
              description="Largest personal/home payments in this range."
              type="bar"
              layout="vertical"
              xKey="name"
              data={[...(data.items || [])]
                .slice(0, 8)
                .map((row: any) => ({
                  name: String(row.title || 'Draw').slice(0, 22),
                  value: Number(row.amount || 0)
                }))}
              series={[{ key: 'value', name: 'Amount', color: '#38bdf8' }]}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment list</CardTitle>
              <CardDescription>{(data.items || []).length} records</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.items || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No personal or home payments yet. Add them under Misc Expenses with type Personal / Home.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data.items || []).map((row: any) => (
                      <TableRow key={row._id}>
                        <TableCell>{row.expenseDate ? String(row.expenseDate).slice(0, 10) : '—'}</TableCell>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell className="capitalize">{row.category}</TableCell>
                        <TableCell>₹{Number(row.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>{row.notes || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export default PersonalExpensesReport
