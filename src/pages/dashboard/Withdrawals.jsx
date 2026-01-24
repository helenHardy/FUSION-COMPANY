
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Wallet, History, ArrowDownCircle, CheckCircle2, Clock, CreditCard, ShieldCheck, X, AlertCircle, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../../lib/utils'
import styles from './Withdrawals.module.css'

export default function Withdrawals() {
    const { profile } = useAuth()
    const [payouts, setPayouts] = useState([])
    const [loading, setLoading] = useState(true)
    const [balanceInfo, setBalanceInfo] = useState({ total_earned: 0, total_paid: 0, available: 0, total_pending: 0 })
    const [showModal, setShowModal] = useState(false)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [method, setMethod] = useState('Transferencia')
    const [submitting, setSubmitting] = useState(false)

    // Bank info state
    const [bankInfo, setBankInfo] = useState({ bank_name: '', account_number: '' })

    useEffect(() => {
        if (profile) {
            setBankInfo({
                bank_name: profile.bank_name || '',
                account_number: profile.account_number || ''
            })
        }
    }, [profile])

    useEffect(() => {
        if (profile?.id) {
            fetchData()
        }
    }, [profile])

    const fetchData = async () => {
        setLoading(true)
        try {
            const { data: payoutsData } = await supabase
                .from('payouts')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })

            setPayouts(payoutsData || [])

            const totalPaid = (payoutsData || [])
                .filter(p => p.status === 'pagado')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)

            const totalPending = (payoutsData || [])
                .filter(p => p.status === 'pendiente')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0)

            const totalEarned = profile.total_earnings || 0

            setBalanceInfo({
                total_earned: totalEarned,
                total_paid: totalPaid,
                total_pending: totalPending,
                available: totalEarned - (totalPaid + totalPending)
            })
        } catch (err) {
            console.error("Error al cargar datos de billetera:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleRequestWithdraw = async () => {
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            alert("Por favor ingresa un monto válido.")
            return
        }
        if (parseFloat(withdrawAmount) > balanceInfo.available) {
            alert("El monto supera tu saldo disponible.")
            return
        }

        if (method === 'Transferencia') {
            if (!bankInfo.bank_name.trim() || !bankInfo.account_number.trim()) {
                alert("Para transferencias, por favor completa los datos bancarios.")
                return
            }
        }

        setSubmitting(true)
        try {
            // Update profile bank info if changed and method is Transferencia
            if (method === 'Transferencia' && (bankInfo.bank_name !== profile.bank_name || bankInfo.account_number !== profile.account_number)) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        bank_name: bankInfo.bank_name,
                        account_number: bankInfo.account_number
                    })
                    .eq('id', profile.id)

                if (updateError) throw updateError
            }

            const { error } = await supabase.rpc('request_payout', {
                p_amount: parseFloat(withdrawAmount),
                p_method: method,
                p_notes: `Solicitud de retiro de ${profile.full_name}`
            })
            if (error) throw error
            setShowModal(false)
            setWithdrawAmount('')
            fetchData()
        } catch (err) {
            alert("Error al enviar la solicitud: " + err.message)
        } finally {
            setSubmitting(false)
        }
    }

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
                <h1 className={styles.title}>Billetera <span className={styles.highlight}>Fusion</span></h1>
                <p className={styles.subtitle}>Gestiona tus fondos corporativos y solicita tus retiros de forma transparente.</p>
            </header>

            <div className={styles.walletGrid}>
                {/* Main Balance Hero */}
                <div className={styles.balanceHero}>
                    <div className={styles.balanceContent}>
                        <div className={styles.balanceHeader}>
                            <div className={styles.walletIconBox}>
                                <CreditCard size={28} />
                            </div>
                            <span className={styles.balanceLabel}>Mis Ganancias</span>
                        </div>
                        <div className={styles.balanceAmount}>{formatCurrency(balanceInfo.available)}</div>
                        <button
                            className={styles.withdrawButton}
                            onClick={() => setShowModal(true)}
                        >
                            <ArrowDownCircle size={24} />
                            Solicitar Cobro
                        </button>
                    </div>
                </div>

                {/* Secondary Stats */}
                <div className={styles.statsContainer}>
                    <div className={`${styles.statCard} glass`}>
                        <div className={styles.iconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <div className={styles.statLabel}>Ganancias Históricas</div>
                            <div className={styles.statValue}>{formatCurrency(balanceInfo.total_earned)}</div>
                        </div>
                    </div>

                    <div className={`${styles.statCard} glass`}>
                        <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <Clock size={28} />
                        </div>
                        <div>
                            <div className={styles.statLabel}>En Proceso de Pago</div>
                            <div className={styles.statValue}>{formatCurrency(balanceInfo.total_pending)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions History */}
            <div className={`${styles.historyCard} glass`}>
                <div className={styles.historyHeader}>
                    <History size={22} color="var(--primary-color)" />
                    <h3 className={styles.historyTitle}>Historial de Cobros</h3>
                    {loading && <Loader2 className="spinner-small" size={18} style={{ marginLeft: 'auto' }} />}
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Fecha</th>
                                <th className={styles.th}>Monto Solicitado</th>
                                <th className={styles.th}>Método</th>
                                <th className={styles.th}>Estado Actual</th>
                                <th className={styles.th}>Referencia / Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.map(payout => (
                                <tr key={payout.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.date}>{formatDate(payout.created_at)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.amount}>{formatCurrency(payout.amount)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <span className={styles.method}>{payout.payment_method}</span>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={`${styles.statusWrapper} ${payout.status === 'pagado' ? styles.statusPaid : styles.statusPending}`}>
                                            {payout.status === 'pagado' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                            {payout.status === 'pagado' ? 'Completado' : 'Pendiente'}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.notes} title={payout.notes}>
                                            {payout.notes || 'Sin observaciones'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {payouts.length === 0 && !loading && (
                        <div className={styles.emptyState}>
                            <Wallet size={64} className={styles.emptyIcon} />
                            <h3>Tu historial está vacío</h3>
                            <p>Cuando realices tu primer retiro, aparecerá aquí detallado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showModal && (
                <div className={styles.modalOverlay}>
                    <div className={`${styles.modalContent} glass`}>
                        <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                            <X size={24} />
                        </button>

                        <h2 className={styles.modalTitle}>Solicitar Retiro</h2>

                        <div className={styles.alertBox}>
                            <AlertCircle size={20} style={{ flexShrink: 0 }} />
                            <span>
                                Tienes un saldo disponible de <b>{formatCurrency(balanceInfo.available)}</b>.
                                Las solicitudes se procesan en un máximo de 24-48 horas hábiles.
                            </span>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Importe a Retirar</label>
                            <div className={styles.inputWrapper}>
                                <span className={styles.currencySign}>$</span>
                                <input
                                    type="number"
                                    className={`input ${styles.inputAmount}`}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Método de Recepción</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="input"
                                style={{ fontWeight: '700' }}
                            >
                                <option value="Transferencia">Transferencia Bancaria</option>
                                <option value="Efectivo">Efectivo (Oficina)</option>
                                <option value="USDT">Billetera USDT (TRC20)</option>
                            </select>
                        </div>

                        {method === 'Transferencia' && (
                            <>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Banco</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={bankInfo.bank_name}
                                        onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                                        placeholder="Nombre del Banco"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Número de Cuenta</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={bankInfo.account_number}
                                        onChange={(e) => setBankInfo({ ...bankInfo, account_number: e.target.value })}
                                        placeholder="Número de Cuenta"
                                    />
                                </div>
                            </>
                        )}

                        <button
                            className={`button ${styles.submitButton}`}
                            onClick={handleRequestWithdraw}
                            disabled={submitting || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="spinner-small" size={20} />
                                    Procesando...
                                </>
                            ) : (
                                'Confirmar Solicitud'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
