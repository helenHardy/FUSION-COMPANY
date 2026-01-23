
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { BadgeDollarSign, Search, Filter, Send, CheckCircle, Wallet, User, Loader2, CreditCard, Banknote, Clock, XCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import styles from './PayoutManager.module.css'

export default function PayoutManager() {
    const { profile } = useAuth()
    const [activeTab, setActiveTab] = useState('saldos') // 'saldos' | 'solicitudes'
    const [users, setUsers] = useState([])
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [payoutForm, setPayoutForm] = useState({ amount: '', method: 'efectivo', notes: '' })

    useEffect(() => {
        if (activeTab === 'saldos') fetchUsersWithBalance()
        else fetchPendingRequests()
    }, [activeTab])

    const fetchUsersWithBalance = async () => {
        try {
            setLoading(true)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, total_earnings, current_rank, bank_name, account_number')
                .order('total_earnings', { ascending: false })

            const { data: payouts } = await supabase
                .from('payouts')
                .select('user_id, amount')
                .eq('status', 'pagado')

            const usersWithBalance = (profiles || []).map(p => {
                const totalPaid = (payouts || [])
                    .filter(pay => pay.user_id === p.id)
                    .reduce((sum, pay) => sum + parseFloat(pay.amount), 0)

                return {
                    ...p,
                    available_balance: Math.max(0, (p.total_earnings || 0) - totalPaid)
                }
            })

            setUsers(usersWithBalance)
        } catch (err) {
            console.error("Error fetching payouts data:", err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPendingRequests = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('payouts')
                .select('*, profiles!user_id(full_name)')
                .eq('status', 'pendiente')
                .order('created_at', { ascending: true })

            if (error) throw error
            setRequests(data || [])
        } catch (err) {
            console.error("Error fetching requests:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenPayout = (user) => {
        setSelectedUser(user)
        setPayoutForm({ amount: user.available_balance, method: 'efectivo', notes: '' })
        setShowModal(true)
    }

    const processPayout = async (e) => {
        e.preventDefault()
        if (!confirm(`¿Confirmas que has entregado ${formatCurrency(payoutForm.amount)} a ${selectedUser.full_name}?`)) return

        setIsProcessing(true)
        try {
            const { error } = await supabase.rpc('process_payout', {
                p_user_id: selectedUser.id,
                p_admin_id: profile.id,
                p_amount: parseFloat(payoutForm.amount),
                p_method: payoutForm.method,
                p_notes: payoutForm.notes
            })

            if (error) throw error

            setShowModal(false)
            fetchUsersWithBalance()
        } catch (err) {
            alert("Error: " + err.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleApprove = async (id) => {
        if (!confirm('¿Deseas aprobar este retiro? El monto se marcará como pagado.')) return
        try {
            setLoading(true)
            const { error } = await supabase.rpc('approve_payout', {
                p_payout_id: id,
                p_admin_id: profile.id
            })
            if (error) throw error
            fetchPendingRequests()
        } catch (err) {
            alert("Error al aprobar: " + err.message)
            setLoading(false)
        }
    }

    const handleReject = async (id) => {
        const reason = prompt('Motivo del rechazo:')
        if (!reason) return
        try {
            setLoading(true)
            const { error } = await supabase.rpc('reject_payout', {
                p_payout_id: id,
                p_admin_id: profile.id,
                p_reason: reason
            })
            if (error) throw error
            fetchPendingRequests()
        } catch (err) {
            alert("Error al rechazar: " + err.message)
            setLoading(false)
        }
    }

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (u.total_earnings > 0 || u.available_balance > 0)
    )

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Control de <span className={styles.highlight}>Pagos y Billetera</span>
                    </h1>
                    <p className={styles.subtitle}>Gestión administrativa de retiros, comisiones pendientes y desembolsos a socios.</p>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'saldos' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('saldos')}
                    >
                        <Wallet size={18} /> Saldos Disponibles
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'solicitudes' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('solicitudes')}
                    >
                        <Clock size={18} /> Solicitudes Pendientes
                        {requests.length > 0 && <span className={styles.badge}>{requests.length}</span>}
                    </button>
                </div>
            </header>

            <div className={`${styles.filterSection} glass`}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={20} />
                    <input
                        type="text"
                        placeholder={activeTab === 'saldos' ? "Buscar socio por nombre..." : "Filtrar solicitudes..."}
                        className={`input ${styles.searchInput}`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className={`${styles.tableCard} glass`}>
                {activeTab === 'saldos' ? (
                    <Table headers={['Socio / Consultor', 'Rango Actual', 'Datos Bancarios', 'Ganancia Histórica', 'Saldo', 'Acciones']}>
                        {loading && users.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Loader2 className="spinner" size={40} />
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr key={u.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.userName}>{u.full_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ID: {u.id.substring(0, 8)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.rankBadge}>
                                            {u.current_rank || 'Básico'}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.bankInfo}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{u.bank_name || '---'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.account_number || 'Cuenta no registrada'}</div>
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.earningsText}>
                                            {formatCurrency(u.total_earnings)}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={`${styles.balanceText} ${u.available_balance > 0 ? styles.balanceActive : styles.balanceZero}`}>
                                            {formatCurrency(u.available_balance)}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <button
                                            className={`button btn-secondary ${styles.payoutBtn}`}
                                            disabled={u.available_balance <= 0}
                                            onClick={() => handleOpenPayout(u)}
                                        >
                                            <BadgeDollarSign size={16} /> Registrar Pago
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </Table>
                ) : (
                    <Table headers={['Fecha', 'Socio', 'Monto', 'Método', 'Acciones']}>
                        {loading && requests.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Loader2 className="spinner" size={40} />
                                </td>
                            </tr>
                        ) : (
                            requests.map(req => (
                                <tr key={req.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{formatDate(req.created_at)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.userName}>{req.profiles?.full_name}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.amountText}>{formatCurrency(req.amount)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.methodBadge}>{req.payment_method}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.actionGroup}>
                                            <button
                                                className={styles.approveBtn}
                                                title="Aprobar Pago"
                                                onClick={() => handleApprove(req.id)}
                                            >
                                                <CheckCircle2 size={18} />
                                            </button>
                                            <button
                                                className={styles.rejectBtn}
                                                title="Rechazar"
                                                onClick={() => handleReject(req.id)}
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </Table>
                )}

                {!loading && (activeTab === 'saldos' ? filteredUsers.length === 0 : requests.length === 0) && (
                    <div className={styles.emptyState}>
                        <Wallet size={64} className={styles.emptyIcon} />
                        <h3>{activeTab === 'saldos' ? 'Sin saldos pendientes' : 'Sin solicitudes pendientes'}</h3>
                        <p>{activeTab === 'saldos' ? 'No se encontraron socios con saldo disponible.' : 'No hay retiros esperando aprobación.'}</p>
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Procesar Pago: ${selectedUser?.full_name}`}>
                <form onSubmit={processPayout} className={styles.form}>
                    <div className={styles.amountHighlight}>
                        <label className={styles.amountLabel}>Monto a Desembolsar (Bs)</label>
                        <input
                            type="number"
                            className={`input ${styles.amountInput}`}
                            required
                            step="0.01"
                            max={selectedUser?.available_balance}
                            value={payoutForm.amount}
                            onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                            autoFocus
                        />
                        <div className={styles.maxBalance}>
                            Saldo Disponible: <span style={{ color: 'white', fontWeight: '800' }}>{formatCurrency(selectedUser?.available_balance)}</span>
                        </div>
                    </div>

                    <div className={styles.bankReferenceBox}>
                        <div className={styles.bankReferenceHeader}>
                            <CreditCard size={16} /> Datos de Pago del Socio
                        </div>
                        <div className={styles.bankReferenceContent}>
                            <div className={styles.bankRefLine}>
                                <span>Banco:</span> <strong>{selectedUser?.bank_name || 'No especificado'}</strong>
                            </div>
                            <div className={styles.bankRefLine}>
                                <span>Cuenta:</span> <strong>{selectedUser?.account_number || 'No especificada'}</strong>
                            </div>
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Método de Desembolso</label>
                        <div style={{ position: 'relative' }}>
                            <Banknote size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} />
                            <select
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                value={payoutForm.method}
                                onChange={e => setPayoutForm({ ...payoutForm, method: e.target.value })}
                            >
                                <option value="efectivo">Efectivo (Caja)</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                                <option value="tigo_money">Tigo Money</option>
                                <option value="otros">Otros Métodos</option>
                            </select>
                        </div>
                    </div>

                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Observaciones y Referencia</label>
                        <textarea
                            className="input"
                            rows="3"
                            placeholder="Ej: Pago de regalías correspondientes al periodo 2024-12. Referencia bancaria #..."
                            value={payoutForm.notes}
                            onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                        />
                    </div>

                    <div className={styles.actions}>
                        <button type="button" className={`button btn-secondary ${styles.cancelBtn}`} onClick={() => setShowModal(false)}>
                            Cancelar
                        </button>
                        <button type="submit" className={`button ${styles.confirmBtn}`} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="spinner-small" size={20} /> : <><CheckCircle size={20} /> Confirmar Transacción</>}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
