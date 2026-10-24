import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import ReportChart from '@/components/ReportChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listItems, listParams } from '@/lib/api'

const Dashboard = () => {
  const [stats, setStats] = useState<any>(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (user.role === 'superadmin') {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        const [statsRes, productsRes] = await Promise.all([
          axios.get('/api/reports/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` }, ...listParams })
        ])
        setStats(statsRes.data)
        setProducts(listItems(productsRes.data))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (user.role === 'superadmin') {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Super admin"
          description="Platform overview. Tenant accounts live under Businesses."
        />
        <Card>
          <CardHeader>
            <CardTitle>Hello, {user.name}</CardTitle>
            <CardDescription>Use the sidebar to manage tenants without mixing that work into this home screen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/businesses">Businesses</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/register">Register business</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Business Dashboard"
        description="Track performance, monitor inventory, and keep an eye on what needs attention today."
      />

      <Card className="mb-6 overflow-hidden border-cyan-400/15 bg-[linear-gradient(135deg,rgba(8,47,73,0.65),rgba(15,23,42,0.92))] text-white">
        <CardHeader>
          <CardDescription className="text-cyan-200/70">Welcome back</CardDescription>
          <CardTitle className="text-2xl font-medium text-white">Hello, {user.name}</CardTitle>
          <CardDescription className="text-slate-300">
            {user.business?.businessName} | Tenant ID: {user.business?.tenantId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/pos">Open POS</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/sales">Sales register</Link>
          </Button>
        </CardContent>
      </Card>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Sales</CardDescription>
              <CardTitle className="text-2xl font-medium text-emerald-300">₹{(stats.todaySales || 0).toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Purchases</CardDescription>
              <CardTitle className="text-2xl font-medium text-amber-300">₹{(stats.todayPurchases || 0).toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Profit</CardDescription>
              <CardTitle className="text-2xl font-medium text-violet-300">₹{(stats.todayProfit || 0).toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Low Stock Items</CardDescription>
              <CardTitle className="text-2xl font-medium text-cyan-300">{stats.lowStockProducts}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ReportChart
            title="Monthly overview"
            description="Sales, purchases, expenses, and profit this month."
            type="bar"
            xKey="name"
            data={[
              { name: 'Sales', value: Number(stats.monthlySales || 0) },
              { name: 'Purchases', value: Number(stats.monthlyPurchases || 0) },
              { name: 'Expenses', value: Number(stats.monthlyExpenses || 0) },
              { name: 'Profit', value: Number(stats.monthlyProfit || 0) }
            ]}
            series={[{ key: 'value', name: 'Amount', color: '#22d3ee' }]}
          />
          <ReportChart
            title="Top products"
            description="Highest quantity sold."
            type="bar"
            layout="vertical"
            valueFormat="number"
            xKey="name"
            data={(stats.topProducts || []).map((row: any) => ({
              name: String(row.name || 'Product').slice(0, 22),
              value: Number(row.quantity || 0)
            }))}
            series={[{ key: 'value', name: 'Qty sold', color: '#10b981' }]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats.recentSales || []).map((sale: any) => (
                <div key={sale._id} className="flex justify-between text-sm">
                  <span>{sale.invoiceNumber} · {sale.customerId?.name || 'Walk-in'}</span>
                  <span>₹{Number(sale.total || 0).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent Purchases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats.recentPurchases || []).map((purchase: any) => (
                <div key={purchase._id} className="flex justify-between text-sm">
                  <span>{purchase.invoiceNumber} · {purchase.supplierId?.name || 'Supplier'}</span>
                  <span>₹{Number(purchase.total || 0).toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product Snapshot</CardTitle>
          <CardDescription>Quick view of the current catalog and stock movement.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product: any) => (
              <Card key={product._id} className="border-white/10 bg-white/[0.03]">
                <CardContent className="p-5">
                  <h3 className="mb-1 text-sm font-medium text-slate-50">{product.name}</h3>
                  <p className="mb-2 text-sm text-slate-400">SKU: {product.sku}</p>
                  <p className="mb-2 text-base font-medium text-emerald-300">₹{product.sellingPrice}</p>
                  <p className={product.stock <= 10 ? 'text-sm font-medium text-red-300' : 'text-sm font-medium text-cyan-300'}>
                    Stock: {product.stock}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
