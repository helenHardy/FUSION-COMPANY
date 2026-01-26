import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
    ChevronDown, User, Shield, Activity,
    TrendingUp, Loader2
} from 'lucide-react'
import styles from '../../pages/dashboard/NetworkTree.module.css'

export default function NetworkNode({ affiliate }) {
    const [isOpen, setIsOpen] = useState(false)
    const [children, setChildren] = useState([])
    const [loading, setLoading] = useState(false)

    const fetchChildren = async () => {
        if (isOpen || loading) return
        setLoading(true)
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*, combos(name)')
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
        <div className={styles.branch}>
            <div className={styles.nodeContainer}>
                <div
                    onClick={toggleOpen}
                    className={`${styles.nodeCard} ${isOpen ? styles.nodeCardOpen : ''} ${isActive ? styles.activeCard : styles.inactiveCard}`}
                >
                    <div className={`${styles.avatarContainer} ${isAdmin ? styles.avatarAdmin : styles.avatarUser}`}>
                        {isAdmin ? <Shield size={24} /> : <User size={24} />}
                        <div className={styles.rankBadge}>{affiliate.current_rank || 'Bronce'}</div>
                    </div>

                    <div className={styles.nodeBody}>
                        <div className={styles.nodeName}>{affiliate.full_name}</div>
                        <div className={styles.nodeStats}>
                            <div className={styles.statLine}>
                                <Activity size={10} /> <span>{affiliate.pv || 0} PV</span>
                            </div>
                            <div className={styles.statLine}>
                                <TrendingUp size={10} /> <span>{affiliate.pvg || 0} PVG</span>
                            </div>
                        </div>
                        <div className={styles.comboBadge}>
                            {affiliate.combos?.name || 'Sin Combo'}
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.nodeLoading}>
                            <Loader2 className={styles.spinIcon} size={14} />
                        </div>
                    ) : (
                        <div className={`${styles.nodeToggle} ${isOpen ? styles.nodeToggleOpen : ''}`}>
                            <ChevronDown size={14} />
                        </div>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className={styles.childrenContainer}>
                    {children.length > 0 ? (
                        children.map(child => <NetworkNode key={child.id} affiliate={child} />)
                    ) : !loading && (
                        <div className={styles.leafEnd}>
                            <div className={styles.leafLine}></div>
                            <span className={styles.leafText}>Sin afiliados</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
