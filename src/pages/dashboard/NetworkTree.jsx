
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
    ChevronRight, ChevronDown, User, Shield, Activity,
    TrendingUp, Users, Target, Loader2
} from 'lucide-react'
import styles from './NetworkTree.module.css'

function NetworkNode({ affiliate, level = 0 }) {
    const [isOpen, setIsOpen] = useState(false)
    const [children, setChildren] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchChildren = async () => {
        if (isOpen || loading) return
        setLoading(true)
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('sponsor_id', affiliate.id)
            setChildren(data || [])
        } catch (err) {
            console.error("Error al cargar descendencia:", err)
        } finally {
            setLoading(false)
        }
    }

    const toggleOpen = (e) => {
        e.stopPropagation()
        if (!isOpen) fetchChildren()
        setIsOpen(!isOpen)
    }

    const isAdmin = affiliate.role === 'admin'
    const isActive = affiliate.status === 'activo'

    return (
        <div className={styles.nodeWrapper}>
            <div
                onClick={toggleOpen}
                className={`${styles.nodeCard} ${isOpen ? styles.nodeCardOpen : ''}`}
            >
                <div className={`${styles.chevronIcon} ${isOpen ? styles.chevronIconOpen : ''}`}>
                    <ChevronDown size={20} />
                </div>

                <div className={`${styles.avatarBox} ${isAdmin ? styles.avatarAdmin : styles.avatarUser}`}>
                    {isAdmin ? <Shield size={28} /> : <User size={28} />}
                </div>

                <div className={styles.nodeContent}>
                    <div className={styles.nodeName}>{affiliate.full_name}</div>
                    <div className={styles.nodeMeta}>
                        <div className={styles.metaItem}>
                            <Target size={14} color="var(--primary-color)" />
                            <span>Rango:</span>
                            <span className={styles.metaValue}>{affiliate.current_rank || 'Bronce'}</span>
                        </div>
                        <div className={styles.metaItem}>
                            <Activity size={14} color="#f59e0b" />
                            <span>PV:</span>
                            <span className={styles.metaValue}>{affiliate.pv || 0}</span>
                        </div>
                        <div className={styles.metaItem}>
                            <TrendingUp size={14} color="#22d3ee" />
                            <span>PVG:</span>
                            <span className={styles.metaValue}>{affiliate.pvg || 0}</span>
                        </div>
                    </div>
                </div>

                <div className={`${styles.statusIndicator} ${isActive ? styles.active : styles.inactive}`}>
                    {affiliate.status}
                </div>
            </div>

            {isOpen && (
                <div className={styles.childrenBox}>
                    {loading ? (
                        <div className={styles.emptyState}>
                            <div className={styles.spinner} />
                            Cargando red...
                        </div>
                    ) : children.length > 0 ? (
                        children.map(child => <NetworkNode key={child.id} affiliate={child} level={level + 1} />)
                    ) : (
                        <div className={styles.emptyState}>
                            No hay afiliados directos en este nivel
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function NetworkTree() {
    const { profile } = useAuth()
    const [rootUser, setRootUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile) {
            setRootUser(profile)
            setLoading(false)
        }
    }, [profile])

    if (loading || !rootUser) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                <Loader2 className={styles.spinner} size={40} />
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Red de <span className={styles.highlight}>Socios</span>
                </h1>
                <p className={styles.subtitle}>
                    Visualiza y gestiona el crecimiento de tu organización Fusion en tiempo real.
                </p>
            </header>

            <div className={`${styles.overviewCard} glass`}>
                <div className={styles.overviewIcon}>
                    <Users size={28} />
                </div>
                <div>
                    <div className={styles.overviewTitle}>Estructura Genealógica</div>
                    <div className={styles.overviewDesc}>Haz clic en los socios para expandir y ver su red descendente.</div>
                </div>
            </div>

            <div className={styles.treeRoot}>
                <NetworkNode affiliate={rootUser} />
            </div>
        </div>
    )
}
