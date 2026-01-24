
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import { Plus, Edit2, Trash2, MapPin, Building2, Loader2, User, FileText, Calendar, DollarSign, Package } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import styles from './BranchList.module.css'

export default function BranchList() {
    const [branches, setBranches] = useState([])
    const [sucursalUsers, setSucursalUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({ name: '', address: '', status: 'activo', manager_id: '' })
    const [editingId, setEditingId] = useState(null)

    // Report State
    const [reportModalOpen, setReportModalOpen] = useState(false)
    const [selectedBranchReport, setSelectedBranchReport] = useState(null)
    const [branchSales, setBranchSales] = useState([])
    const [reportLoading, setReportLoading] = useState(false)
    const [stats, setStats] = useState({ totalAmount: 0, totalPV: 0, count: 0 })

    // Filter State
    const [filterType, setFilterType] = useState('month') // 'day', 'month', 'year'
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
    const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [branchesRes, usersRes] = await Promise.all([
                supabase
                    .from('sucursales')
                    .select('*, profiles:manager_id (full_name)')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('role', ['sucursal', 'cajero'])
                    .eq('status', 'activo')
            ])

            if (branchesRes.error) throw branchesRes.error
            if (usersRes.error) throw usersRes.error

            setBranches(branchesRes.data || [])
            setSucursalUsers(usersRes.data || [])
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setSubmitting(true)

            const payload = {
                name: formData.name,
                address: formData.address,
                status: formData.status,
                manager_id: formData.manager_id || null
            }

            let error
            if (editingId) {
                ({ error } = await supabase
                    .from('sucursales')
                    .update(payload)
                    .eq('id', editingId))
            } else {
                ({ error } = await supabase
                    .from('sucursales')
                    .insert([payload]))
            }

            if (error) throw error

            setIsModalOpen(false)
            fetchData()
            resetForm()
        } catch (error) {
            console.error('Error saving branch:', error)
            alert('Error al guardar la sucursal')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (branch) => {
        setFormData({
            name: branch.name,
            address: branch.address,
            status: branch.status,
            manager_id: branch.manager_id || ''
        })
        setEditingId(branch.id)
        setIsModalOpen(true)
    }

    const resetForm = () => {
        setFormData({ name: '', address: '', status: 'activo', manager_id: '' })
        setEditingId(null)
    }

    const handleDelete = async (branch) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la sucursal "${branch.name}"? Esta acción borrará también todo el stock de inventario asignado a esta sucursal.`)) return

        try {
            // Primero borramos el inventario asociado (por FK)
            await supabase
                .from('inventory')
                .delete()
                .eq('branch_id', branch.id)

            // Luego borramos la sucursal
            const { error } = await supabase
                .from('sucursales')
                .delete()
                .eq('id', branch.id)

            if (error) throw error

            fetchData()
        } catch (error) {
            console.error('Error deleting branch:', error)
            alert('Error al eliminar la sucursal: ' + error.message)
        }
    }

    const handleOpenReport = async (branch) => {
        setSelectedBranchReport(branch)
        setReportModalOpen(true)
        // fetchBranchReport(branch.id) // This will be called by the useEffect now
    }

    const fetchBranchReport = async (branchId) => {
        setReportLoading(true)
        try {
            let query = supabase
                .from('sales')
                .select('*, profiles(full_name)')
                .eq('branch_id', branchId)
                .eq('status', 'completado')

            // Date Filtering Logic
            let startDate, endDate
            const now = new Date()

            if (filterType === 'day') {
                startDate = filterDate
                endDate = filterDate + ' 23:59:59'
                query = query.gte('created_at', startDate).lte('created_at', endDate)
            } else if (filterType === 'month') {
                const [y, m] = filterMonth.split('-')
                startDate = `${y}-${m}-01`
                const lastDay = new Date(y, m, 0).getDate()
                endDate = `${y}-${m}-${lastDay} 23:59:59`
                query = query.gte('created_at', startDate).lte('created_at', endDate)
            } else if (filterType === 'year') {
                startDate = `${filterYear}-01-01`
                endDate = `${filterYear}-12-31 23:59:59`
                query = query.gte('created_at', startDate).lte('created_at', endDate)
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(100)

            if (error) throw error

            const sales = data || []
            setBranchSales(sales)

            // Calculate totals
            const totalAmount = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0)
            const totalPV = sales.reduce((sum, sale) => sum + parseFloat(sale.total_pv || 0), 0)

            setStats({
                totalAmount,
                totalPV,
                count: sales.length
            })

        } catch (err) {
            console.error("Error fetching report:", err)
        } finally {
            setReportLoading(false)
        }
    }

    // Effect to refetch when filters change
    useEffect(() => {
        if (reportModalOpen && selectedBranchReport) {
            fetchBranchReport(selectedBranchReport.id)
        }
    }, [filterType, filterDate, filterMonth, filterYear, reportModalOpen, selectedBranchReport])

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Gestión de <span className={styles.highlight}>Sucursales</span>
                    </h1>
                    <p className={styles.subtitle}>Supervisión de puntos de venta y centros de distribución.</p>
                </div>
                <button
                    className={`button ${styles.addButton}`}
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                >
                    <Plus size={20} />
                    Nueva Sucursal
                </button>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Sucursal', 'Encargado', 'Dirección', 'Estado', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : branches.map((branch) => (
                        <tr key={branch.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.branchCell}>
                                    <div className={styles.branchIconBox}>
                                        <Building2 size={20} color="var(--primary-light)" />
                                    </div>
                                    <span className={styles.branchName}>{branch.name}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.managerInfo}>
                                    <User size={14} style={{ opacity: 0.5 }} />
                                    <span>{branch.profiles?.full_name || 'Sin asignar'}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.address}>
                                    <MapPin size={14} style={{ display: 'inline', marginRight: '6px', opacity: 0.5 }} />
                                    {branch.address || '—'}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <Badge status={branch.status} />
                            </td>
                            <td className={styles.td}>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => handleOpenReport(branch)}
                                        className={styles.editButton}
                                        style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.2)' }}
                                        title="Ver Reporte de Ventas"
                                    >
                                        <FileText size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleEdit(branch)}
                                        className={styles.editButton}
                                        title="Editar sucursal"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(branch)}
                                        className={styles.deleteButton}
                                        title="Eliminar sucursal"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && branches.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <Building2 size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No se han registrado sucursales aún.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Sucursal' : 'Nueva Sucursal'}
            >
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre de la Sucursal</label>
                        <input
                            className="input"
                            placeholder="Ej: Sucursal Central"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Dirección Completa</label>
                        <input
                            className="input"
                            placeholder="Calle, ciudad, edificio..."
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Encargado (Sucursal/Cajero)</label>
                        <select
                            className="input"
                            value={formData.manager_id}
                            onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                        >
                            <option value="">-- Sin asignar --</option>
                            {sucursalUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ marginBottom: '2.5rem' }}>
                        <label className={styles.label}>Estado Operativo</label>
                        <select
                            className="input"
                            style={{ fontWeight: '700' }}
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                    <button type="submit" className={`button ${styles.submitButton}`} disabled={submitting}>
                        {submitting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <Loader2 className="spinner-small" size={20} />
                                Procesando...
                            </div>
                        ) : (
                            <>{editingId ? 'Actualizar' : 'Crear'} Sucursal</>
                        )}
                    </button>
                </form>
            </Modal>
            <Modal
                isOpen={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                title={`Reporte: ${selectedBranchReport?.name}`}
                width="95%"
                maxWidth="1200px"
            >
                <div className={styles.reportContainer}>
                    {/* Filter Bar */}
                    <div className={styles.filterBar}>
                        <div className={styles.filterGroup}>
                            <button
                                className={`${styles.filterBtn} ${filterType === 'day' ? styles.activeFilter : ''}`}
                                onClick={() => setFilterType('day')}
                            >
                                Día
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filterType === 'month' ? styles.activeFilter : ''}`}
                                onClick={() => setFilterType('month')}
                            >
                                Mes
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filterType === 'year' ? styles.activeFilter : ''}`}
                                onClick={() => setFilterType('year')}
                            >
                                Año
                            </button>
                        </div>

                        <div className={styles.dateInputs}>
                            {filterType === 'day' && (
                                <input
                                    type="date"
                                    className={styles.dateInput}
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                />
                            )}
                            {filterType === 'month' && (
                                <input
                                    type="month"
                                    className={styles.dateInput}
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                />
                            )}
                            {filterType === 'year' && (
                                <select
                                    className={styles.dateInput}
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                    {/* Stats Cards */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <div className={styles.statLabel}>Ventas Totales</div>
                                <div className={styles.statValue}>{formatCurrency(stats.totalAmount)}</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                                <Package size={24} />
                            </div>
                            <div>
                                <div className={styles.statLabel}>Volumen (PV)</div>
                                <div className={styles.statValue}>{stats.totalPV.toFixed(2)}</div>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                <FileText size={24} />
                            </div>
                            <div>
                                <div className={styles.statLabel}>Transacciones</div>
                                <div className={styles.statValue}>{stats.count}</div>
                            </div>
                        </div>
                    </div>

                    <h3 className={styles.sectionTitle} style={{ marginTop: '2rem' }}>Últimas Ventas</h3>
                    <div className={styles.salesTableContainer}>
                        <table className={styles.salesTable}>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cliente / Socio</th>
                                    <th>Monto</th>
                                    <th>PV</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportLoading ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                                            <Loader2 className="spinner" size={24} />
                                        </td>
                                    </tr>
                                ) : branchSales.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                                            No hay ventas registradas
                                        </td>
                                    </tr>
                                ) : (
                                    branchSales.map(sale => (
                                        <tr key={sale.id}>
                                            <td>{formatDate(sale.created_at)}</td>
                                            <td>{sale.profiles?.full_name || 'Cliente General'}</td>
                                            <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(sale.total_amount)}</td>
                                            <td style={{ fontWeight: 700, color: '#38bdf8' }}>{sale.total_pv}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
