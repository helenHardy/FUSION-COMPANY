
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
    ChevronDown, User, Shield, Activity,
    TrendingUp, Users, ArrowLeft, Loader2
} from 'lucide-react'
import styles from '../../dashboard/NetworkTree.module.css'

import NetworkNode from '../../../components/network/NetworkNode'

export default function AdminNetworkTree() {
    const { userId } = useParams()
    const navigate = useNavigate()
    const [rootUser, setRootUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (userId) {
            fetchUser()
        }
    }, [userId])

    const fetchUser = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error
            if (data) setRootUser(data)
        } catch (err) {
            console.error("Error al cargar usuario:", err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                <Loader2 className={styles.spinner} size={40} />
            </div>
        )
    }

    if (error || !rootUser) {
        return (
            <div className={styles.container}>
                <button onClick={() => navigate('/admin/users')} className="button secondary" style={{ marginBottom: '2rem' }}>
                    <ArrowLeft size={18} /> Volver a Usuarios
                </button>
                <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
                    <p style={{ color: '#f87171' }}>Error: {error || 'Usuario no encontrado'}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <button onClick={() => navigate('/admin/users')} className={styles.backBtn} title="Volver a Usuarios">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className={styles.title} style={{ margin: 0 }}>
                        Vista de <span className={styles.highlight}>Red Detallada</span>
                    </h1>
                </div>
                <p className={styles.subtitle}>
                    Explorando la organización de <strong>{rootUser.full_name}</strong>.
                </p>
            </header>

            <div className={`${styles.overviewCard} glass`}>
                <div className={styles.overviewIcon}>
                    <Users size={28} />
                </div>
                <div>
                    <div className={styles.overviewTitle}>Estructura Genealógica</div>
                    <div className={styles.overviewDesc}>Visualizando red desde la raíz de {rootUser.full_name}.</div>
                </div>
            </div>

            <div className={styles.treeRoot}>
                <NetworkNode affiliate={rootUser} />
            </div>
        </div>
    )
}
