
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Trophy, Star, Lock, Target, Users, TrendingUp, Sparkles, Loader2, ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import styles from './CareerPath.module.css'

export default function CareerPath() {
    const { profile } = useAuth()
    const [ranks, setRanks] = useState([])
    const [structureCounts, setStructureCounts] = useState({})
    const [claims, setClaims] = useState([])
    const [loading, setLoading] = useState(true)
    const [claimingId, setClaimingId] = useState(null)

    useEffect(() => {
        if (profile) {
            fetchRanks()
        }
    }, [profile])

    const fetchRanks = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('ranks')
                .select('*')
                .order('order_index', { ascending: true })

            if (data) {
                setRanks(data)

                // Fetch claims
                const { data: claimsData } = await supabase
                    .from('rank_reward_claims')
                    .select('*')
                    .eq('user_id', profile.id)
                setClaims(claimsData || [])

                // Check progress for the next rank
                const currentRankName = profile?.current_rank
                const currentObj = data.find(r => r.name.toLowerCase() === currentRankName?.toLowerCase())

                if (currentObj) {
                    const nxt = data.find(r => r.order_index === currentObj.order_index + 1)
                    if (nxt && nxt.structure_requirements?.length > 0) {
                        const counts = {}
                        for (const req of nxt.structure_requirements) {
                            const { data: count, error: countErr } = await supabase
                                .rpc('get_structure_count', {
                                    p_user_id: profile.id,
                                    p_target_rank: req.rank
                                })
                            if (!countErr) counts[req.rank] = count
                        }
                        setStructureCounts(counts)
                    }
                }
            }
        } catch (err) {
            console.error("Error al cargar carrera:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleClaimReward = async (rankId) => {
        if (claimingId) return
        setClaimingId(rankId)
        try {
            const { error } = await supabase.rpc('request_rank_reward', {
                p_rank_id: rankId
            })
            if (error) throw error
            alert("Solicitud de premio enviada correctamente.")
            fetchRanks()
        } catch (err) {
            alert("Error al solicitar premio: " + err.message)
        } finally {
            setClaimingId(null)
        }
    }

    const getUserRankIndex = () => {
        const current = ranks.find(r => r.name.toLowerCase() === profile?.current_rank?.toLowerCase())
        return current ? current.order_index : 0
    }

    const userRankIndex = getUserRankIndex()

    if (loading && !profile) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                <Loader2 className="spinner" size={40} />
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Carrera <span className={styles.highlight}>Pro</span>
                </h1>
                <p className={styles.subtitle}>
                    Escala posiciones en el ecosistema Fusion y desbloquea recompensas exclusivas en cada etapa de tu crecimiento.
                </p>
            </header>

            <div className={`${styles.timeline} ${userRankIndex > 0 ? styles.timelineActive : ''}`}>
                {ranks.map((rank, index) => {
                    const isAchieved = rank.order_index <= userRankIndex
                    const isNext = rank.order_index === userRankIndex + 1
                    const isCurrent = rank.name.toLowerCase() === profile?.current_rank?.toLowerCase()

                    return (
                        <div key={rank.id} className={styles.rankItem} style={{ opacity: isAchieved || isNext ? 1 : 0.4 }}>
                            {/* Rank Icon Box */}
                            <div className={`${styles.rankIconBox} ${isAchieved ? styles.achievedIcon : (isNext ? styles.nextIcon : '')}`}>
                                {isAchieved ? (
                                    <Trophy size={40} />
                                ) : (
                                    <Lock size={32} />
                                )}

                                {isCurrent && (
                                    <div className={styles.badgeCurrent}>
                                        <Sparkles size={10} style={{ marginRight: '4px' }} />
                                        Tu Rango Actual
                                    </div>
                                )}
                            </div>

                            {/* Rank Details Card */}
                            <div className={`${styles.rankCard} glass ${isCurrent ? styles.rankCardCurrent : ''}`}>
                                <div className={styles.rankHeader}>
                                    <div>
                                        <h3 className={styles.rankTitle}>{rank.name}</h3>
                                        <div className={styles.rankStatus}>
                                            {isCurrent ? (
                                                <span className={styles.statusAchieved}>✓ Rango Verificado</span>
                                            ) : isAchieved ? (
                                                <span className={styles.statusPast}>✓ Superado</span>
                                            ) : isNext ? (
                                                <span className={styles.statusNext}>🎯 Próximo Objetivo</span>
                                            ) : (
                                                <span className={styles.statusFuture}>Objetivo Futuro</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.benefitBox}>
                                        <div className={styles.benefitLabel}>Desbloqueo de Regalías</div>
                                        <div className={styles.benefitValue}>
                                            Hasta Nivel {Object.keys(rank.royalties_config || {}).length}
                                        </div>
                                    </div>

                                    {rank.reward_description && (
                                        <div className={styles.rewardContainer}>
                                            <div className={styles.rewardHeader}>
                                                <Sparkles size={14} color="#f59e0b" />
                                                <span>Premio de Rango</span>
                                            </div>
                                            <div className={styles.rewardValue}>{rank.reward_description}</div>

                                            {isAchieved && (
                                                <div className={styles.claimSection}>
                                                    {(() => {
                                                        const claim = claims.find(c => c.rank_id === rank.id)
                                                        if (!claim) {
                                                            return (
                                                                <button
                                                                    className={styles.claimBtn}
                                                                    onClick={() => handleClaimReward(rank.id)}
                                                                    disabled={claimingId === rank.id}
                                                                >
                                                                    {claimingId === rank.id ? <Loader2 className="spinner-small" size={14} /> : '🎁 Solicitar Premio'}
                                                                </button>
                                                            )
                                                        }
                                                        return (
                                                            <div className={`${styles.claimStatus} ${styles['status' + claim.status.charAt(0).toUpperCase() + claim.status.slice(1)]}`}>
                                                                {claim.status === 'pendiente' ? '⏳ Solicitud Pendiente' :
                                                                    claim.status === 'entregado' ? '✅ Premio Entregado' : '❌ Solicitud Rechazada'}
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.reqGrid}>
                                    <div className={styles.reqItem}>
                                        <div className={styles.reqLabel}>
                                            <Target size={14} color="#0ea5e9" /> PV Personal
                                        </div>
                                        <div className={styles.reqValue}>
                                            {rank.min_pv_monthly > 0 ? `${rank.min_pv_monthly} PV` : 'Sin Requisito'}
                                        </div>
                                    </div>
                                    <div className={styles.reqItem}>
                                        <div className={styles.reqLabel}>
                                            <TrendingUp size={14} color="#8b5cf6" /> PV Grupal (PVG)
                                        </div>
                                        <div className={styles.reqValue}>
                                            {rank.min_pvg > 0 ? `${rank.min_pvg} PVG` : 'Sin Requisito'}
                                        </div>
                                    </div>
                                    <div className={styles.reqItem}>
                                        <div className={styles.reqLabel}>
                                            <Users size={14} color="#10b981" /> Directos Activos
                                        </div>
                                        <div className={styles.reqValue}>
                                            {rank.min_active_directs || 0}
                                        </div>
                                    </div>

                                    {/* Progress Detail for Next Rank */}
                                    {isNext && (
                                        <div className={styles.progressSection}>
                                            <h4 style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ArrowUpRight size={18} /> Progreso para este Ascenso
                                            </h4>

                                            {rank.min_pv_monthly > 0 && (
                                                <div className={styles.progressItem}>
                                                    <div className={styles.progressMeta}>
                                                        <span>PV Personal</span>
                                                        <span>{profile?.monthly_pv || 0} / {rank.min_pv_monthly}</span>
                                                    </div>
                                                    <div className={styles.progressBar}>
                                                        <div className={styles.progressFill} style={{
                                                            width: `${Math.min(100, ((profile?.monthly_pv || 0) / rank.min_pv_monthly) * 100)}%`,
                                                            background: '#0ea5e9'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}

                                            {rank.min_pvg > 0 && (
                                                <div className={styles.progressItem}>
                                                    <div className={styles.progressMeta}>
                                                        <span>PV de Red (PVG)</span>
                                                        <span>{profile?.pvg || 0} / {rank.min_pvg}</span>
                                                    </div>
                                                    <div className={styles.progressBar}>
                                                        <div className={styles.progressFill} style={{
                                                            width: `${Math.min(100, ((profile?.pvg || 0) / rank.min_pvg) * 100)}%`,
                                                            background: '#8b5cf6'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}

                                            {rank.structure_requirements?.length > 0 && rank.structure_requirements.map((req, idx) => {
                                                const current = structureCounts[req.rank] || 0
                                                const total = req.count
                                                const isMet = current >= total

                                                return (
                                                    <div key={idx} className={styles.progressItem}>
                                                        <div className={styles.progressMeta}>
                                                            <span>Estructura: {total} {req.rank}{total > 1 ? 's' : ''}</span>
                                                            <span>{current} / {total}</span>
                                                        </div>
                                                        <div className={styles.progressBar}>
                                                            <div className={styles.progressFill} style={{
                                                                width: `${Math.min(100, (current / total) * 100)}%`,
                                                                background: isMet ? '#10b981' : '#f59e0b'
                                                            }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Static requirements for non-next ranks */}
                                    {!isNext && rank.structure_requirements?.length > 0 && (
                                        <div className={styles.progressSection} style={{ background: 'rgba(255,255,255,0.01)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 'bold' }}>
                                                Estructura Requerida:
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {rank.structure_requirements.map((req, idx) => (
                                                    <li key={idx}>{req.count} {req.rank}{req.count > 1 ? 's' : ''} en ramas distintas</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
