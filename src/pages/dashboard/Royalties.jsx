
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Crown, CheckCircle2, Lock, ArrowUpRight, TrendingUp, Users, Info, Sparkles, Trophy, Loader2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import styles from './Royalties.module.css'

export default function Royalties() {
    const { profile } = useAuth()
    const [status, setStatus] = useState([])
    const [monthlyBonuses, setMonthlyBonuses] = useState([])
    const [loading, setLoading] = useState(true)
    const [claiming, setClaiming] = useState(false)
    const [rankInfo, setRankInfo] = useState(null)
    const [activeTab, setActiveTab] = useState('royalties') // 'royalties' or 'monthly'
    const [systemSettings, setSystemSettings] = useState({ monthly_pv_bonus_percent: 15 })

    useEffect(() => {
        if (profile) {
            fetchInitialData()
        }
    }, [profile])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            await Promise.all([
                fetchStatus(),
                fetchRankInfo(),
                fetchMonthlyBonuses(),
                fetchSettings()
            ])
        } catch (err) {
            console.error("Error al cargar datos de regalías:", err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSettings = async () => {
        const { data } = await supabase.from('system_settings').select('key, value')
        if (data) {
            const settings = {}
            data.forEach(s => settings[s.key] = s.value)
            setSystemSettings(settings)
        }
    }

    const fetchRankInfo = async () => {
        const { data } = await supabase.from('ranks').select('*').ilike('name', profile.current_rank).maybeSingle()
        if (data) setRankInfo(data)
    }

    const fetchStatus = async () => {
        const { data } = await supabase.rpc('get_user_royalty_status', { p_user_id: profile.id })
        if (data) setStatus(data)
    }

    const fetchMonthlyBonuses = async () => {
        const { data } = await supabase.rpc('get_user_monthly_bonuses', { p_user_id: profile.id })
        if (data) setMonthlyBonuses(data)
    }

    const handleClaimMonthly = async (bonusId) => {
        if (!confirm('¿Deseas cobrar este bono mensual? Se sumará a tus ganancias totales.')) return

        setClaiming(true)
        const { data } = await supabase.rpc('claim_monthly_bonus', { p_bonus_id: bonusId })

        if (data?.success) {
            alert(`¡Bono cobrado! +${formatCurrency(data.amount)}`)
            fetchMonthlyBonuses()
        } else {
            alert(data?.message || 'Error al cobrar el bono')
        }
        setClaiming(false)
    }

    const handleClaim = async (level) => {
        if (!confirm(`¿Estás seguro de cobrar el Bono de Nivel ${level}? \nEsta acción cerrará este nivel definitivamente con el PVG acumulado actual.`)) return

        setClaiming(true)
        const { data } = await supabase.rpc('claim_royalty_level', { p_user_id: profile.id, p_level: level })

        if (data?.success) {
            alert(`¡Felicidades! Has cobrado ${formatCurrency(data.amount)}`)
            fetchStatus()
        } else {
            alert(data?.message || 'Error al cobrar el bono')
        }
        setClaiming(false)
    }

    if (loading) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                <Loader2 className="spinner" size={40} />
            </div>
        )
    }

    const currentMonthPotential = (profile?.monthly_pv || 0) * (parseFloat(systemSettings.monthly_pv_bonus_percent) / 100)

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Bonos y <span className={styles.highlight}>Regalías</span></h1>
                    <p className={styles.subtitle}>Supervisa y activa tus ingresos por crecimiento estructural y actividad mensual.</p>
                </div>

                <div className={styles.tabs}>
                    <button
                        onClick={() => setActiveTab('royalties')}
                        className={`${styles.tab} ${activeTab === 'royalties' ? styles.activeTab : ''}`}
                    >
                        Bono Regalías
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`${styles.tab} ${activeTab === 'monthly' ? styles.activeTab : ''}`}
                    >
                        Bono PV Mensual
                    </button>
                </div>
            </header>

            {activeTab === 'royalties' ? (
                <>
                    {/* Premium Rank Banner */}
                    <div className={styles.banner}>
                        <div className={styles.bannerIcon}>
                            <Crown size={36} />
                        </div>
                        <div className={styles.bannerContent}>
                            <h3 className={styles.bannerTitle}>Estatus Actual: {profile?.current_rank}</h3>
                            <p className={styles.bannerSubtitle}>
                                Desbloquea bonos únicos por cada nivel de tu red al alcanzar los hitos de PVG y personas requeridos.
                            </p>
                        </div>
                        <div className={styles.bannerValueBox}>
                            <div className={styles.bannerLabel}>Tu PVG Unificado</div>
                            <div className={styles.bannerValue}>{profile?.pvg || 0}</div>
                        </div>
                    </div>

                    <div className={styles.levelsContainer}>
                        {status.map((item) => {
                            const percentage = rankInfo?.royalties_config?.[`N${item.level_number}`] || 0
                            const potentialPayout = (item.current_pvg * percentage) / 100
                            const isClaimed = item.is_claimed
                            const isUnlocked = item.is_unlocked && !isClaimed

                            return (
                                <div key={item.level_number} className={`${styles.levelCard} glass ${isClaimed ? styles.levelCardClaimed : ''} ${isUnlocked ? styles.levelCardUnlocked : ''}`}>
                                    {/* Nivel */}
                                    <div className={styles.levelNumberBox}>
                                        <div className={styles.levelNumberLabel}>Nivel</div>
                                        <div className={styles.levelNumber}>{item.level_number}</div>
                                    </div>

                                    {/* People Progress */}
                                    <div className={styles.progressGroup}>
                                        <div className={styles.progressHeader}>
                                            <span className={styles.progressIconText}><Users size={14} /> Red</span>
                                            <span>{item.current_people} / {item.min_people}</span>
                                        </div>
                                        <div className={styles.progressBarContainer}>
                                            <div className={styles.progressBar} style={{
                                                width: `${Math.min(100, (item.current_people / item.min_people) * 100)}%`,
                                                background: item.current_people >= item.min_people ? '#10b981' : 'var(--primary-color)'
                                            }} />
                                        </div>
                                    </div>

                                    {/* PVG Progress */}
                                    <div className={styles.progressGroup}>
                                        <div className={styles.progressHeader}>
                                            <span className={styles.progressIconText}><TrendingUp size={14} /> PVG</span>
                                            <span>{item.current_pvg} / {item.min_pvg}</span>
                                        </div>
                                        <div className={styles.progressBarContainer}>
                                            <div className={styles.progressBar} style={{
                                                width: `${Math.min(100, (item.current_pvg / item.min_pvg) * 100)}%`,
                                                background: item.current_pvg >= item.min_pvg ? '#10b981' : '#8b5cf6'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Monthly PV Progress */}
                                    <div className={styles.progressGroup}>
                                        <div className={styles.progressHeader}>
                                            <span className={styles.progressIconText}><Sparkles size={14} /> PV Mes</span>
                                            <span>{item.current_monthly_pv} / {item.min_monthly_pv}</span>
                                        </div>
                                        <div className={styles.progressBarContainer}>
                                            <div className={styles.progressBar} style={{
                                                width: `${Math.min(100, (item.current_monthly_pv / item.min_monthly_pv) * 100)}%`,
                                                background: item.current_monthly_pv >= item.min_monthly_pv ? '#10b981' : '#f59e0b'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Potential Payout */}
                                    <div className={styles.payoutSection}>
                                        <div className={styles.payoutPercentage}>{percentage}% de Comisión</div>
                                        <div className={styles.payoutAmount}>{formatCurrency(potentialPayout)}</div>
                                    </div>

                                    {/* Claim Action */}
                                    <div style={{ textAlign: 'right' }}>
                                        {isClaimed ? (
                                            <div className={`${styles.badge} ${styles.badgeClaimed}`}>
                                                <CheckCircle2 size={16} /> COBRADO
                                            </div>
                                        ) : isUnlocked ? (
                                            <button
                                                disabled={claiming || percentage <= 0}
                                                onClick={() => handleClaim(item.level_number)}
                                                className="button"
                                                style={{ width: '100%', padding: '0.75rem' }}
                                            >
                                                {percentage > 0 ? (claiming ? 'COBRANDO...' : 'COBRAR BONO') : 'RANGO INSUF.'}
                                            </button>
                                        ) : (
                                            <div className={`${styles.badge} ${styles.badgeLocked}`}>
                                                <Lock size={16} /> BLOQUEADO
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            ) : (
                <>
                    {/* Monthly PV Bonus Hero */}
                    <div className={styles.monthlyHero}>
                        <div>
                            <div className={styles.monthlyLabel}>Actividad Mes Actual</div>
                            <h2 className={styles.monthlyValue}>{profile?.monthly_pv || 0} PV</h2>
                            <p className={styles.monthlyPotential}>
                                Has generado un bono potencial de <b style={{ color: '#10b981' }}>{formatCurrency(currentMonthPotential)}</b> este mes.
                            </p>
                        </div>
                        <div className={styles.percentBox}>
                            <div className={styles.percentLabel}>Tasa de Retorno</div>
                            <div className={styles.percentValue}>{systemSettings.monthly_pv_bonus_percent}%</div>
                        </div>
                    </div>

                    <h3 className={styles.sectionTitle} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Trophy size={22} color="var(--primary-color)" /> Historial de Bonos de Activación
                    </h3>

                    <div className={styles.levelsContainer}>
                        {monthlyBonuses.map((bonus) => (
                            <div key={bonus.id} className={`glass ${styles.monthlyCard} ${bonus.is_claimed ? styles.monthlyCardClaimed : ''}`}>
                                <div>
                                    <div className={styles.monthlyLabelSmall}>Periodo</div>
                                    <div className={styles.monthlyValueSmall}>
                                        {new Date(bonus.year, bonus.month - 1).toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </div>
                                </div>
                                <div>
                                    <div className={styles.monthlyLabelSmall}>PV Generado</div>
                                    <div className={styles.monthlyValueSmall}>{bonus.pv_amount} PV</div>
                                </div>
                                <div>
                                    <div className={styles.monthlyLabelSmall}>Bono Final ({bonus.percentage}%)</div>
                                    <div className={`${styles.monthlyValueSmall} ${!bonus.is_claimed ? styles.highlight : ''}`} style={{ fontSize: '1.3rem' }}>
                                        {formatCurrency(bonus.bonus_amount)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    {bonus.is_claimed ? (
                                        <div className={`${styles.badge} ${styles.badgeClaimed}`}>
                                            <CheckCircle2 size={16} /> TRANSFERIDO
                                        </div>
                                    ) : (
                                        <button
                                            disabled={claiming}
                                            onClick={() => handleClaimMonthly(bonus.id)}
                                            className="button"
                                            style={{ width: '100%', padding: '0.75rem' }}
                                        >
                                            {claiming ? 'PROCESANDO...' : 'COBRAR AHORA'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {monthlyBonuses.length === 0 && (
                            <div className="card glass" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-dim)' }}>
                                <Sparkles size={48} style={{ opacity: 0.1, marginBottom: '1.5rem' }} />
                                <p>Tus bonos por consumo personal aparecerán aquí una vez finalizado el mes de actividad.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className={styles.infoBox}>
                <Info size={24} color="#22d3ee" />
                <div className={styles.infoContent}>
                    {activeTab === 'royalties' ? (
                        <><b>Bono de Regalías:</b> Una recompensa única por cada nivel desbloqueado gracias a tu liderazgo. Se calcula según el PVG unificado de toda tu red descendente y el porcentaje asignado a tu rango actual.</>
                    ) : (
                        <><b>Bono PV Mensual:</b> Tu lealtad tiene premio. Recibe un retorno directo sobre tu consumo personal de cada mes. Este bono se activa al cierre del periodo mensual y puedes cobrarlo instantáneamente.</>
                    )}
                </div>
            </div>
        </div>
    )
}
