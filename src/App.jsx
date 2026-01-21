
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import PublicRegister from './pages/auth/PublicRegister'
import Layout from './components/layout/Layout'
import Dashboard from './pages/dashboard/Dashboard'
import Register from './pages/dashboard/Register'
import Profile from './pages/dashboard/Profile'
import BranchList from './pages/admin/branches/BranchList'
import ProductList from './pages/admin/products/ProductList'
import CombosList from './pages/admin/config/CombosList'
import NetworkTree from './pages/dashboard/NetworkTree'
import POS from './pages/shop/POS'
import InventoryList from './pages/admin/inventory/InventoryList'
import RanksConfig from './pages/admin/config/RanksConfig'
import Earnings from './pages/dashboard/Earnings'
import AdminSales from './pages/admin/reports/GlobalSales' // Renamed from GlobalSales
import LiquidationManager from './pages/admin/finances/LiquidationManager'
import UserList from './pages/admin/users/UserList'
import Withdrawals from './pages/dashboard/Withdrawals'
import PayoutManager from './pages/admin/finances/PayoutManager'
import CareerPath from './pages/dashboard/CareerPath'
import Royalties from './pages/dashboard/Royalties'
import RoyaltiesConfig from './pages/admin/config/RoyaltiesConfig'
import OrderApproval from './pages/admin/sales/OrderApproval'
import RewardsManager from './pages/admin/finances/RewardsManager'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<PublicRegister />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="network" element={<NetworkTree />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="royalties" element={<Royalties />} />
            <Route path="withdrawals" element={<Withdrawals />} />
            <Route path="career" element={<CareerPath />} />
            <Route path="shop" element={<POS />} />
            <Route path="register-affiliate" element={<Register />} />
            <Route path="admin/users" element={<UserList />} />
            <Route path="admin/branches" element={<BranchList />} />
            <Route path="admin/products" element={<ProductList />} />
            <Route path="admin/inventory" element={<InventoryList />} />
            <Route path="admin/ranks" element={<RanksConfig />} />
            <Route path="admin/liquidations" element={<LiquidationManager />} />
            <Route path="admin/payouts" element={<PayoutManager />} />
            <Route path="admin/combos" element={<CombosList />} />
            <Route path="admin/royalties" element={<RoyaltiesConfig />} />
            <Route path="admin/reports" element={<AdminSales />} />
            <Route path="admin/order-approval" element={<OrderApproval />} />
            <Route path="admin/rewards" element={<RewardsManager />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
