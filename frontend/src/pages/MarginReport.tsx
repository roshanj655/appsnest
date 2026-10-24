import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import ReportChart from '@/components/ReportChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders } from '@/lib/api'

const money = (value: number) => `₹${Number(value || 0).toFixed(2)}`

const MarginReport = () => {
  const [data, setData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'products' | 'categories' | 'monthly' | 'receivables' | 'pricing'>('products')

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const res = await axios.get('/api/reports/margins', { ...authHeaders(), params })
      setData(res.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  if (loading && !data) {
    return <div className="p-8 text-muted-foreground">Loading margin reports…</div>
  }

  const org = data?.organization || {}

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Margin & collections"
        description="Product, category, monthly, and organization margins use weighted totals from actual selling prices and snapshot COGS. Payments do not change sales revenue."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={fetchData}>Apply</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Net sales revenue</p>
            <p className="text-2xl font-semibold">{money(org.salesRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Gross profit</p>
            <p className="text-2xl font-semibold">{money(org.grossProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Gross margin</p>
            <p className="text-2xl font-semibold">{Number(org.grossMarginPercent || 0).toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Outstanding receivables</p>
            <p className="text-2xl font-semibold">{money(org.outstanding)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportChart
          title="Category gross profit"
          type="bar"
          layout="vertical"
          xKey="name"
          data={(data?.categories || []).slice(0, 8).map((row: any) => ({
            name: String(row.name || 'Category').slice(0, 18),
            value: Number(row.grossProfit || 0)
          }))}
          series={[{ key: 'value', name: 'Gross profit', color: '#10b981' }]}
        />
        <ReportChart
          title="Monthly net sales"
          type="line"
          xKey="name"
          data={(data?.monthly || []).map((row: any) => ({
            name: row.name,
            value: Number(row.salesRevenue || 0)
          }))}
          series={[{ key: 'value', name: 'Net sales', color: '#22d3ee' }]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['products', 'Product margins'],
            ['categories', 'Category margins'],
            ['monthly', 'Monthly'],
            ['receivables', 'Outstanding'],
            ['pricing', 'Price vs max / below cost']
          ] as const
        ).map(([id, label]) => (
          <Button key={id} type="button" variant={tab === id ? 'default' : 'outline'} size="sm" onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'products' && (
        <Card>
          <CardHeader>
            <CardTitle>Product-wise margin</CardTitle>
            <CardDescription>Weighted from line net revenue and immutable COGS snapshots.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Avg sell</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>COGS</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.products || []).map((row: any) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{money(row.averageSellingPrice)}</TableCell>
                    <TableCell>{money(row.salesRevenue)}</TableCell>
                    <TableCell>{money(row.cogs)}</TableCell>
                    <TableCell>{money(row.grossProfit)}</TableCell>
                    <TableCell>{Number(row.grossMarginPercent || 0).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'categories' && (
        <Card>
          <CardHeader>
            <CardTitle>Category-wise margin</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>COGS</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.categories || []).map((row: any) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{money(row.salesRevenue)}</TableCell>
                    <TableCell>{money(row.cogs)}</TableCell>
                    <TableCell>{money(row.grossProfit)}</TableCell>
                    <TableCell>{Number(row.grossMarginPercent || 0).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly profit & collections</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Margin %</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.monthly || []).map((row: any) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.invoiceCount}</TableCell>
                    <TableCell>{money(row.salesRevenue)}</TableCell>
                    <TableCell>{money(row.grossProfit)}</TableCell>
                    <TableCell>{Number(row.grossMarginPercent || 0).toFixed(2)}%</TableCell>
                    <TableCell>{money(row.paymentsReceived)}</TableCell>
                    <TableCell>{money(row.outstanding)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'receivables' && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding receivables</CardTitle>
            <CardDescription>
              Partially paid: {data?.collections?.partiallyPaid || 0} · Unpaid: {data?.collections?.unpaid || 0} ·
              Collection {Number(data?.collections?.collectionPercent || 0).toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.receivables || []).map((row: any) => (
                  <TableRow key={row.saleId}>
                    <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                    <TableCell>{row.customer}</TableCell>
                    <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                    <TableCell>{money(row.total)}</TableCell>
                    <TableCell>{money(row.amountReceived)}</TableCell>
                    <TableCell>{money(row.outstanding)}</TableCell>
                    <TableCell>{String(row.paymentStatus || '').replace('_', ' ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'pricing' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Actual vs max selling price</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.priceVsMax || []).slice(0, 50).map((row: any, index: number) => (
                    <TableRow key={`${row.invoiceNumber}-${index}`}>
                      <TableCell>{row.invoiceNumber}</TableCell>
                      <TableCell>{row.product}</TableCell>
                      <TableCell>{money(row.maxSellingPrice)}</TableCell>
                      <TableCell>{money(row.actualSellingPrice)}</TableCell>
                      <TableCell>{money(row.difference)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Below-cost / loss-making lines</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.belowCost || []).slice(0, 50).map((row: any, index: number) => (
                    <TableRow key={`${row.invoiceNumber}-loss-${index}`}>
                      <TableCell>{row.invoiceNumber}</TableCell>
                      <TableCell>{row.product}</TableCell>
                      <TableCell>{money(row.costPerUnit)}</TableCell>
                      <TableCell>{money(row.actualSellingPrice)}</TableCell>
                      <TableCell className="text-red-700">{money(row.loss)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default MarginReport
