import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import PageHeader from '../components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authHeaders, listItems, listParams } from '@/lib/api'

const StockHistory = () => {
  const [params] = useSearchParams()
  const productId = params.get('productId') || ''
  const [items, setItems] = useState<any[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const query = productId
          ? { ...authHeaders(), params: { ...listParams.params, productId, limit: 200 } }
          : { ...authHeaders(), ...listParams }
        const res = await axios.get(productId ? '/api/inventory/cost-history' : '/api/inventory/transactions', query)
        setItems(listItems(res.data).length ? listItems(res.data) : res.data.items || [])
      } catch (err: any) {
        setErrorMessage(err.response?.data?.message || 'Unable to load stock history.')
      }
    }
    load()
  }, [productId])

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={productId ? 'Cost history' : 'Stock History'}
        description="Every purchase, sale, return, and adjustment is recorded with the cost used at that time."
      />
      {errorMessage && (
        <div className="rounded-xl border border-red-600/30 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Inventory transactions</CardTitle>
          <CardDescription>{items.length} movements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Avg cost after</TableHead>
                <TableHead>Stock after</TableHead>
                <TableHead>Value after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">No stock movements yet.</TableCell>
                </TableRow>
              ) : (
                items.map((row: any, index: number) => (
                  <TableRow key={row._id || index}>
                    <TableCell>{new Date(row.date || row.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{row.transactionType || row.source}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>₹{Number(row.unitCost || 0).toFixed(2)}</TableCell>
                    <TableCell>₹{Number(row.averageCostAfter || 0).toFixed(2)}</TableCell>
                    <TableCell>{row.stockAfter}</TableCell>
                    <TableCell>₹{Number(row.inventoryValueAfter || 0).toFixed(2)}</TableCell>
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
