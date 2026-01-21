
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Gift, CheckCircle, XCircle, Clock, User, Award, Loader2, Search } from 'lucide-react'
import { formatDate } from '../../../lib/utils'
import styles from './RewardsManager.module.css'

export default function RewardsManager() {
    const [claims, setClaims] = useState([])
    const [loading, setLoading] = useState(true)
    const [submittingId, setSubmittingId] = useState(null)
    const [filter, setFilter] = useState('pendiente')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchClaims()
    }, [])

    const fetchClaims = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('rank_reward_claims')
                .select(`
                    *,
                    user:user_id (full_name, document_id),
                    rank:rank_id (name, reward_description)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setClaims(data || [])
        } catch (err) {
            console.error("Error fetching claims:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (id, newStatus) => {
        if (submittingId) return
        setSubmittingId(id)
        try {
            const { error } = await supabase
                .from('rank_reward_claims')
                .update({ status: newStatus, updated_at: new Date() })
                .eq('id', id)

            if (error) throw error
            fetchClaims()
        } catch (err) {
            alert("Error al actualizar estado: " + err.message)
        } finally {
            setSubmittingId(null)
        }
    }

    const filteredClaims = claims.filter(c => {
        const matchesFilter = filter === 'all' || c.status === filter
        const matchesSearch = c.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.user?.document_id?.includes(searchTerm)
        return matchesFilter && matchesSearch
    })

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Gestión de <span className={styles.highlight}>Premios</span>
                </h1>
                <p className={styles.subtitle}>Supervisa y aprueba la entrega de premios físicos por alcance de rango.</p>
            </header>

            <div className={`${styles.toolbar} glass`}>
                <div className={styles.searchWrapper}>
                    <Search size={18} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar afiliado..."
                        className="input"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className={styles.filterTabs}>
                    {['pendiente', 'entregado', 'rechazado', 'all'].map(f => (
                        <button
                            key={f}
                            className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.grid}>
                {loading ? (
                    <div className={styles.loaderBox}>
                        <Loader2 className="spinner" size={40} />
                    </div>
                ) : filteredClaims.length > 0 ? (
                    filteredClaims.map(claim => (
                        <div key={claim.id} className={`${styles.claimCard} glass`}>
                            <div className={styles.cardHeader}>
                                <div className={styles.userInfo}>
                                    <div className={styles.avatar}>
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <div className={styles.userName}>{claim.user?.full_name}</div>
                                        <div className={styles.userDoc}>CI: {claim.user?.document_id}</div>
                                    </div>
                                </div>
                                <div className={`${styles.statusBadge} ${styles['status' + claim.status.charAt(0).toUpperCase() + claim.status.slice(1)]}`}>
                                    {claim.status}
                                </div>
                            </div>

                            <div className={styles.rewardInfo}>
                                <div className={styles.rankNfo}>
                                    <Award size={16} color="var(--primary-color)" />
                                    <span>Rango: <strong>{claim.rank?.name}</strong></span>
                                </div>
                                <div className={styles.rewardDesc}>
                                    <Gift size={16} color="#f59e0b" />
                                    <span>Premio: <strong>{claim.rank?.reward_description}</strong></span>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.date}>
                                    <Clock size={14} /> {formatDate(claim.created_at)}
                                </div>

                                {claim.status === 'pendiente' && (
                                    <div className={styles.actions}>
                                        <button
                                            className={styles.rejectBtn}
                                            onClick={() => handleUpdateStatus(claim.id, 'rechazado')}
                                            disabled={submittingId === claim.id}
                                        >
                                            <XCircle size={16} /> Rechazar
                                        </button>
                                        <button
                                            className={styles.approveBtn}
                                            onClick={() => handleUpdateStatus(claim.id, 'entregado')}
                                            disabled={submittingId === claim.id}
                                        >
                                            {submittingId === claim.id ? <Loader2 className="spinner-small" size={16} /> : <CheckCircle size={16} />}
                                            Entregado
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <Gift size={64} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <h3>No hay solicitudes</h3>
                        <p>Las solicitudes de premios aparecerán aquí cuando los afiliados las realicen.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
