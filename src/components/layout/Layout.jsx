
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard, Users, User, Store, Package, LogOut,
    BarChart, GitBranch, Boxes, Trophy, DollarSign, Wallet,
    BadgeDollarSign, Crown, ShoppingBag, Menu, X, Bell, Search,
    Sun, Moon, CheckCircle, UserCheck
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import logo from '../../assets/logo-icon.png'

export default function Layout() {
    const { signOut, profile } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const menuItems = [
        { path: '/', label: 'Escritorio', icon: <LayoutDashboard size={20} /> },
        { path: '/network', label: 'Mi Red', icon: <GitBranch size={20} /> },
        { path: '/earnings', label: 'Mis Ganancias', icon: <DollarSign size={20} /> },
        { path: '/royalties', label: 'Bonos Regalías', icon: <BadgeDollarSign size={20} /> },
        { path: '/withdrawals', label: 'Retiros', icon: <Wallet size={20} /> },
        { path: '/career', label: 'Carrera Pro', icon: <Trophy size={20} /> },
        { path: '/shop', label: 'Tienda', icon: <ShoppingBag size={20} /> },
        { path: '/profile', label: 'Mi Perfil', icon: <User size={20} /> },
        { path: '/register-affiliate', label: 'Registrar Afiliado', icon: <Users size={20} /> },
    ]

    const adminItems = [
        { path: '/admin/users', label: 'Usuarios', icon: <Users size={20} /> },
        { path: '/admin/pending-activations', label: 'Activaciones', icon: <UserCheck size={20} /> },
        { path: '/admin/branches', label: 'Store', icon: <Store size={20} /> },
        { path: '/admin/products', label: 'Productos', icon: <Package size={20} /> },
        { path: '/admin/combos', label: 'Combos', icon: <ShoppingBag size={20} /> },
        { path: '/admin/inventory', label: 'Inventario', icon: <Boxes size={20} /> },
        { path: '/admin/ranks', label: 'Rangos', icon: <Crown size={20} /> },
        { path: '/admin/royalties', label: 'Regalías', icon: <GitBranch size={20} /> },
        { path: '/admin/reports', label: 'Reporte Global', icon: <BarChart size={20} /> },
        { path: '/admin/order-approval', label: 'Aprobar Pedidos', icon: <CheckCircle size={20} /> },
        { path: '/admin/rewards', label: 'Gestión Premios', icon: <Trophy size={20} /> },
        { path: '/admin/liquidations', label: 'Liquidaciones', icon: <BadgeDollarSign size={20} /> },
        { path: '/admin/payouts', label: 'Pagos/Billetera', icon: <Wallet size={20} /> },
    ]

    const NavItem = ({ item, onClick }) => {
        const active = location.pathname === item.path
        return (
            <Link
                to={item.path}
                onClick={onClick}
                className={`nav-item ${active ? 'active' : ''}`}
            >
                <div className="icon-box">{item.icon}</div>
                <span>{item.label}</span>
                {active && <div className="active-glow" />}
            </Link>
        )
    }

    return (
        <div className="layout-root">
            {/* Sidebar Overlay (Mobile) */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar glass-dark ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="brand-box">
                        <div className="brand-logo">
                            <img src={logo} alt="Logo" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
                        </div>
                        <div className="brand-text">
                            <span className="brand-name">FUSION</span>
                            <span className="brand-tag">COMPANY</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="close-btn mobile-only">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-title">Navegación</div>
                    {menuItems.map((item) => (
                        <NavItem key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
                    ))}

                    {(profile?.role === 'admin' || profile?.role === 'sucursal') && (
                        <>
                            <div className="nav-section-title admin">
                                {profile?.role === 'admin' ? 'Administración' : 'Gestión Sucursal'}
                            </div>
                            {adminItems
                                .filter(item => {
                                    if (profile?.role === 'sucursal') {
                                        return item.path === '/admin/order-approval' || item.path === '/shop'
                                    }
                                    return true
                                })
                                .map((item) => (
                                    <NavItem key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
                                ))}
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleSignOut} className="logout-btn">
                        <LogOut size={18} /> <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="main-wrapper">
                {/* Modern Header */}
                <header className="top-header glass">
                    <div className="header-left">
                        <button onClick={() => setSidebarOpen(true)} className="menu-toggle mobile-only">
                            <Menu size={24} />
                        </button>
                        <h2 className="page-title">{
                            [...menuItems, ...adminItems].find(i => i.path === location.pathname)?.label || 'Escritorio'
                        }</h2>
                    </div>

                    <div className="header-right">
                        <div className="search-box pc-only">
                            <Search size={18} />
                            <input type="text" placeholder="Buscar..." />
                        </div>
                        <button
                            className="icon-btn theme-toggle"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button className="icon-btn"><Bell size={20} /></button>
                        <div className="user-profile">
                            <div className="user-info pc-only">
                                <span className="user-name">{profile?.full_name}</span>
                                <span className="user-role">{profile?.role}</span>
                            </div>
                            <div className="user-avatar">
                                {profile?.full_name?.charAt(0) || 'U'}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="content-area">
                    <div className="content-container">
                        <Outlet />
                    </div>
                </main>
            </div>

            <style>{`
                .layout-root {
                    display: flex;
                    min-height: 100vh;
                    width: 100%;
                    background-color: var(--bg-color);
                    color: var(--text-main);
                }

                /* Sidebar Styles */
                .sidebar {
                    width: 280px;
                    height: 100vh;
                    position: fixed;
                    left: 0;
                    top: 0;
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                    background: var(--sidebar-bg);
                    border-right: 1px solid var(--border-color);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
                }

                .sidebar-header {
                    padding: 2.5rem 1.5rem;
                }

                .brand-box {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .brand-logo {
                    width: 48px;
                    height: 48px;
                    background: transparent;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 900;
                    font-size: 1.4rem;
                    font-family: 'Outfit', sans-serif;
                }

                .brand-text {
                    display: flex;
                    flex-direction: column;
                }

                .brand-name {
                    color: var(--text-main);
                    font-weight: 900;
                    font-size: 1.1rem;
                    letter-spacing: -0.5px;
                    font-family: 'Outfit', sans-serif;
                    line-height: 1;
                }

                .brand-tag {
                    font-size: 0.6rem;
                    color: var(--primary-color);
                    font-weight: 900;
                    letter-spacing: 1.5px;
                    margin-top: -2px;
                }

                .sidebar-nav {
                    flex: 1;
                    padding: 0 1rem;
                    overflow-y: auto;
                }

                .nav-section-title {
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: var(--text-dim);
                    padding: 1.5rem 1rem 0.75rem;
                    letter-spacing: 1.5px;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 0.6rem 0.85rem;
                    color: var(--sidebar-text);
                    text-decoration: none;
                    border-radius: 12px;
                    margin-bottom: 2px;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .nav-item:hover {
                    background: var(--sidebar-hover);
                    color: var(--sidebar-active);
                }

                .nav-item.active {
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--primary-color);
                    font-weight: 600;
                }

                .icon-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    transition: all 0.25s ease;
                }

                .nav-item.active .icon-box {
                    background: var(--primary-color);
                    color: white;
                    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
                }

                .sidebar-footer {
                    padding: 1.5rem;
                    border-top: 1px solid var(--border-color);
                }

                .logout-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 0.875rem;
                    background: rgba(239, 68, 68, 0.08);
                    border: 1px solid rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }

                .logout-btn:hover {
                    background: #f87171;
                    color: white;
                    transform: translateY(-2px);
                }

                /* Main Wrapper Styles */
                .main-wrapper {
                    flex: 1;
                    margin-left: 280px;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    background: var(--bg-color);
                }

                .top-header {
                    height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 2.5rem;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: var(--bg-color);
                    border-bottom: 1px solid var(--border-color);
                }

                .header-left { display: flex; align-items: center; gap: 1rem; }
                .page-title { 
                    margin: 0; 
                    font-size: clamp(1.2rem, 4vw, 1.6rem); 
                    color: var(--text-main); 
                    font-family: 'Outfit', sans-serif;
                    font-weight: 950;
                    letter-spacing: -0.04em;
                    line-height: 1;
                }

                .header-right { display: flex; align-items: center; gap: 1.5rem; }

                .search-box {
                    display: flex;
                    align-items: center;
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 0.5rem 1rem;
                    gap: 10px;
                    width: 240px;
                }

                .search-box input {
                    background: none;
                    border: none;
                    color: var(--text-main);
                    outline: none;
                    width: 100%;
                    font-size: 0.9rem;
                }

                .icon-btn {
                    background: var(--input-bg);
                    border: 1px solid var(--border-color);
                    color: var(--text-muted);
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .icon-btn:hover { color: var(--primary-color); background: var(--sidebar-hover); }

                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding-left: 1.5rem;
                    border-left: 1px solid var(--border-color);
                }

                .user-info { display: flex; flex-direction: column; text-align: right; }
                .user-name { font-weight: 600; font-size: 0.95rem; color: var(--text-main); }
                .user-role { font-size: 0.75rem; color: var(--primary-color); font-weight: 700; text-transform: uppercase; }

                .user-avatar {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    background: var(--fusion-gradient);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 800;
                    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
                }

                .content-area {
                    flex: 1;
                    padding: 2.5rem;
                }

                .content-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    animation: contentEntrance 0.6s ease-out;
                }

                @keyframes contentEntrance {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .mobile-only { display: none; }

                /* Mobile Optimization */
                @media (max-width: 992px) {
                    .sidebar { transform: translateX(-100%); }
                    .sidebar.open { transform: translateX(0); }
                    .sidebar-overlay {
                        position: fixed; inset: 0; background: rgba(0,0,0,0.6);
                        backdrop-filter: blur(4px); z-index: 999;
                        opacity: 0; visibility: hidden; transition: 0.3s;
                    }
                    .sidebar-overlay.open { opacity: 1; visibility: visible; }
                    .main-wrapper { margin-left: 0; }
                    .top-header { height: 60px; padding: 0 1rem; }
                    .page-title { font-size: 1.3rem; }
                    .sidebar-header { padding: 1.25rem 1rem; }
                    .nav-section-title { padding: 0.75rem 0.85rem 0.4rem; }
                    .icon-btn { width: 36px; height: 36px; }
                    .user-avatar { width: 36px; height: 36px; font-size: 0.9rem; }
                    .user-profile { padding-left: 1rem; gap: 8px; }
                    .mobile-only { display: flex; }
                    .pc-only { display: none; }
                    .menu-toggle { background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-main); padding: 7px; border-radius: 10px; }
                }
            `}</style>
        </div>
    )
}
