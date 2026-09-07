import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import axios from 'axios'

const InventoryReport = () => {
  const [products, setProducts] = useState<any[]>([])
  const [totalStockValue, setTotalStockValue] = useState(0)
  const [totalSellingValue, setTotalSellingValue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await axios.get('/api/reports/inventory', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setProducts(res.data.products)
        setTotalStockValue(res.data.totalStockValue)
        setTotalSellingValue(res.data.totalSellingValue)
      } catch (error) {
        console.error('Error fetching inventory report:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [])

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
        title="Inventory Report"
        description="View current stock levels and inventory valuation"
        actions={
          <div className="flex gap-4">
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-4">
                <div className="text-xs text-blue-600 font-medium">Stock Value</div>
                <div className="text-2xl font-bold text-blue-700">₹{totalStockValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="p-4">
                <div className="text-xs text-emerald-600 font-medium">Selling Value</div>
                <div className="text-2xl font-bold text-emerald-700">₹{totalSellingValue.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        }
      />

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Current stock</TableHead>
                  <TableHead>Average cost</TableHead>
                  <TableHead>Last purchase cost</TableHead>
                  <TableHead>Inventory value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                      No products in inventory
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: any) => (
                    <TableRow key={product.variantId ? `${product.productId}:${product.variantId}` : product.productId || product._id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.variantName || '—'}</TableCell>
                      <TableCell>{product.warehouseName || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${
                          Number(product.currentStock ?? product.stock) <= 10 ? 'text-destructive' : 'text-foreground'
                        }`}>
                          {product.currentStock ?? product.stock}
                        </span>
                      </TableCell>
                      <TableCell>₹{Number(product.averageCost ?? 0).toFixed(2)}</TableCell>
                      <TableCell>₹{Number(product.lastPurchaseCost ?? product.purchasePrice ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">
                        ₹{Number(product.inventoryValue ?? product.stockValue ?? 0).toFixed(2)}
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

export default InventoryReport
