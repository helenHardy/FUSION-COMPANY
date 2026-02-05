
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
    const [combos, setCombos] = useState([])
    const [loading, setLoading] = useState(true)
    const [activatingId, setActivatingId] = useState(null)

    useEffect(() => {
        fetchInitialData()
    }, [])

    const fetchInitialData = async () => {
        setLoading(true)
        try {
            const [usersRes, combosRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select(`
                        *,
                        sponsor:sponsor_id (full_name),
                        combo:current_combo_id (id, name, price, pv_awarded)
                    `)
                    .eq('status', 'pendiente')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('combos')
                    .select('id, name, price, pv_awarded, free_products_count')
                    .eq('status', 'activo')
                    .order('price', { ascending: true })
            ])

            if (usersRes.error) throw usersRes.error
            if (combosRes.error) throw combosRes.error

            setPendingUsers(usersRes.data || [])
            setCombos(combosRes.data || [])
        } catch (err) {
            console.error("Error al cargar datos de activación:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleComboChange = async (userId, newComboId) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ current_combo_id: newComboId })
                .eq('id', userId)

            if (error) throw error

            // Actualizar localmente para no re-renderizar todo
            setPendingUsers(prev => prev.map(u => {
                if (u.id === userId) {
                    const newCombo = combos.find(c => c.id === newComboId)
                    return { ...u, current_combo_id: newComboId, combo: newCombo }
                }
                return u
            }))
        } catch (err) {
            alert("Error al cambiar combo: " + err.message)
        }
    }

    const handleActivate = async (userId) => {
        if (!confirm('¿Confirmas que has recibido el pago y deseas activar esta cuenta con el combo seleccionado?')) return

        setActivatingId(userId)
        try {
            const { error } = await supabase.rpc('activate_affiliate', {
                p_user_id: userId,
                p_admin_id: profile.id
            })

            if (error) throw error

            alert('Cuenta activada exitosamente. Se han distribuido los puntos y comisiones según el combo elegido.')
            fetchInitialData()
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
                                    <select
                                        className="input"
                                        style={{
                                            marginBottom: 0,
                                            padding: '4px 8px',
                                            fontSize: '0.85rem',
                                            height: 'auto',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--text-main)',
                                            width: '100%'
                                        }}
                                        value={user.current_combo_id}
                                        onChange={(e) => handleComboChange(user.id, e.target.value)}
                                    >
                                        {combos.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({formatCurrency(c.price)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.secondaryText} style={{ color: '#10b981', fontWeight: '800', marginTop: '4px' }}>
                                    <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                    {combos.find(c => c.id === user.current_combo_id)?.pv_awarded || user.combo?.pv_awarded || 0} PV otorgados
                                </div>
                                <div className={styles.secondaryText} style={{ color: '#f59e0b', fontWeight: '800', marginTop: '4px' }}>
                                    <ShoppingBag size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                    {combos.find(c => c.id === user.current_combo_id)?.free_products_count ?? user.combo?.free_products_count ?? 0} Prod. regalo
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
        </div >
    )
}
