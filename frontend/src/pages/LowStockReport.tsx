import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import axios from 'axios'

const LowStockReport = () => {
  const [products, setProducts] = useState<any[]>([])
  const [threshold, setThreshold] = useState(10)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLowStock()
  }, [threshold])

  const fetchLowStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get('/api/reports/low-stock', {
        headers: { Authorization: `Bearer ${token}` },
        params: { threshold }
      })
      setProducts(res.data.products)
    } catch (error) {
      console.error('Error fetching low stock report:', error)
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
        title="Low Stock Report"
        description="Identify products that need restocking"
      />

      {/* Threshold Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stock Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
                min="0"
                className="w-32"
              />
            </div>
            <Button onClick={fetchLowStock}>
              Apply
            </Button>
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <p className="text-amber-800">
              Found {products.length} product(s) with stock ≤ {threshold}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Selling Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No low stock products found! Great job keeping your inventory stocked up.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: any) => (
                    <TableRow key={product.variantId ? `${product.productId}:${product.variantId}` : product._id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.sku}
                      </TableCell>
                      <TableCell>
                        {product.categoryId ? product.categoryId.name : 'Uncategorized'}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-destructive">
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell>
                        ₹{product.sellingPrice.toFixed(2)}
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

export default LowStockReport
