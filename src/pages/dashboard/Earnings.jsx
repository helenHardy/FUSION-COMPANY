
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { DollarSign, ArrowUpRight, History, User, TrendingUp, Wallet, Award, PieChart, Sparkles, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../../lib/utils'
import styles from './Earnings.module.css'

export default function Earnings() {
    const { profile } = useAuth()
    const [commissions, setCommissions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile) fetchEarnings()
    }, [profile])

    const fetchEarnings = async () => {
        setLoading(true)
        try {
            const { data } = await supabase
                .from('commissions')
                .select(`
                    *,
                    source:source_user_id (full_name)
                `)
                .eq('beneficiary_id', profile.id)
                .order('created_at', { ascending: false })

            if (data) setCommissions(data)
        } catch (err) {
            console.error("Error al cargar ganancias:", err)
        } finally {
            setLoading(false)
        }
    }

    const totalFastStart = commissions
        .filter(c => c.commission_type === 'bono_inicio_rapido')
        .reduce((acc, curr) => acc + curr.amount, 0)

    const totalMonthly = commissions
        .filter(c => c.commission_type === 'bono_pv_mensual')
        .reduce((acc, curr) => acc + curr.amount, 0)

    const totalResidual = commissions
        .filter(c => c.commission_type === 'regalia')
        .reduce((acc, curr) => acc + curr.amount, 0)

    if (!profile) return null

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Mis <span className={styles.highlight}>Ganancias</span>
                </h1>
                <p className={styles.subtitle}>Supervisa tu crecimiento financiero y el retorno de tu red Fusion.</p>
            </header>

            {/* Premium Summary Hero */}
            <div className={styles.balanceHero}>
                <div className={styles.balanceInfo}>
                    <div className={styles.balanceLabel}>
                        <Wallet size={18} /> Balance Total Disponible
                    </div>
                    <div className={styles.balanceAmount}>{formatCurrency(profile?.total_earnings || 0)}</div>
                </div>

                <div className={styles.balanceStats}>
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>Total Ganado</div>
                        <div className={styles.statValue}>{formatCurrency(totalFastStart + totalMonthly + totalResidual)}</div>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <div className={styles.statLabel}>Comisiones</div>
                        <div className={styles.statValue}>{commissions.length}</div>
                    </div>
                </div>
            </div>

            {/* Earning Categories Grid */}
            <div className={styles.categoryGrid}>
                <div className={`${styles.categoryCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
                        <TrendingUp size={28} />
                    </div>
                    <div className={styles.catInfo}>
                        <div className={styles.catLabel}>Inicio Rápido</div>
                        <div className={styles.catAmount}>{formatCurrency(totalFastStart)}</div>
                        <div className={styles.catDesc}>Bonos por patrocinio directo</div>
                    </div>
                </div>

                <div className={`${styles.categoryCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <PieChart size={28} />
                    </div>
                    <div className={styles.catInfo}>
                        <div className={styles.catLabel}>Regalías</div>
                        <div className={styles.catAmount}>{formatCurrency(totalResidual)}</div>
                        <div className={styles.catDesc}>Comisiones por volumen de red</div>
                    </div>
                </div>

                <div className={`${styles.categoryCard} glass`}>
                    <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <Award size={28} />
                    </div>
                    <div className={styles.catInfo}>
                        <div className={styles.catLabel}>Bono Consumo</div>
                        <div className={styles.catAmount}>{formatCurrency(totalMonthly)}</div>
                        <div className={styles.catDesc}>Beneficios por activación personal</div>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className={`${styles.historyCard} glass`}>
                <div className={styles.historyHeader}>
                    <div className={styles.historyTitle}>
                        <History size={22} color="var(--primary-color)" />
                        Historial de Transacciones
                    </div>
                    {loading && <Loader2 className="spinner-small" size={20} />}
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Fecha</th>
                                <th className={styles.th}>Origen / Socio</th>
                                <th className={styles.th}>Tipo</th>
                                <th className={styles.th}>Nivel</th>
                                <th className={`${styles.th} ${styles.amountCell}`}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commissions.map(c => (
                                <tr key={c.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.date}>{formatDate(c.created_at)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.sourceCell}>
                                            <div className={styles.sourceIcon}>
                                                <User size={18} />
                                            </div>
                                            <span className={styles.sourceName}>
                                                {c.source?.full_name || (c.commission_type === 'bono_pv_mensual' ? 'Consumo Personal' : 'Miembro Fusion')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <span className={`${styles.badge} ${c.commission_type === 'bono_inicio_rapido' ? styles.badgeFastStart :
                                                c.commission_type === 'bono_pv_mensual' ? styles.badgeMonthly : styles.badgeResidual
                                            }`}>
                                            {c.commission_type === 'bono_inicio_rapido' ? 'Inicio Rápido' :
                                                c.commission_type === 'bono_pv_mensual' ? 'Bono PV' : 'Regalía'}
                                        </span>
                                    </td>
                                    <td className={styles.td}>
                                        <span className={styles.levelBadge}>
                                            {c.commission_type === 'bono_pv_mensual' ? '-' : `L${c.level_depth}`}
                                        </span>
                                    </td>
                                    <td className={`${styles.td} ${styles.amountCell}`}>
                                        + {formatCurrency(c.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!loading && commissions.length === 0 && (
                        <div className={styles.emptyState}>
                            <Sparkles className={styles.emptyIcon} size={64} />
                            <h3>Empieza a construir tu legado</h3>
                            <p>Tus ganancias aparecerán aquí a medida que tu red crezca.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
