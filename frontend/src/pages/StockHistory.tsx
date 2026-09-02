import { useEffect, useState } from 'react'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'

const StockHistory = () => {
  const [items, setItems] = useState<any[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/inventory-transactions', { ...authHeaders(), ...listParams })
        setItems(listItems(res.data))
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || 'Unable to load stock history.')
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Stock History"
        description="Every sale, purchase, return, and adjustment is recorded here."
      />
      {errorMessage && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Inventory transactions</CardTitle>
          <CardDescription>{items.length} recent movements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Stock after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">No stock movements yet.</TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{row.productId?.name || '—'}</TableCell>
                    <TableCell className="capitalize">{row.source}</TableCell>
                    <TableCell>{row.direction}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.stockAfter}</TableCell>
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

export default StockHistory
