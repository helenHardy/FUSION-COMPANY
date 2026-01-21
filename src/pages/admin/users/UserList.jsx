
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Users, Search, Filter, ShieldAlert, BadgeDollarSign, UserCheck, Loader2, Edit2, Shield, Save } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Modal from '../../../components/ui/Modal'
import styles from './UserList.module.css'

export default function UserList() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterByDebt, setFilterByDebt] = useState(false)

    // Role editing state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [newRole, setNewRole] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    sponsor:sponsor_id (full_name),
                    combo:current_combo_id (name)
                `)
                .order('created_at', { ascending: false })

            if (data) setUsers(data)
        } catch (err) {
            console.error("Error al cargar usuarios:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleEditRole = (user) => {
        setSelectedUser(user)
        setNewRole(user.role)
        setIsModalOpen(true)
    }

    const saveRole = async () => {
        if (!selectedUser || submitting) return
        setSubmitting(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', selectedUser.id)

            if (error) throw error

            setIsModalOpen(false)
            fetchUsers()
        } catch (err) {
            console.error("Error updating role:", err)
            alert("Error al actualizar el rol")
        } finally {
            setSubmitting(false)
        }
    }

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.document_id?.includes(searchQuery)
        const hasDebt = filterByDebt ? user.pending_liquidation > 0 : true
        return matchesSearch && hasDebt
    })

    const getAvatarClass = (role) => {
        if (role === 'admin') return styles.adminAvatar
        if (role === 'sucursal') return styles.sucursalAvatar
        if (role === 'cajero') return styles.cashierAvatar
        return styles.affiliateAvatar
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Gestión de <span className={styles.highlight}>Usuarios</span>
                </h1>
                <p className={styles.subtitle}>Supervisión administrativa de afiliados, roles y estados financieros.</p>
            </header>

            <div className={`${styles.filterBar} glass`}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o CI..."
                        className={`input ${styles.searchInput}`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => setFilterByDebt(!filterByDebt)}
                    className={`${styles.debtButton} ${filterByDebt ? styles.debtButtonActive : ''}`}
                >
                    <Filter size={18} />
                    {filterByDebt ? 'Viendo solo con deuda' : 'Filtrar por deudores'}
                </button>
            </div>

            <div className={`${styles.tableCard} glass`}>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Afiliado</th>
                                <th className={styles.th}>Contacto / CI</th>
                                <th className={styles.th}>Rango</th>
                                <th className={styles.th}>Patrocinador</th>
                                <th className={styles.th}>Estado Financiero</th>
                                <th className={styles.th}>Estado</th>
                                <th className={styles.th}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '4rem' }}>
                                        <Loader2 className="spinner" size={40} />
                                    </td>
                                </tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.id} className={styles.tr}>
                                    <td className={styles.td}>
                                        <div className={styles.userCell}>
                                            <div className={`${styles.avatar} ${getAvatarClass(user.role)}`}>
                                                {user.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className={styles.userName}>{user.full_name}</div>
                                                <div className={styles.userRole}>{user.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.dataText}>ID: {user.document_id || 'N/A'}</div>
                                        <div className={styles.secondaryText}>{formatDate(user.created_at)}</div>
                                    </td>
                                    <td className={styles.td}>
                                        <span className={styles.rankBadge}>
                                            {user.current_rank || 'Básico'}
                                        </span>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.sponsorText}>
                                            {user.sponsor?.full_name || '—'}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <div className={styles.debtBox}>
                                            {user.pending_liquidation > 0 ? (
                                                <div className={styles.debtActive}>
                                                    <ShieldAlert size={16} />
                                                    <span>{formatCurrency(user.pending_liquidation)}</span>
                                                </div>
                                            ) : (
                                                <div className={styles.debtClean}>
                                                    <BadgeDollarSign size={16} /> Al día
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className={styles.td}>
                                        <span className={`${styles.statusBadge} ${user.status === 'activo' ? styles.statusActive : styles.statusInactive}`}>
                                            {user.status === 'activo' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className={styles.td}>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleEditRole(user)}
                                            title="Cambiar Rol"
                                        >
                                            <Shield size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!loading && filteredUsers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                            <Users size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                            <p>No se encontraron usuarios con estos criterios.</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Cambiar Rol de Usuario"
            >
                <div className={styles.modalContent}>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-dim)' }}>
                        Selecciona el nuevo rol para <strong>{selectedUser?.full_name}</strong>.
                    </p>
                    <div className={styles.roleGrid}>
                        {['admin', 'afiliado', 'sucursal', 'cajero'].map(role => (
                            <button
                                key={role}
                                className={`${styles.roleOption} ${newRole === role ? styles.roleActive : ''}`}
                                onClick={() => setNewRole(role)}
                            >
                                <span className={styles.roleName}>{role}</span>
                                {newRole === role && <UserCheck size={16} />}
                            </button>
                        ))}
                    </div>
                    <button
                        className={`button ${styles.saveBtn}`}
                        onClick={saveRole}
                        disabled={submitting || newRole === selectedUser?.role}
                    >
                        {submitting ? <Loader2 className="spinner-small" size={20} /> : <Save size={20} />}
                        Guardar Cambios
                    </button>
                </div>
            </Modal>
        </div>
    )
}
