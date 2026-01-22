
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { UserCheck, Loader2, AlertCircle, ShoppingBag, User, Calendar, Sparkles } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import styles from './UserList.module.css' // Reusing styles

export default function PendingActivations() {
    const { profile } = useAuth()
    const [pendingUsers, setPendingUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [activatingId, setActivatingId] = useState(null)

    useEffect(() => {
        fetchPendingUsers()
    }, [])

    const fetchPendingUsers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    sponsor:sponsor_id (full_name),
                    combo:current_combo_id (name, price, pv_awarded)
                `)
                .eq('status', 'pendiente')
                .order('created_at', { ascending: false })

            if (error) throw error
            setPendingUsers(data || [])
        } catch (err) {
            console.error("Error al cargar pendientes:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleActivate = async (userId) => {
        if (!confirm('¿Confirmas que has recibido el pago y deseas activar esta cuenta?')) return

        setActivatingId(userId)
        try {
            const { error } = await supabase.rpc('activate_affiliate', {
                p_user_id: userId,
                p_admin_id: profile.id
            })

            if (error) throw error

            alert('Cuenta activada exitosamente. Se han distribuido los puntos y comisiones.')
            fetchPendingUsers()
        } catch (err) {
            console.error("Error al activar:", err)
            alert("Error al activar: " + err.message)
        } finally {
            setActivatingId(null)
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Activaciones <span className={styles.highlight}>Pendientes</span>
                </h1>
                <p className={styles.subtitle}>Confirma el pago de los nuevos socios para activar sus beneficios en la red.</p>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Afiliado', 'Combo / Precio', 'Patrocinador', 'Fecha Registro', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : pendingUsers.map(user => (
                        <tr key={user.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.userCell}>
                                    <div className={`${styles.avatar} ${styles.affiliateAvatar}`}>
                                        {user.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <div className={styles.userName}>{user.full_name}</div>
                                        <div className={styles.secondaryText}>CI: {user.document_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.dataText}>
                                    <ShoppingBag size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                    {user.combo?.name || 'N/A'}
                                </div>
                                <div className={styles.secondaryText} style={{ color: '#10b981', fontWeight: '800' }}>
                                    {formatCurrency(user.combo?.price || 0)}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.sponsorText}>
                                    <User size={14} style={{ display: 'inline', marginRight: '6px', opacity: 0.5 }} />
                                    {user.sponsor?.full_name || '—'}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.secondaryText}>
                                    <Calendar size={14} style={{ display: 'inline', marginRight: '6px', opacity: 0.5 }} />
                                    {formatDate(user.created_at)}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <button
                                    className={styles.actionBtn}
                                    style={{ width: 'auto', padding: '0 1rem', gap: '8px', color: '#10b981' }}
                                    onClick={() => handleActivate(user.id)}
                                    disabled={activatingId === user.id}
                                >
                                    {activatingId === user.id ? (
                                        <Loader2 className="spinner-small" size={18} />
                                    ) : (
                                        <>
                                            <Sparkles size={18} />
                                            <span>Activar Pago</span>
                                        </>
                                    )}
                                </button>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && pendingUsers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <UserCheck size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No hay activaciones pendientes en este momento.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
