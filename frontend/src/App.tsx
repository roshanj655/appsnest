import { BrowserRouter as Router, Outlet, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Customers from './pages/Customers'
import Suppliers from './pages/Suppliers'
import Sales from './pages/Sales'
import Pos from './pages/Pos'
import Purchases from './pages/Purchases'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import SalesReport from './pages/SalesReport'
import PurchasesReport from './pages/PurchasesReport'
import PurchaseHistory from './pages/PurchaseHistory'
import InventoryReport from './pages/InventoryReport'
import LowStockReport from './pages/LowStockReport'
import ProfitReport from './pages/ProfitReport'
import PersonalExpensesReport from './pages/PersonalExpensesReport'
import MarginReport from './pages/MarginReport'
import AuditLogs from './pages/AuditLogs'
import Businesses from './pages/Businesses'
import StockAdjustments from './pages/StockAdjustments'
import StockHistory from './pages/StockHistory'
import Expenses from './pages/Expenses'
import Loans from './pages/Loans'
import BusinessUnits from './pages/BusinessUnits'

const DashboardLayout = () => {
  return (
    <div className="erp-shell min-h-screen">
      <Navbar />
      <main className="min-h-screen lg:pl-64">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            <Route path="/register" element={<Register />} />
          <Route path="/businesses" element={<Businesses />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/stock-adjustments" element={<StockAdjustments />} />
          <Route path="/stock-history" element={<StockHistory />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/business-units" element={<BusinessUnits />} />
          <Route path="/inventory" element={<InventoryReport />} />
          <Route path="/inventory/low-stock" element={<LowStockReport />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/pos" element={<Pos />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/sales" element={<SalesReport />} />
          <Route path="/reports/purchases" element={<PurchasesReport />} />
          <Route path="/reports/purchase-history" element={<PurchaseHistory />} />
          <Route path="/reports/inventory" element={<InventoryReport />} />
          <Route path="/reports/low-stock" element={<LowStockReport />} />
          <Route path="/reports/profit" element={<ProfitReport />} />
          <Route path="/reports/personal-expenses" element={<PersonalExpensesReport />} />
          <Route path="/reports/margins" element={<MarginReport />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
