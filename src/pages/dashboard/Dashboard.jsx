
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import {
    CheckCircle2, XCircle, TrendingUp, Users, Trophy,
    CreditCard, Zap, Activity, ShieldCheck, ArrowUpRight,
    DollarSign, Sparkles, PiggyBank
} from 'lucide-react'
import styles from './Dashboard.module.css'

export default function Dashboard() {
    const { profile } = useAuth()
    const [rankReq, setRankReq] = useState(null)
    const [activationPlan, setActivationPlan] = useState(null)
    const [cashierStats, setCashierStats] = useState({ todayVentas: 0, pendingOrders: 0, monthVentas: 0 })
    const [loading, setLoading] = useState(false)

    const isCashier = profile?.role === 'cajero'

    useEffect(() => {
        if (profile?.current_rank && !isCashier) {
            fetchRankReq()
        }
        if (profile?.current_combo_id && !isCashier) {
            fetchActivationPlan()
        }
        if (isCashier) {
            fetchCashierStats()
        }
    }, [profile])

    const fetchCashierStats = async () => {
        setLoading(true)
        try {
            // Obtener sucursal asignada
            const { data: branch } = await supabase
                .from('sucursales')
                .select('id')
                .eq('manager_id', profile.id)
                .maybeSingle()

            if (!branch) return

            const today = new Date().toISOString().split('T')[0]
            const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

            const [todaySales, monthSales, pending] = await Promise.all([
                supabase.from('sales').select('total_amount').eq('branch_id', branch.id).eq('status', 'completado').gte('created_at', today),
                supabase.from('sales').select('total_amount').eq('branch_id', branch.id).eq('status', 'completado').gte('created_at', firstDayMonth),
                supabase.from('sales').select('id', { count: 'exact' }).eq('branch_id', branch.id).eq('status', 'pendiente')
            ])

            setCashierStats({
                todayVentas: todaySales.data?.reduce((sum, s) => sum + parseFloat(s.total_amount), 0) || 0,
                monthVentas: monthSales.data?.reduce((sum, s) => sum + parseFloat(s.total_amount), 0) || 0,
                pendingOrders: pending.count || 0
            })
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchActivationPlan = async () => {
        try {
            const { data, error } = await supabase
                .from('combos')
                .select(`
                    name,
                    gain_plans (
                        name,
                        config
                    )
                `)
                .eq('id', profile.current_combo_id)
                .maybeSingle()

            if (error) console.error("Error fetching activation plan:", error)
            setActivationPlan(data)
        } catch (err) {
            console.error(err)
        }
    }

    const fetchRankReq = async () => {
        if (!profile?.current_rank) return;
        try {
            const { data: curr, error: currErr } = await supabase
                .from('ranks')
                .select('*')
                .ilike('name', profile.current_rank)
                .maybeSingle()

            if (currErr) console.error("Error fetching current rank:", currErr)
            setRankReq(curr)
        } catch (err) {
            console.error(err)
        }
    }

    const isQualified = rankReq &&
        (profile.monthly_pv >= rankReq.min_pv_monthly) &&
        (profile.active_directs_count >= rankReq.min_active_directs)

    if (!profile) return null;

    if (isCashier) {
        return (
            <div className={styles.container}>
                <div className={styles.hero}>
                    <div className={styles.heroContent}>
                        <h1 className={styles.heroTitle}>Operación de Caja: {profile?.full_name?.split(' ')[0]}</h1>
                        <p className={styles.heroSubtitle}>Gestiona las ventas y pedidos de tu sucursal con eficiencia.</p>
                    </div>
                </div>

                <div className={styles.statsGrid}>
                    <div className={`${styles.statCard} glass`}>
                        <div className={styles.iconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <div className={styles.statLabel}>Ventas de Hoy</div>
                            <div className={styles.statValue}>{formatCurrency(cashierStats.todayVentas)}</div>
                        </div>
                    </div>

                    <div className={`${styles.statCard} glass`}>
                        <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <Activity size={28} />
                        </div>
                        <div>
                            <div className={styles.statLabel}>Pedidos Pendientes</div>
                            <div className={styles.statValue}>{cashierStats.pendingOrders}</div>
                        </div>
                    </div>

                    <div className={`${styles.statCard} glass`}>
                        <div className={styles.iconBox} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <div className={styles.statLabel}>Ventas del Mes</div>
                            <div className={styles.statValue}>{formatCurrency(cashierStats.monthVentas)}</div>
                        </div>
                    </div>
                </div>

                <div className={styles.bottomGrid} style={{ gridTemplateColumns: '1fr' }}>
                    <div className={`${styles.planCard} glass`} style={{ textAlign: 'center' }}>
                        <div className={styles.planHeader} style={{ justifyContent: 'center', border: 'none' }}>
                            <div className={styles.planIcon}><CheckCircle2 size={32} /></div>
                            <div>
                                <h4 className={styles.planTitle}>Terminal Operativa Activa</h4>
                                <p style={{ color: 'var(--text-dim)' }}>Tenés acceso completo a las funciones de venta y despacho.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            {/* Hero Section */}
            <div className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>Bienvenido, {profile?.full_name?.split(' ')[0]}</h1>
                </div>
                <div className={styles.heroDecor} />
            </div>

            {/* Quick Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={`${styles.statCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <div className={styles.statLabel}>Ganancias Totales</div>
                        <div className={styles.statValue}>{formatCurrency(profile?.total_earnings || 0)}</div>
                    </div>
                </div>

                <div className={`${styles.statCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee' }}>
                        <Activity size={28} />
                    </div>
                    <div>
                        <div className={styles.statLabel}>Puntos de Red</div>
                        <div className={styles.statValue}>{profile?.pvg || 0} PVG</div>
                    </div>
                </div>

                <div className={`${styles.statCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <Zap size={28} />
                    </div>
                    <div>
                        <div className={styles.statLabel}>Puntos Propios</div>
                        <div className={styles.statValue}>{profile?.pv || 0} PV</div>
                    </div>
                </div>

                <div className={`${styles.statCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <Trophy size={28} />
                    </div>
                    <div>
                        <div className={styles.statLabel}>Rango Actual</div>
                        <div className={styles.statValue}>{profile?.current_rank || 'Básico'}</div>
                    </div>
                </div>

                <div className={`${styles.statCard} glass ${styles.loyaltyCard}`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                        <PiggyBank size={28} />
                    </div>
                    <div>
                        <div className={styles.statLabel}>Bono Lealtad</div>
                        <div className={styles.statValue}>{formatCurrency(profile?.loyalty_balance || 0)}</div>
                    </div>
                </div>
            </div>

            <div className={styles.bottomGrid}>
                {/* Activation Plan Section */}
                <div>
                    <h3 className={styles.sectionTitle}>
                        <ShieldCheck size={24} color="#6366f1" /> Plan de Beneficios
                    </h3>
                    <div className={`${styles.planCard} glass`}>
                        <div className={styles.planHeader}>
                            <div className={styles.planIcon}>
                                <CreditCard size={32} />
                            </div>
                            <div>
                                <h4 className={styles.planTitle}>{activationPlan?.name || 'Cargando Plan...'}</h4>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Estructura de comisiones activa según tu afiliación.</p>
                            </div>
                        </div>

                        <div className={styles.planLevels}>
                            {activationPlan ? Object.entries(activationPlan.gain_plans?.config || {})
                                .filter(([_, percent]) => percent > 0)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([level, percent]) => (
                                    <div key={level} className={styles.levelItem}>
                                        <div className={styles.levelLabel}>Nivel {level}</div>
                                        <div className={styles.levelPercent}>{percent}%</div>
                                    </div>
                                )) : <div className={styles.levelItem}>Cargando detalles...</div>
                            }
                        </div>
                    </div>
                </div>

                {/* Qualification Badge */}
                <div>
                    <h3 className={styles.sectionTitle}>Calificación Mensual</h3>
                    <div className={`${styles.qualCard} glass`} style={{
                        borderColor: isQualified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    }}>
                        <div className={styles.qualIcon} style={{
                            background: isQualified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isQualified ? '#10b981' : '#f87171'
                        }}>
                            {isQualified ? <CheckCircle2 size={48} /> : <XCircle size={48} />}
                        </div>
                        <h4 className={styles.qualStatusTitle}>
                            {isQualified ? 'CALIFICADO' : 'PENDIENTE'}
                        </h4>
                        <p className={styles.qualDesc}>
                            {isQualified
                                ? 'Felicidades, cumples con los requisitos para liquidar tus ganancias este período.'
                                : 'Asegúrate de completar tu PV mensual para activar el cobro de comisiones.'}
                        </p>

                        <div className={styles.progressContainer}>
                            <div className={styles.progressInfo}>
                                <span>Progreso PV Mensual</span>
                                <span>{profile.monthly_pv} / {rankReq?.min_pv_monthly || 100}</span>
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{
                                    width: `${Math.min(100, (profile.monthly_pv / (rankReq?.min_pv_monthly || 100)) * 100)}%`,
                                    background: isQualified ? '#10b981' : 'var(--fusion-gradient)'
                                }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
