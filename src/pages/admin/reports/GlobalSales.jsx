
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { BarChart3, ShoppingBag, Users, Zap, Calendar, TrendingUp, Wallet, ArrowDownCircle, Info, Filter, Download, RefreshCw, Target, PieChart, Loader2, Eye, Star, Store } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import styles from './GlobalSales.module.css'

export default function GlobalSales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)

    // Filters
    const [branches, setBranches] = useState([])
    const [selectedBranch, setSelectedBranch] = useState('all')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString())

    const [productsRanking, setProductsRanking] = useState([])
    const [bestSeller, setBestSeller] = useState(null)

    // Details Modal
    const [selectedSale, setSelectedSale] = useState(null)
    const [saleDetails, setSaleDetails] = useState([])
    const [detailsLoading, setDetailsLoading] = useState(false)

    const { profile } = useAuth()
    const isAdmin = profile?.role === 'admin'

    useEffect(() => {
        fetchBranches()
    }, [])

    useEffect(() => {
        fetchData()
    }, [selectedBranch, selectedYear, selectedMonth, selectedDay])

    const fetchBranches = async () => {
        if (!isAdmin) return
        const { data } = await supabase.from('sucursales').select('*').order('name')
        if (data) setBranches(data)
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('sales')
                .select('*, profiles(full_name), sucursales(name)')
                .order('created_at', { ascending: false })

            // 1. Apply Branch Filter
            if (isAdmin) { // Admins can filter
                if (selectedBranch !== 'all') {
                    query = query.eq('branch_id', selectedBranch)
                }
            } else { // Non-admins are locked to their branch
                const { data: branch } = await supabase
                    .from('sucursales')
                    .select('id')
                    .eq('manager_id', profile.id)
                    .maybeSingle()

                if (branch) {
                    query = query.eq('branch_id', branch.id)
                } else {
                    setSales([])
                    setLoading(false)
                    return
                }
            }

            // 2. Apply Date Filters
            let startDate, endDate

            // Create dates in local time (browser timezone)
            const year = parseInt(selectedYear)
            const month = parseInt(selectedMonth) - 1 // JS months are 0-indexed

            if (selectedDay !== 'all') {
                // Specific Day in Local Time
                const day = parseInt(selectedDay)
                const start = new Date(year, month, day, 0, 0, 0) // Local start of day
                const end = new Date(year, month, day, 23, 59, 59, 999) // Local end of day

                startDate = start.toISOString()
                endDate = end.toISOString()
            } else {
                // Whole Month in Local Time
                const start = new Date(year, month, 1, 0, 0, 0)
                const end = new Date(year, month + 1, 0, 23, 59, 59, 999) // Last day of month

                startDate = start.toISOString()
                endDate = end.toISOString()
            }

            query = query.gte('created_at', startDate).lte('created_at', endDate)

            const { data: fetchedSales, error } = await query

            if (error) throw error

            setSales(fetchedSales || [])

            // 3. Process Stats Locally
            if (fetchedSales) {
                const totalRevenue = fetchedSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
                const totalPV = fetchedSales.reduce((sum, s) => sum + (Number(s.total_pv) || 0), 0)

                setStats({
                    revenue: totalRevenue,
                    orders: fetchedSales.length,
                    pv: totalPV
                })

                // 4. Process Product Breakdown
                const saleIds = fetchedSales.map(s => s.id)
                if (saleIds.length > 0) {
                    const { data: items } = await supabase
                        .from('sale_items')
                        .select('quantity, products(name)')
                        .in('sale_id', saleIds)

                    if (items) {
                        const productMap = {}
                        items.forEach(item => {
                            const name = item.products?.name || 'Producto Eliminado'
                            productMap[name] = (productMap[name] || 0) + item.quantity
                        })

                        const ranked = Object.entries(productMap)
                            .map(([name, qty]) => ({ name, qty }))
                            .sort((a, b) => b.qty - a.qty)

                        setProductsRanking(ranked)
                        setBestSeller(ranked[0] || null)
                    }
                } else {
                    setProductsRanking([])
                    setBestSeller(null)
                }
            }

        } catch (err) {
            console.error("Error fetching report:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleViewDetails = async (sale) => {
        setSelectedSale(sale)
        setDetailsLoading(true)
        try {
            const { data } = await supabase
                .from('sale_items')
                .select('*, products(name)')
                .eq('sale_id', sale.id)
            if (data) setSaleDetails(data)
        } catch (error) {
            console.error(error)
        } finally {
            setDetailsLoading(false)
        }
    }

    const years = [2024, 2025, 2026]
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const days = Array.from({ length: 31 }, (_, i) => i + 1)

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Reporte <span className={styles.highlight}>Comercial</span></h1>
                    <p className={styles.subtitle}>Análisis detallado de ventas por sucursal y periodo.</p>
                </div>
                <button className={styles.refreshBtn} onClick={fetchData}><RefreshCw size={20} /></button>
            </header>

            {/* Advanced Filters */}
            <div className={`${styles.filterBar} glass`}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}><Store size={14} /> Sucursal</label>
                    <select
                        className={styles.select}
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={!isAdmin}
                    >
                        <option value="all">Todas las Sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.dateFilters}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Año</label>
                        <select className={styles.select} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Mes</label>
                        <select className={styles.select} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                            {months.map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Día</label>
                        <select className={styles.select} value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
                            <option value="all">Todo el Mes</option>
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                <StatsBox
                    label="Ingresos Netos"
                    value={formatCurrency(stats?.revenue || 0)}
                    icon={<Wallet size={24} />}
                    color="#10b981"
                    description="Total facturado en periodo"
                />
                <StatsBox
                    label="Ventas Realizadas"
                    value={stats?.orders || 0}
                    icon={<ShoppingBag size={24} />}
                    color="#6366f1"
                    description="Transacciones completadas"
                />
                <StatsBox
                    label="Producto Top"
                    value={bestSeller?.name || '---'}
                    icon={<Star size={24} />}
                    color="#f59e0b"
                    description={bestSeller ? `${bestSeller.qty} unidades` : 'Sin datos'}
                />
            </div>

            <div className={styles.contentGrid}>
                {/* Product Breakdown */}
                <div className={`${styles.card} glass`}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}><ShoppingBag size={18} /> Productos Vendidos</h3>
                    </header>
                    <div className={styles.productList}>
                        <div className={styles.tableHeaderRow}>
                            <span>Producto</span>
                            <span>Cant.</span>
                        </div>
                        <div className={styles.tableBody}>
                            {productsRanking.length > 0 ? productsRanking.map((p, i) => (
                                <div key={i} className={styles.productRow}>
                                    <span className={styles.prodName}>{p.name}</span>
                                    <span className={styles.prodQty}>{p.qty}</span>
                                </div>
                            )) : (
                                <div className={styles.emptyState}>No hay productos vendidos en este periodo.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sales History */}
                <div className={`${styles.card} glass`} style={{ flex: 2 }}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}><Calendar size={18} /> Historial de Ventas</h3>
                    </header>
                    <div className={styles.tableContainer}>
                        <table className={styles.historyTable}>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Vendedor</th>
                                    {isAdmin && <th>Sucursal</th>}
                                    <th>Total</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center p-4"><Loader2 className="spinner" /></td></tr>
                                ) : sales.map(sale => (
                                    <tr key={sale.id}>
                                        <td>{formatDate(sale.created_at)}</td>
                                        <td>{sale.profiles?.full_name || 'Desconocido'}</td>
                                        {isAdmin && <td>{sale.sucursales?.name}</td>}
                                        <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(sale.total_amount)}</td>
                                        <td>
                                            <button className={styles.iconBtn} onClick={() => handleViewDetails(sale)}>
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && sales.length === 0 && (
                                    <tr><td colSpan="5" className={styles.emptyTable}>Sin registros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Detalle de Venta">
                {selectedSale && (
                    <div className={styles.detailsContent}>
                        <div className={styles.detailHeader}>
                            <div><strong>ID Venta:</strong> #{selectedSale.id.slice(0, 8)}</div>
                            <div><strong>Total:</strong> {formatCurrency(selectedSale.total_amount)}</div>
                        </div>
                        <div className={styles.detailItems}>
                            {detailsLoading ? <Loader2 className="spinner" /> : saleDetails.map((item, i) => (
                                <div key={i} className={styles.detailItem}>
                                    <span>{item.products?.name} <span className={styles.qtyBadge}>x{item.quantity}</span></span>
                                    <span>{formatCurrency(item.price_at_sale * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

function StatsBox({ label, value, icon, color, description }) {
    return (
        <div className={`${styles.statsBox} glass`}>
            <div>
                <div className={styles.statsLabel}>{label}</div>
                <div className={styles.statsValue}>{value}</div>
                <div className={styles.statsDesc}>{description}</div>
            </div>
            <div className={styles.statsIcon} style={{ background: `${color}15`, color: color, border: `1px solid ${color}25` }}>
                {icon}
            </div>
        </div>
    )
}
