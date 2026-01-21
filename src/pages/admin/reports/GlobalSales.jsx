
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { BarChart3, ShoppingBag, Users, Zap, Calendar, TrendingUp, Wallet, ArrowDownCircle, Info, Filter, Download, RefreshCw, Target, PieChart, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import styles from './GlobalSales.module.css'

export default function GlobalSales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)
    const [filterRange, setFilterRange] = useState('30') // 'today', '7', '30', 'all'

    useEffect(() => {
        fetchData()
    }, [filterRange])

    const getDates = () => {
        const end = new Date()
        let start = new Date()
        if (filterRange === 'today') start.setHours(0, 0, 0, 0)
        else if (filterRange === '7') start.setDate(end.getDate() - 7)
        else if (filterRange === '30') start.setDate(end.getDate() - 30)
        else start = new Date('2025-01-01')
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
    }

    const fetchData = async () => {
        setLoading(true)
        const { start, end } = getDates()
        try {
            const [statsRes, salesRes] = await Promise.all([
                supabase.rpc('get_admin_dashboard_stats', { p_start_date: start, p_end_date: end }),
                supabase.from('sales').select('*, profiles(full_name), sucursales(name)')
                    .gte('created_at', start)
                    .lte('created_at', end + 'T23:59:59')
                    .order('created_at', { ascending: false })
            ])
            if (statsRes.data) setStats(statsRes.data)
            if (salesRes.data) setSales(salesRes.data)
        } catch (err) {
            console.error("Error fetching global report:", err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Reporte <span className={styles.highlight}>Global</span>
                    </h1>
                    <p className={styles.subtitle}>Supervisión analítica de ingresos, comisiones y crecimiento de red.</p>
                </div>

                <div className={styles.controls}>
                    <div className={styles.rangeSelector}>
                        {['today', '7', '30', 'all'].map((r) => (
                            <button
                                key={r}
                                onClick={() => setFilterRange(r)}
                                className={`${styles.rangeBtn} ${filterRange === r ? styles.rangeBtnActive : ''}`}
                            >
                                {r === 'today' ? 'Hoy' : r === '7' ? '7 días' : r === '30' ? '30 días' : 'Todo'}
                            </button>
                        ))}
                    </div>
                    <button className={styles.refreshBtn} onClick={fetchData} title="Refrescar datos">
                        <RefreshCw size={20} className={loading ? 'spinner' : ''} />
                    </button>
                </div>
            </header>

            {/* High-Impact Executive KPIs */}
            <div className={styles.kpiGrid}>
                <StatsBox
                    label="Ingresos Totales"
                    value={formatCurrency(stats?.revenue || 0)}
                    icon={<TrendingUp size={24} />}
                    color="#10b981"
                    description="Bruto facturado"
                />
                <StatsBox
                    label="Comisiones Generadas"
                    value={formatCurrency(stats?.commissions_total || 0)}
                    icon={<ArrowDownCircle size={24} />}
                    color="#f87171"
                    description="Reparto a red"
                />
                <StatsBox
                    label="Nuevos Afiliados"
                    value={stats?.new_affiliates || 0}
                    icon={<Users size={24} />}
                    color="#6366f1"
                    description="Crecimiento neto"
                />
                <StatsBox
                    label="Adeudo Cash"
                    value={formatCurrency(stats?.pending_liquidations || 0)}
                    icon={<Wallet size={24} />}
                    color="#fbbf24"
                    description="Pagos pendientes"
                />
            </div>

            <div className={styles.metricsGrid}>
                <div className={`${styles.card} glass`}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>
                            <PieChart size={20} color="var(--primary-light)" /> Desglose de Comisiones
                        </h3>
                    </header>
                    <div className={styles.breakdownList}>
                        <BreakdownItem label="Inicio Rápido" value={stats?.commissions_breakdown?.bono_inicio_rapido} color="#0ea5e9" percentage={75} />
                        <BreakdownItem label="Regalías Residuales" value={stats?.commissions_breakdown?.regalia} color="#8b5cf6" percentage={45} />
                        <BreakdownItem label="Bonos de Consumo" value={stats?.commissions_breakdown?.bono_pv_mensual} color="#f59e0b" percentage={20} />
                    </div>
                </div>

                <div className={`${styles.card} glass`}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}>
                            <Target size={20} color="#0ea5e9" /> Rendimiento de Red
                        </h3>
                        <BarChart3 size={20} color="var(--text-dim)" />
                    </header>
                    <div className={styles.performanceStats}>
                        <div className={styles.miniCard}>
                            <div className={styles.miniLabel}>VOLUMEN TOTAL PV</div>
                            <div className={styles.miniValue}>{stats?.pv_total?.toLocaleString() || 0}</div>
                        </div>
                        <div className={styles.miniCard}>
                            <div className={styles.miniLabel}>SOCIOS ACTIVOS</div>
                            <div className={styles.miniValue}>{stats?.active_users_count || 0}</div>
                        </div>
                    </div>
                    <div className={styles.footerNote}>
                        Total desembolsado históricamente: <span style={{ color: 'white', fontWeight: '800' }}>{formatCurrency(stats?.total_paid_payouts || 0)}</span>
                    </div>
                </div>
            </div>

            <div className={`${styles.card} glass`} style={{ padding: 0 }}>
                <header className={styles.tableHeader}>
                    <h3 className={styles.cardTitle}>Libro Diario de Facturación</h3>
                    <button className={styles.exportBtn}>
                        <Download size={16} /> Exportar Reporte
                    </button>
                </header>
                <Table headers={['Fecha / Hora', 'Miembro Fusion', 'Punto de Venta', 'Puntos (PV)', 'Total Facturado']}>
                    {loading && sales.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : sales.map(sale => (
                        <tr key={sale.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(sale.created_at)}</div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.userName}>{sale.profiles?.full_name || 'Miembro General'}</div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.branchName}>{sale.sucursales?.name || 'Oficina Central'}</div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.pvValue}>{sale.total_pv.toFixed(0)} PV</div>
                            </td>
                            <td className={styles.td} style={{ textAlign: 'right' }}>
                                <div className={styles.amountValue}>{formatCurrency(sale.total_amount)}</div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && sales.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <ShoppingBag size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No se registraron ventas en el periodo seleccionado.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatsBox({ label, value, icon, color, description }) {
    return (
        <div className={`${styles.statsBox} glass`}>
            <div>
                <div className={styles.statsLabel}>{label}</div>
                <div className={styles.statsValue}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>{description}</div>
            </div>
            <div className={styles.statsIcon} style={{ background: `${color}15`, color: color, border: `1px solid ${color}25` }}>
                {icon}
            </div>
        </div>
    )
}

function BreakdownItem({ label, value, color, percentage }) {
    return (
        <div className={styles.breakdownItem}>
            <div className={styles.breakdownMeta}>
                <span className={styles.breakdownLabel}>{label}</span>
                <span className={styles.breakdownValue}>{formatCurrency(value || 0)}</span>
            </div>
            <div className={styles.progressBar}>
                <div
                    className={styles.progressFill}
                    style={{
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
                        boxShadow: `0 0 10px ${color}44`
                    }}
                />
            </div>
        </div>
    )
}
