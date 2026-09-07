import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import axios from 'axios'
import { authHeaders } from '@/lib/api'

const PurchaseHistory = () => {
  const [items, setItems] = useState<any[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchRows = async () => {
    try {
      const params: Record<string, string> = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const res = await axios.get('/api/reports/purchase-history', { ...authHeaders(), params })
      setItems(res.data.items || res.data.purchases || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [startDate, endDate])

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Purchase History"
        description="Each purchase keeps its original unit cost. Later purchases do not overwrite these rows."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={fetchRows}>Apply</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Purchase cost</TableHead>
                <TableHead>Total cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">No purchase lines yet.</TableCell>
                </TableRow>
              ) : (
                items.map((row: any, index: number) => (
                  <TableRow key={`${row.purchaseId}-${index}`}>
                    <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                    <TableCell>{row.supplier}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.variantName || '—'}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>₹{Number(row.purchaseCost).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(row.totalCost).toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default PurchaseHistory
