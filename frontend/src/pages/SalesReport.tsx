import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import axios from 'axios'

const SalesReport = () => {
  const [sales, setSales] = useState<any[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSales()
  }, [startDate, endDate])

  const fetchSales = async () => {
    try {
      const token = localStorage.getItem('token')
      const params: any = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const res = await axios.get('/api/reports/sales', {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      setSales(res.data.sales)
      setTotalAmount(res.data.totalAmount)
    } catch (error) {
      console.error('Error fetching sales report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader 
        title="Sales Report"
        description="View and filter your sales transactions"
        actions={
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="p-4">
              <div className="text-xs text-emerald-600 font-medium">Total Sales</div>
              <div className="text-2xl font-bold text-emerald-700">₹{totalAmount.toFixed(2)}</div>
            </CardContent>
          </Card>
        }
      />

      {/* Filters */}
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
              <Button onClick={fetchSales}>
                Apply Filters
              </Button>
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

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale: any) => (
                    <TableRow key={sale._id}>
                      <TableCell className="font-medium text-primary">
                        {sale.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {sale.customerId ? sale.customerId.name : 'Walk-in Customer'}
                      </TableCell>
                      <TableCell>
                        {sale.items.length} item(s)
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₹{sale.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {sale.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesReport
