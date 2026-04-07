import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Search, ShieldCheck, TrendingUp, AlertTriangle, User, GitBranch, ArrowUpRight, ArrowDownRight, Loader2, CheckCircle2, XCircle, Info, DollarSign, Wallet, BadgeDollarSign, Crown } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import styles from './Audit.module.css'

export default function Audit() {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)
    const [loading, setLoading] = useState(false)
    const [ledger, setLedger] = useState([])
    const [diagnostics, setDiagnostics] = useState([])
    const [activeTab, setActiveTab] = useState('commissions')
    const [ranks, setRanks] = useState([])

    // Fetch ranks once for qualification checks
    useEffect(() => {
        const fetchRanks = async () => {
            const { data } = await supabase.from('ranks').select('*').order('min_pv', { ascending: true })
            if (data) setRanks(data)
        }
        fetchRanks()
    }, [])

    // Debounced Search for users
    useEffect(() => {
        if (searchTerm.length < 3) {
            setSearchResults([])
            return
        }

        const delayDebounceFn = setTimeout(async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, document_id, current_rank, status')
                .or(`full_name.ilike.%${searchTerm}%,document_id.ilike.%${searchTerm}%`)
                .limit(5)
            
            if (data) setSearchResults(data)
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [searchTerm])

    const handleSelectUser = async (user) => {
        setSearchTerm('')
        setSearchResults([])
        setLoading(true)
        setSelectedUser(user)
        
        try {
            // Fetch detailed profile
            const { data: profile } = await supabase
                .from('profiles')
                .select(`
                    *,
                    sponsor:sponsor_id (full_name)
                `)
                .eq('id', user.id)
                .single()
            
            if (profile) setSelectedUser(profile)

            // Fetch ledger data (commissions, liquidations, payouts)
            const [commissions, liquidations, payouts, bonuses] = await Promise.all([
                supabase.from('commissions').select('*').eq('beneficiary_id', user.id).order('created_at', { ascending: false }),
                supabase.from('liquidations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('payouts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('user_monthly_bonuses').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
            ])

            const combinedLedger = [
                ...(commissions.data || []).map(c => ({ ...c, type: 'commission', sortDate: new Date(c.created_at) })),
                ...(liquidations.data || []).map(l => ({ ...l, type: 'liquidation', amount: -l.amount, sortDate: new Date(l.created_at) })),
                ...(payouts.data || []).map(p => ({ ...p, type: 'payout', amount: -p.amount, sortDate: new Date(p.created_at) })),
                ...(bonuses.data || []).map(b => ({ ...b, type: 'bonus', sortDate: new Date(b.created_at) }))
            ].sort((a, b) => b.sortDate - a.sortDate)

            setLedger(combinedLedger)

            // Run Diagnostics
            runDiagnostics(profile, combinedLedger)

        } catch (err) {
            console.error("Error al auditar usuario:", err)
        } finally {
            setLoading(false)
        }
    }

    const runDiagnostics = (profile, ledgerData) => {
        const checks = []

        // 1. Balance Consistency Check
        const totalEarningsCalculated = ledgerData
            .filter(item => item.type === 'commission' || item.type === 'bonus')
            .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
        
        const totalPaidOut = ledgerData
            .filter(item => item.type === 'liquidation' || item.type === 'payout')
            .reduce((acc, curr) => acc + Math.abs(Number(curr.amount) || 0), 0)

        const expectedBalance = totalEarningsCalculated - totalPaidOut
        const actualBalance = Number(profile.withdrawable_balance) || 0

        if (Math.abs(expectedBalance - actualBalance) < 0.01) {
            checks.push({ 
                label: 'Consistencia de Saldo', 
                status: 'success', 
                msg: `El balance neto coincide con el historial (${formatCurrency(actualBalance)}).` 
            })
        } else {
            checks.push({ 
                label: 'Consistencia de Saldo', 
                status: 'error', 
                msg: `Discrepancia detectada. Calculado (Neto): ${formatCurrency(expectedBalance)}, Actual en perfil: ${formatCurrency(actualBalance)}.` 
            })
        }

        // 1b. Historical Verification
        if (Math.abs(totalEarningsCalculated - Number(profile.total_earnings)) > 0.01) {
            checks.push({
                label: 'Historial Acumulado',
                status: 'warning',
                msg: `El total ganado histórico (${formatCurrency(profile.total_earnings)}) no coincide con la suma de comisiones (${formatCurrency(totalEarningsCalculated)}).`
            })
        }

        // 2. Rank Qualification Check
        const currentRank = ranks.find(r => r.name === profile.current_rank)
        if (currentRank) {
            const hasPV = (Number(profile.monthly_pv) || 0) >= (Number(currentRank.min_pv_monthly) || 0)
            const hasPVG = (Number(profile.monthly_pvg) || 0) >= (Number(currentRank.min_pvg) || 0) // Or whatever the group requirement is
            
            if (hasPV) {
                checks.push({ label: 'Puntos Personales (PV)', status: 'success', msg: `Cumple los ${currentRank.min_pv_monthly} PV requeridos para ser ${profile.current_rank}.` })
            } else {
                checks.push({ label: 'Puntos Personales (PV)', status: 'warning', msg: `No cumple el mínimo (${currentRank.min_pv_monthly}) para su rango actual.` })
            }
        }

        // 3. Sponsor Check
        if (profile.sponsor_id) {
            checks.push({ label: 'Patrocinio', status: 'success', msg: `Patrocinado correctamente por ${profile.sponsor?.full_name}.` })
        } else {
            checks.push({ label: 'Patrocinio', status: 'error', msg: 'Este usuario no tiene patrocinador asignado (Huérfano).' })
        }

        // 4. Status Check
        if (profile.status === 'activo') {
            checks.push({ label: 'Estado de Cuenta', status: 'success', msg: 'La cuenta se encuentra activa.' })
        } else {
            checks.push({ label: 'Estado de Cuenta', status: 'warning', msg: `Cuenta en estado: ${profile.status}.` })
        }

        setDiagnostics(checks)
    }

    const filteredLedger = ledger.filter(item => {
        if (activeTab === 'commissions') return item.type === 'commission' || item.type === 'bonus'
        if (activeTab === 'payouts') return item.type === 'liquidation' || item.type === 'payout'
        return true
    })

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Auditoría de <span className={styles.highlight}>Movimientos</span>
                </h1>
                <p className={styles.subtitle}>Supervisión profunda de comisiones, rangos y balances financieros.</p>
            </header>

            {/* Search Section */}
            <div className={styles.searchSection}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={22} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o documento del cliente..."
                        className={styles.searchInput}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchResults.length > 0 && (
                        <div className={styles.suggestions}>
                            {searchResults.map(user => (
                                <div 
                                    key={user.id} 
                                    className={styles.suggestionItem}
                                    onClick={() => handleSelectUser(user)}
                                >
                                    <div>
                                        <div className={styles.suggestionName}>{user.full_name}</div>
                                        <div className={styles.suggestionDetail}>{user.document_id} • {user.current_rank}</div>
                                    </div>
                                    <div className={styles.suggestionDetail}>{user.status}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex-center" style={{ height: '400px', flexDirection: 'column', gap: '1rem' }}>
                    <Loader2 className="spinner" size={48} />
                    <p className="text-dim">Reconstruyendo historial financiero...</p>
                </div>
            ) : selectedUser ? (
                <div className="animate-in">
                    {/* Profile Overview Card */}
                    <div className={styles.profileCard}>
                        <div className={styles.avatarLg}>
                            {selectedUser.full_name?.charAt(0)}
                        </div>
                        <div className={styles.userInfo}>
                            <h2>{selectedUser.full_name}</h2>
                            <div className={styles.userBadges}>
                                <span className={`${styles.badge} ${styles.rankBadge}`}>
                                    <Crown size={14} style={{ marginRight: '4px' }} /> {selectedUser.current_rank}
                                </span>
                                <span className={`${styles.badge} ${styles.statusBadge}`}>
                                    {selectedUser.status}
                                </span>
                                <span className={`${styles.badge} ${styles.roleBadge}`}>
                                    {selectedUser.role}
                                </span>
                            </div>
                            <p style={{ marginTop: '1rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                                ID: {selectedUser.document_id} • Miembro desde {formatDate(selectedUser.created_at)}
                            </p>
                        </div>
                        <div className={styles.balancesGrid}>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>Saldo Disponible</span>
                                <span className={`${styles.balanceValue} ${styles.positive}`}>{formatCurrency(selectedUser.withdrawable_balance)}</span>
                            </div>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>Ganancia Total</span>
                                <span className={styles.balanceValue}>{formatCurrency(selectedUser.total_earnings)}</span>
                            </div>
                            <div className={styles.balanceItem}>
                                <span className={styles.balanceLabel}>Pend. Liquidar</span>
                                <span className={styles.balanceValue}>{formatCurrency(selectedUser.pending_liquidation)}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.auditGrid}>
                        {/* Unified Ledger Tabs */}
                        <div className={styles.tabsContainer}>
                            <div className={styles.tabsHeader}>
                                <button 
                                    className={`${styles.tabBtn} ${activeTab === 'commissions' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('commissions')}
                                >
                                    Ingresos y Bonos
                                </button>
                                <button 
                                    className={`${styles.tabBtn} ${activeTab === 'payouts' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('payouts')}
                                >
                                    Egresos y Pagos
                                </button>
                                <button 
                                    className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabActive : ''}`}
                                    onClick={() => setActiveTab('all')}
                                >
                                    Todo el Historial
                                </button>
                            </div>
                            <div className={styles.tabContent}>
                                <table className={styles.auditTable}>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo / Concepto</th>
                                            <th>Fuente / Destino</th>
                                            <th>Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLedger.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                                                    No se encontraron movimientos.
                                                </td>
                                            </tr>
                                        ) : filteredLedger.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>{formatDate(item.created_at)}</td>
                                                <td>
                                                    <span style={{ fontWeight: 700, display: 'block' }}>
                                                        {item.commission_type || item.type?.toUpperCase()}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                                        Nivel {item.level_depth || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>{item.source_user_id ? 'Venta en Red' : 'Sistemático'}</td>
                                                <td className={`${styles.amount} ${item.amount > 0 ? styles.positiveAmount : styles.negativeAmount}`}>
                                                    {item.amount > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                    {formatCurrency(Math.abs(item.amount))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Diagnostics Sidebar */}
                        <aside className={styles.diagnostics}>
                            <div className={styles.diagCard}>
                                <h3><ShieldCheck color="#10b981" /> Diagnóstico</h3>
                                <div className={styles.diagList}>
                                    {diagnostics.map((diag, idx) => (
                                        <div key={idx} className={`${styles.diagItem} ${
                                            diag.status === 'success' ? styles.diagSuccess : 
                                            diag.status === 'warning' ? styles.diagWarning : styles.diagError
                                        }`}>
                                            <div style={{ marginTop: '2px' }}>
                                                {diag.status === 'success' ? <CheckCircle2 size={16} /> : 
                                                 diag.status === 'warning' ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>{diag.label}</div>
                                                <div style={{ opacity: 0.8 }}>{diag.msg}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.diagCard} style={{ background: 'var(--fusion-gradient)', color: 'white', border: 'none' }}>
                                <h3 style={{ color: 'white' }}><TrendingUp /> Actividad Mensual</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8 }}>Puntos Personales (PV)</span>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedUser.monthly_pv || 0}</div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8 }}>Puntos de Grupo (PVG)</span>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{selectedUser.monthly_pvg || 0}</div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.diagCard}>
                                <h3><Info size={20} color="var(--primary-color)" /> Notas de Seguridad</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                                    Esta auditoría procesa los registros de la tabla `commissions` y `payouts` en tiempo real. 
                                    Cualquier discrepancia marcada en rojo indica que el saldo total en `profiles` fue modificado fuera del motor de comisiones o hubo un fallo en el activador SQL.
                                </p>
                            </div>
                        </aside>
                    </div>
                </div>
            ) : (
                <div className="flex-center" style={{ height: '400px', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ padding: '2rem', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--border-color)' }}>
                        <ShieldCheck size={64} color="var(--primary-color)" style={{ opacity: 0.2 }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Selecciona un perfil</h3>
                        <p className="text-dim">Ingresa el nombre de un afiliado para comenzar la auditoría.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
