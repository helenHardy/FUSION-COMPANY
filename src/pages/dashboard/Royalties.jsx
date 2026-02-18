
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

    const handleClaimAllMonthly = async () => {
        const unclaimedCount = monthlyBonuses.filter(b => !b.is_claimed).length
        if (unclaimedCount === 0) {
            alert("No tienes bonos pendientes por cobrar.")
            return
        }

        if (!confirm(`¿Deseas cobrar los ${unclaimedCount} bonos pendientes?`)) return

        setClaiming(true)
        try {
            const { data, error } = await supabase.rpc('claim_all_pending_bonuses', { p_user_id: profile.id })

            if (error) throw error

            if (data?.success) {
                alert(data.message || `¡Se han cobrado ${data.processed_count} bonos!`)
                fetchMonthlyBonuses()
            } else {
                alert(data?.message || 'Error al cobrar los bonos')
            }
        } catch (err) {
            console.error("Error al cobrar todo:", err)
            alert("Ocurrió un error al procesar el cobro masivo.")
        } finally {
            setClaiming(false)
        }
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

    const rankPersonalBonus = status?.[0]?.rank_personal_bonus || 0
    const finalPercent = rankPersonalBonus > 0 ? rankPersonalBonus : (parseFloat(systemSettings.monthly_pv_bonus_percent) || 0)

    // Cálculo de bono potencial personal
    const personalPotential = (profile?.monthly_pv || 0) * (finalPercent / 100)

    // Cálculo de bono potencial por niveles (Regalías)
    // Sumamos niveles donde se cumplen los requisitos de trabajo (Gente, PVG, PV)
    const levelsPotential = status.reduce((acc, item) => {
        const isWorkQualified = item.current_people >= item.min_people &&
            item.current_pvg >= item.min_pvg &&
            item.current_monthly_pv >= item.min_monthly_pv;

        if (isWorkQualified && !item.is_claimed) {
            const percentage = item.rank_percentage > 0 ? item.rank_percentage : (item.max_percentage || 0);
            return acc + ((item.current_pvg * percentage) / 100);
        }
        return acc;
    }, 0)

    const totalPotential = personalPotential + levelsPotential

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
                        Historial
                    </button>
                </div>
            </header>

            {activeTab === 'royalties' ? (
                <>
                    {/* New Overhauled Hero Section */}
                    <div className={styles.overhauledHero}>
                        <div className={styles.heroMain}>
                            <div className={styles.heroTotalLabel}>Bono total generado este mes</div>
                            <div className={styles.heroTotalValue}>{formatCurrency(totalPotential)}</div>
                            <div className={styles.heroSubstats}>
                                <div className={styles.heroSubstat}>
                                    <span className={styles.substatLabel}>Bono Personal:</span>
                                    <span className={styles.substatValue}>{formatCurrency(personalPotential)}</span>
                                </div>
                                <div className={styles.heroSubstat}>
                                    <span className={styles.substatLabel}>Bono Regalías:</span>
                                    <span className={styles.substatValue}>{formatCurrency(levelsPotential)}</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.heroSide}>
                            <div className={styles.sideStat}>
                                <div className={styles.sideStatLabel}>Actividad Personal</div>
                                <div className={styles.sideStatValue}>{profile?.monthly_pv || 0} PV</div>
                            </div>
                            <div className={styles.sideStat}>
                                <div className={styles.sideStatLabel}>Puntos Grupales (PVG)</div>
                                <div className={styles.sideStatValue}>{profile?.monthly_pvg || 0} PVG</div>
                            </div>
                            <div className={styles.sideStat}>
                                <div className={styles.sideStatLabel}>Tasa Retorno</div>
                                <div className={styles.sideStatValue} style={{ color: '#10b981' }}>{finalPercent}%</div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.levelsContainer}>
                        {status.map((item) => {
                            const percentage = item.rank_percentage || 0
                            const potentialPayout = (item.current_pvg * percentage) / 100
                            const isUnlocked = item.is_unlocked // Evaluamos si califica este mes
                            const isRankLocked = percentage <= 0

                            return (
                                <div key={item.level_number} className={`${styles.levelCard} glass ${isUnlocked ? styles.levelCardUnlocked : ''} ${isRankLocked ? styles.levelCardRankLocked : ''}`}>
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
                                            <span className={styles.progressIconText}><TrendingUp size={14} /> PVG Mensual</span>
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
                                        <div className={styles.payoutPercentage}>
                                            {isRankLocked
                                                ? <div className={styles.incentiveLabel} style={{ color: '#f59e0b', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    {(!item.debug_user_rank || item.debug_user_rank === 'SIN RANGO' || (typeof item.debug_user_rank === 'string' && item.debug_user_rank.trim() === '')) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            <div style={{ background: '#dc2626', color: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                                                ⚠️ RANGO VACÍO EN PERFIL
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    const { error } = await supabase.from('profiles').update({ current_rank: 'PERSONAL' }).eq('id', profile.id);
                                                                    if (error) alert("Error: " + error.message);
                                                                    else { alert("¡Rango Reparado! Sincronizando..."); window.location.reload(); }
                                                                }}
                                                                style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                                                            >
                                                                🔄 REPARAR MI RANGO AHORA
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontWeight: 800 }}>Rango: {item.debug_user_rank}</span>
                                                    )}

                                                    <span className={styles.incentiveSub} style={{ marginTop: '8px' }}>
                                                        {item.debug_system_rank === 'NO ENCONTRADO'
                                                            ? `🚫 No existe configuración para "${item.debug_user_rank}"`
                                                            : `Nivel bloqueado para este rango`}
                                                    </span>
                                                </div>
                                                : <div className={styles.rankStatusLabel}>
                                                    <Crown size={14} /> Rango {item.debug_system_rank}: <strong>{percentage}%</strong>
                                                </div>
                                            }
                                        </div>
                                        <div className={styles.payoutCalculation} title={`Config: ${item.debug_config_raw}`}>
                                            <div className={styles.calcValue}>{item.current_pvg} PVG</div>
                                            <div className={styles.calcOp}>×</div>
                                            <div className={styles.calcValue}>{percentage || Number(item.max_percentage || 0)}%</div>
                                        </div>
                                        <div className={styles.payoutAmount} style={{ opacity: isRankLocked ? 0.3 : 1 }}>
                                            = {formatCurrency(isRankLocked ? (item.current_pvg * (item.max_percentage || 0) / 100) : potentialPayout)}
                                        </div>
                                    </div>

                                    {/* Status Action */}
                                    <div style={{ textAlign: 'center' }}>
                                        {isRankLocked ? (
                                            <div className={`${styles.badge} ${styles.badgeLocked}`} style={{ opacity: 0.7, fontSize: '0.8rem' }}>
                                                <Trophy size={14} /> BLOQUEADO POR RANGO
                                            </div>
                                        ) : isUnlocked ? (
                                            <div className={`${styles.badge} ${styles.badgeUnlocked}`} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}>
                                                <CheckCircle2 size={16} /> CALIFICADO PARA CIERRE
                                            </div>
                                        ) : (
                                            <div className={`${styles.badge} ${styles.badgeLocked}`}>
                                                <Lock size={16} /> PROGRESO EN CURSO
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
                    <h3 className={styles.sectionTitle} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Trophy size={22} color="var(--primary-color)" /> Historial de Bonos de Activación
                        </div>
                        {monthlyBonuses.some(b => !b.is_claimed) && (
                            <button
                                onClick={handleClaimAllMonthly}
                                disabled={claiming}
                                className="button"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: '#10b981' }}
                            >
                                {claiming ? 'COBRANDO...' : 'COBRAR TODO EL HISTORIAL'}
                            </button>
                        )}
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
