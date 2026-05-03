import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { CurrencyProvider } from './context/CurrencyContext'
import PrivateRoute from './routes/PrivateRoute'
import PublicRoute from './routes/PublicRoute'
import AuthLayout from './layouts/AuthLayout'
import AppLayout from './layouts/AppLayout'

// --- Page components (lazy-loaded for route-level code splitting) ---
const Login             = lazy(() => import('./pages/auth/Login'))
const ForgotPassword    = lazy(() => import('./pages/auth/ForgotPassword'))
const OtpVerify         = lazy(() => import('./pages/auth/OtpVerify'))
const NewPassword       = lazy(() => import('./pages/auth/NewPassword'))
const Dashboard         = lazy(() => import('./pages/dashboard/Dashboard'))
const Users             = lazy(() => import('./pages/users/Users'))
const Roles             = lazy(() => import('./pages/roles/Roles'))
const RolePermissions   = lazy(() => import('./pages/roles/RolePermissions'))
const Permissions       = lazy(() => import('./pages/permissions/Permissions'))
const Profile           = lazy(() => import('./pages/profile/Profile'))
const Categories        = lazy(() => import('./pages/inventory/Categories'))
const Brands            = lazy(() => import('./pages/inventory/Brands'))
const Units             = lazy(() => import('./pages/inventory/Units'))
const Products          = lazy(() => import('./pages/inventory/Products'))
const ProductModifiers  = lazy(() => import('./pages/inventory/ProductModifiers'))
const ProductComboItems = lazy(() => import('./pages/inventory/ProductComboItems'))
const Customers         = lazy(() => import('./pages/customers/Customers'))
const CustomerSales     = lazy(() => import('./pages/customers/CustomerSales'))
const Suppliers         = lazy(() => import('./pages/suppliers/Suppliers'))
const Orders            = lazy(() => import('./pages/sales/Orders'))
const OrderDetail       = lazy(() => import('./pages/sales/OrderDetail'))
const OrderForm         = lazy(() => import('./pages/sales/OrderForm'))
const CollectionReceipt = lazy(() => import('./pages/sales/CollectionReceipt'))
const SalesInvoice      = lazy(() => import('./pages/sales/SalesInvoice'))
const Purchases         = lazy(() => import('./pages/purchases/Purchases'))
const PurchaseForm      = lazy(() => import('./pages/purchases/PurchaseForm'))
const PurchaseProducts  = lazy(() => import('./pages/purchases/PurchaseProducts'))
const PosLayout         = lazy(() => import('./pages/pos/PosLayout'))
const PosIndex          = lazy(() => import('./pages/pos/PosIndex'))
const PosTableSelect    = lazy(() => import('./pages/pos/PosTableSelect'))
const PosOrdering       = lazy(() => import('./pages/pos/PosOrdering'))
const PosInvoice        = lazy(() => import('./pages/pos/PosInvoice'))
const PaymentMethods    = lazy(() => import('./pages/payment-methods/PaymentMethods'))
const SaleReport        = lazy(() => import('./pages/reports/SaleReport'))
const SaleSummary       = lazy(() => import('./pages/reports/SaleSummary'))
const InventoryReport   = lazy(() => import('./pages/reports/InventoryReport'))
const PurchaseReport    = lazy(() => import('./pages/reports/PurchaseReport'))
const ProfitLossReport  = lazy(() => import('./pages/reports/ProfitLossReport'))
const Currencies        = lazy(() => import('./pages/currencies/Currencies'))
const Settings          = lazy(() => import('./pages/settings/Settings'))
const AssemblyTemplates = lazy(() => import('./pages/assembly/AssemblyTemplates'))
const StockAssemblies   = lazy(() => import('./pages/assembly/StockAssemblies'))
const StockAssemblyForm = lazy(() => import('./pages/assembly/StockAssemblyForm'))
const StockAssemblyDetail = lazy(() => import('./pages/assembly/StockAssemblyDetail'))
const ProductBundles    = lazy(() => import('./pages/product-bundles/ProductBundles'))
const Tables            = lazy(() => import('./pages/restaurant/Tables'))
const KitchenTicket     = lazy(() => import('./pages/pos/KitchenTicket'))
const Vouchers          = lazy(() => import('./pages/vouchers/Vouchers'))
const NotFound          = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-900">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <CurrencyProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes (redirect to dashboard if logged in) */}
            <Route element={<PublicRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-otp" element={<OtpVerify />} />
                <Route path="/reset-password" element={<NewPassword />} />
              </Route>
            </Route>

            {/* Private routes (redirect to login if not authenticated) */}
            <Route element={<PrivateRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/roles/:id/permissions" element={<RolePermissions />} />
                <Route path="/permissions" element={<Permissions />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/units" element={<Units />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id/modifiers" element={<ProductModifiers />} />
                <Route path="/products/:id/combo-items" element={<ProductComboItems />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id/sales" element={<CustomerSales />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/sales" element={<Orders />} />
                <Route path="/sales/create" element={<OrderForm />} />
                <Route path="/sales/:id" element={<OrderDetail />} />
                <Route path="/sales/:id/edit" element={<OrderForm />} />
                <Route path="/sales/:id/invoice" element={<SalesInvoice />} />
                <Route path="/sales/:id/collection/:txnId" element={<CollectionReceipt />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/purchases/create" element={<PurchaseForm />} />
                <Route path="/purchases/:id/edit" element={<PurchaseForm />} />
                <Route path="/purchases/:id/products" element={<PurchaseProducts />} />
                {/* PosInvoice and KitchenTicket are independent — NOT wrapped in PosProvider */}
                <Route path="/pos/invoice/:orderId" element={<PosInvoice />} />
                <Route path="/pos/kitchen-ticket/:saleId" element={<KitchenTicket />} />
                {/* All other POS routes share PosProvider via PosLayout */}
                <Route path="/pos" element={<PosLayout />}>
                  <Route index element={<PosIndex />} />
                  <Route path="tables" element={<PosTableSelect />} />
                  <Route path="table/:tableId" element={<PosOrdering />} />
                  <Route path="walk-in" element={<PosOrdering />} />
                  <Route path="takeaway" element={<PosOrdering />} />
                </Route>
                <Route path="/payment-methods" element={<PaymentMethods />} />
                <Route path="/product-bundles" element={<ProductBundles />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/vouchers" element={<Vouchers />} />
                <Route path="/reports/sales" element={<SaleReport />} />
                <Route path="/reports/summary" element={<SaleSummary />} />
                <Route path="/reports/inventory" element={<InventoryReport />} />
                <Route path="/reports/purchases" element={<PurchaseReport />} />
                <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
                <Route path="/currencies" element={<Currencies />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/assembly-templates" element={<AssemblyTemplates />} />
                <Route path="/stock-assemblies" element={<StockAssemblies />} />
                <Route path="/stock-assemblies/create" element={<StockAssemblyForm />} />
                <Route path="/stock-assemblies/:id" element={<StockAssemblyDetail />} />
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: '12px', fontSize: '14px' },
              success: { duration: 3000 },
              error: { duration: 4000 },
            }}
            containerStyle={{ zIndex: 9999 }}
          />
        </Suspense>
        </CurrencyProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
