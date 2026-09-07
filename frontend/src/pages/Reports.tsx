import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const Reports = () => {
  const [stats, setStats] = useState<any>(null)
  const [unitReport, setUnitReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token')
        const [statsRes, unitRes] = await Promise.all([
          axios.get('/api/reports/dashboard', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('/api/reports/by-unit', {
            headers: { Authorization: `Bearer ${token}`, 'X-Business-Unit-Id': 'all' }
          })
        ])
        setStats(statsRes.data)
        setUnitReport(unitRes.data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  const reportLinks = [
    {
      title: 'Sales Report',
      path: '/reports/sales',
      description: 'View all sales transactions with date filtering'
    },
    {
      title: 'Purchase History',
      path: '/reports/purchase-history',
      description: 'Original purchase costs, never overwritten by later receipts'
    },
    {
      title: 'Inventory Report',
      path: '/reports/inventory',
      description: 'Current stock levels and valuation'
    },
    {
      title: 'Low Stock Report',
      path: '/reports/low-stock',
      description: 'Products that need restocking'
    },
    {
      title: 'Profit Report',
      path: '/reports/profit',
      description: 'Revenue, expenses, and profit margins'
    }
  ]

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reports"
        description="Review performance, track movement, and open detailed analytics for operations and finance."
      />

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.28),rgba(15,23,42,0.9))] text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-cyan-100/80">Total Products</CardDescription>
              <CardTitle className="text-3xl text-white">{stats.totalProducts}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-emerald-400/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.26),rgba(15,23,42,0.9))] text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-emerald-100/80">Monthly Sales</CardDescription>
              <CardTitle className="text-3xl text-white">₹{stats.monthlySales.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-violet-400/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.24),rgba(15,23,42,0.9))] text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-violet-100/80">Monthly Purchases</CardDescription>
              <CardTitle className="text-3xl text-white">₹{stats.monthlyPurchases.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(15,23,42,0.9))] text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-amber-100/80">Monthly Profit</CardDescription>
              <CardTitle className="text-3xl text-white">₹{stats.monthlyProfit.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {unitReport?.units && (
        <Card>
          <CardHeader>
            <CardTitle>Split by business unit</CardTitle>
            <CardDescription>
              Combined tenant totals plus Disposable, Puja, Store, and any other units. Navbar filter does not apply to this table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground">Combined sales</p>
                <p className="text-lg font-semibold">₹{Number(unitReport.combined?.sales || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground">Combined purchases</p>
                <p className="text-lg font-semibold">₹{Number(unitReport.combined?.purchases || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground">Combined expenses</p>
                <p className="text-lg font-semibold">₹{Number(unitReport.combined?.expenses || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-xl border px-4 py-3">
                <p className="text-xs text-muted-foreground">Combined profit</p>
                <p className="text-lg font-semibold">₹{Number(unitReport.combined?.profit || 0).toFixed(2)}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitReport.units.map((row: any) => (
                  <TableRow key={row.businessUnitId || 'unassigned'}>
                    <TableCell className="font-medium">{row.name} ({row.code})</TableCell>
                    <TableCell>₹{Number(row.sales || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(row.purchases || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(row.expenses || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(row.profit || 0).toFixed(2)}</TableCell>
                    <TableCell>{row.products}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {reportLinks.map((report) => (
          <Link key={report.path} to={report.path}>
            <Card className="h-full transition-all hover:-translate-y-1 hover:border-cyan-400/20 hover:shadow-[0_18px_60px_rgba(8,145,178,0.12)]">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-cyan-300">Open report</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Reports
