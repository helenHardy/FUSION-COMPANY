
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { Wallet, CheckCircle2, Search, User, CreditCard, Loader2 } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import styles from './LiquidationManager.module.css'

export default function LiquidationManager() {
    const { profile } = useAuth()
    const [debtors, setDebtors] = useState([])
    const [loading, setLoading] = useState(true)
    const [isLiquidating, setIsLiquidating] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchDebtors()
    }, [])

    const fetchDebtors = async () => {
        try {
            setLoading(true)
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .gt('pending_liquidation', 0)
                .order('pending_liquidation', { ascending: false })

            setDebtors(data || [])
        } catch (err) {
            console.error("Error fetching debtors:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleLiquidate = async (userId, amount) => {
        if (!confirm(`¿Confirmas que has recibido ${formatCurrency(amount)} de este socio? Esta acción saldará su deuda en el sistema.`)) return

        setIsLiquidating(true)
        try {
            const { error } = await supabase.rpc('liquidate_user_balance', {
                p_user_id: userId,
                p_admin_id: profile.id
            })

            if (error) throw error

            // Update local state for immediate feedback
            setDebtors(prev => prev.filter(d => d.id !== userId))
        } catch (err) {
            alert("Error: " + err.message)
        } finally {
            setIsLiquidating(false)
        }
    }

    const filteredDebtors = debtors.filter(d =>
        d.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.document_id?.includes(searchQuery)
    )

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Gestión de <span className={styles.highlight}>Liquidaciones</span>
                </h1>
                <p className={styles.subtitle}>Supervisión y control de efectivo pendiente de entrega por socios.</p>
            </header>

            <div className={`${styles.searchSection} glass`}>
                <div className={styles.inputWrapper}>
                    <Search className={styles.searchIcon} size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o número de documento..."
                        className={`input ${styles.searchInput}`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Socio / Consultor', 'Identificación', 'Monto Pendiente', 'Operaciones']}>
                    {loading && debtors.length === 0 ? (
                        <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : (
                        filteredDebtors.map(debtor => (
                            <tr key={debtor.id} className={styles.tr}>
                                <td className={styles.td}>
                                    <div className={styles.debtorCell}>
                                        <div className={styles.avatar}>
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div className={styles.name}>{debtor.full_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Socio Activo</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <div className={styles.doc}>{debtor.document_id || 'N/A'}</div>
                                </td>
                                <td className={styles.td}>
                                    <div className={styles.debtAmount}>
                                        {formatCurrency(debtor.pending_liquidation)}
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <button
                                        className={styles.actionBtn}
                                        onClick={() => handleLiquidate(debtor.id, debtor.pending_liquidation)}
                                        disabled={isLiquidating}
                                    >
                                        {isLiquidating ? <Loader2 className="spinner-small" size={18} /> : <CheckCircle2 size={18} />}
                                        Saldar Deuda
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </Table>

                {!loading && filteredDebtors.length === 0 && (
                    <div className={styles.emptyState}>
                        <Wallet size={64} className={styles.emptyIcon} />
                        <h3>Sin Pendientes</h3>
                        <p>No se encontraron socios con deudas de liquidación activas.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
