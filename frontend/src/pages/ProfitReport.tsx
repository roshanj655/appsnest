import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import axios from 'axios'

const ProfitReport = () => {
  const [data, setData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

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
    } catch (error) {
      console.error('Error fetching profit report:', error)
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
        title="Profit Report"
        description="Analyze revenue, expenses, and profitability"
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
              <Button onClick={fetchProfit}>
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

      {data && (
        <>
          {/* Profit Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-6">
                <div className="text-xs text-emerald-600 font-medium">Total Revenue</div>
                <div className="text-3xl font-bold text-emerald-700">₹{data.totalSales.toFixed(2)}</div>
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
                <div className="text-xs text-orange-600 font-medium">Misc Expenses</div>
                <div className="text-3xl font-bold text-orange-700">₹{(data.totalMiscExpenses || 0).toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`${
              data.grossProfit >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
            }`}>
              <CardContent className="p-6">
                <div className={`text-xs font-medium ${
                  data.grossProfit >= 0 ? 'text-amber-600' : 'text-red-600'
                }`}>Gross Profit</div>
                <div className={`text-3xl font-bold ${
                  data.grossProfit >= 0 ? 'text-amber-700' : 'text-red-700'
                }`}>₹{data.grossProfit.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className={`${
              data.profitMargin >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
            }`}>
              <CardContent className="p-6">
                <div className={`text-xs font-medium ${
                  data.profitMargin >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>Profit Margin</div>
                <div className={`text-3xl font-bold ${
                  data.profitMargin >= 0 ? 'text-blue-700' : 'text-red-700'
                }`}>{data.profitMargin.toFixed(2)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Item-wise Profit Table */}
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
                    {data.itemProfits.length === 0 ? (
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
