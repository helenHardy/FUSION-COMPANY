
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
import PendingActivations from './pages/admin/users/PendingActivations'
import AdminNetworkTree from './pages/admin/users/AdminNetworkTree'
import Withdrawals from './pages/dashboard/Withdrawals'
import PayoutManager from './pages/admin/finances/PayoutManager'
import CareerPath from './pages/dashboard/CareerPath'
import Royalties from './pages/dashboard/Royalties'
import RoyaltiesConfig from './pages/admin/config/RoyaltiesConfig'
import OrderApproval from './pages/admin/sales/OrderApproval'
import RewardsManager from './pages/admin/finances/RewardsManager'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!user) return <Navigate to="/login" />
  return children
}

const RoleGuard = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }
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
            <Route path="admin/users" element={<RoleGuard allowedRoles={['admin']}><UserList /></RoleGuard>} />
            <Route path="admin/network/:userId" element={<RoleGuard allowedRoles={['admin']}><AdminNetworkTree /></RoleGuard>} />
            <Route path="admin/pending-activations" element={<RoleGuard allowedRoles={['admin']}><PendingActivations /></RoleGuard>} />
            <Route path="admin/branches" element={<RoleGuard allowedRoles={['admin']}><BranchList /></RoleGuard>} />
            <Route path="admin/products" element={<RoleGuard allowedRoles={['admin']}><ProductList /></RoleGuard>} />
            <Route path="admin/inventory" element={<RoleGuard allowedRoles={['admin']}><InventoryList /></RoleGuard>} />
            <Route path="admin/ranks" element={<RoleGuard allowedRoles={['admin']}><RanksConfig /></RoleGuard>} />
            <Route path="admin/liquidations" element={<RoleGuard allowedRoles={['admin']}><LiquidationManager /></RoleGuard>} />
            <Route path="admin/payouts" element={<RoleGuard allowedRoles={['admin']}><PayoutManager /></RoleGuard>} />
            <Route path="admin/combos" element={<RoleGuard allowedRoles={['admin']}><CombosList /></RoleGuard>} />
            <Route path="admin/royalties" element={<RoleGuard allowedRoles={['admin']}><RoyaltiesConfig /></RoleGuard>} />
            <Route path="admin/reports" element={<RoleGuard allowedRoles={['admin', 'sucursal', 'cajero']}><AdminSales /></RoleGuard>} />
            <Route path="admin/order-approval" element={<RoleGuard allowedRoles={['admin', 'sucursal', 'cajero']}><OrderApproval /></RoleGuard>} />
            <Route path="admin/rewards" element={<RoleGuard allowedRoles={['admin']}><RewardsManager /></RoleGuard>} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
