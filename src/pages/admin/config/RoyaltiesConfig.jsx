
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Edit2, Save, X, Settings, AlertOctagon, CheckCircle, BarChart3, Users, Zap, TrendingUp, Loader2 } from 'lucide-react'
import Table from '../../../components/ui/Table'
import styles from './RoyaltiesConfig.module.css'

export default function RoyaltiesConfig() {
    const [milestones, setMilestones] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({ level_number: '', min_people: '', min_pvg: '', min_monthly_pv: '100' })
    const [settings, setSettings] = useState({ monthly_pv_bonus_percent: 15 })
    const [closingStatus, setClosingStatus] = useState(null)

    useEffect(() => {
        fetchMilestones()
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        const { data } = await supabase.from('system_settings').select('*')
        if (data) {
            const s = {}
            data.forEach(item => s[item.key] = item.value)
            setSettings(prev => ({ ...prev, ...s }))
        }
    }

    const updateSetting = async (key, value) => {
        const { error } = await supabase
            .from('system_settings')
            .upsert({ key, value })
        if (!error) {
            setSettings({ ...settings, [key]: value })
            // Minimal toast-like feedback could go here if available
        }
    }

    const handleMonthlyClosing = async () => {
        if (!confirm('¿ESTÁ ABSOLUTAMENTE SEGURO? Esta acción es IRREVERSIBLE. Se generarán los bonos de todos los usuarios y se reiniciarán los PV del mes a cero.')) return

        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('execute_monthly_closing')

            if (error) {
                console.error("RPC Error:", error)
                alert(`Error al ejecutar el cierre: ${error.message} (${error.code})`)
                return
            }

            if (data?.success) {
                setClosingStatus(data)
                alert(`Cierre de Periodo Exitoso: Se procesaron ${data.processed_users} usuarios para el periodo ${data.period}.`)
            } else {
                const internalError = data?.error || 'No se recibió detalle del error.';
                alert(`Error crítico durante el cierre mensual: ${internalError}`)
            }
        } catch (err) {
            console.error("Catch error:", err)
            alert("Error inesperado al intentar el cierre.")
        } finally {
            setLoading(false)
        }
    }

    const fetchMilestones = async () => {
        try {
            setLoading(true)
            const { data } = await supabase
                .from('royalty_milestones')
                .select('*')
                .order('level_number', { ascending: true })
            if (data) setMilestones(data)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSaving(true)
        const payload = {
            level_number: parseInt(formData.level_number),
            min_people: parseInt(formData.min_people),
            min_pvg: parseFloat(formData.min_pvg),
            min_monthly_pv: parseFloat(formData.min_monthly_pv)
        }

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('royalty_milestones')
                    .update(payload)
                    .eq('id', editingId)
                if (!error) {
                    setEditingId(null)
                    setFormData({ level_number: '', min_people: '', min_pvg: '', min_monthly_pv: '100' })
                    fetchMilestones()
                }
            } else {
                const { error } = await supabase
                    .from('royalty_milestones')
                    .insert([payload])
                if (!error) {
                    setFormData({ level_number: '', min_people: '', min_pvg: '', min_monthly_pv: '100' })
                    fetchMilestones()
                }
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleEdit = (m) => {
        setEditingId(m.id)
        setFormData({
            level_number: m.level_number ?? '',
            min_people: m.min_people ?? '',
            min_pvg: m.min_pvg ?? '',
            min_monthly_pv: m.min_monthly_pv ?? '100'
        })
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Desea eliminar este nivel de meta de regalías?')) return
        const { error } = await supabase
            .from('royalty_milestones')
            .delete()
            .eq('id', id)
        if (!error) fetchMilestones()
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.iconWrapper}>
                    <Settings size={30} />
                </div>
                <div>
                    <h1 className={styles.title}>Motor de <span className={styles.highlight}>Regalías</span></h1>
                    <p className={styles.subtitle}>Configuración de algoritmos de pago y gestión de cierres mensuales.</p>
                </div>
            </header>

            <div className={styles.topGrid}>
                {/* Configuración Global */}
                <div className={`${styles.card} glass`}>
                    <h3 className={styles.sectionTitle}>
                        <TrendingUp size={18} color="var(--primary-light)" /> Parámetros de Red
                    </h3>
                    <div className={styles.settingsControl}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>% Bono PV Mensual Personal</label>
                            <div className={styles.relative}>
                                <input
                                    type="number"
                                    className="input"
                                    value={settings.monthly_pv_bonus_percent}
                                    onChange={(e) => setSettings({ ...settings, monthly_pv_bonus_percent: e.target.value })}
                                />
                                <span className={styles.percentIcon}>%</span>
                            </div>
                        </div>
                        <button
                            onClick={() => updateSetting('monthly_pv_bonus_percent', settings.monthly_pv_bonus_percent)}
                            className="button"
                            style={{ height: '52px' }}
                        >
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* Zona de Peligro: Cierre */}
                <div className={`${styles.card} glass ${styles.dangerCard}`}>
                    <h3 className={`${styles.sectionTitle} styles.dangerTitle`}>
                        <AlertOctagon size={18} color="#f87171" style={{ marginRight: '8px' }} />
                        Acciones de Cierre Fiscal
                    </h3>
                    <p className={styles.dangerText}>
                        Calcula bonos globales del mes y reinicia volúmenes personales. <strong>Esta acción es irreversible y afecta a toda la red.</strong>
                    </p>
                    <button
                        onClick={handleMonthlyClosing}
                        disabled={loading}
                        className={`button ${styles.closingBtn}`}
                    >
                        {loading ? <Loader2 className="spinner-small" size={20} /> : 'EJECUTAR CIERRE DEL PERIODO'}
                    </button>
                    {closingStatus && (
                        <div className={styles.closingLog}>
                            <CheckCircle size={12} /> Cierre procesado: {closingStatus.period} ({closingStatus.processed_users} usuarios)
                        </div>
                    )}
                </div>
            </div>

            {/* Formulario de Metas */}
            <div className={`${styles.card} glass`} style={{ marginBottom: '2rem' }}>
                <h3 className={styles.sectionTitle}>
                    <Plus size={18} color="var(--primary-light)" />
                    {editingId ? 'Editar Meta de Cobro' : 'Definir Nueva Meta de Cobro'}
                </h3>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Nivel de Meta</label>
                        <div className={styles.relative}>
                            <BarChart3 size={16} className={styles.percentIcon} style={{ left: '14px', right: 'auto' }} />
                            <input
                                type="number"
                                required
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                value={formData.level_number || ''}
                                onChange={(e) => setFormData({ ...formData, level_number: e.target.value })}
                                placeholder="Ej: 1"
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Mín. Personas en Red</label>
                        <div className={styles.relative}>
                            <Users size={16} className={styles.percentIcon} style={{ left: '14px', right: 'auto' }} />
                            <input
                                type="number"
                                required
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                value={formData.min_people || ''}
                                onChange={(e) => setFormData({ ...formData, min_people: e.target.value })}
                                placeholder="Ej: 10"
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Mín. PVG (Grupal)</label>
                        <div className={styles.relative}>
                            <TrendingUp size={16} className={styles.percentIcon} style={{ left: '14px', right: 'auto' }} />
                            <input
                                type="number"
                                required
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                value={formData.min_pvg || ''}
                                onChange={(e) => setFormData({ ...formData, min_pvg: e.target.value })}
                                placeholder="Ej: 1000"
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Mín. PV Mes (Personal)</label>
                        <div className={styles.relative}>
                            <Zap size={16} className={styles.percentIcon} style={{ left: '14px', right: 'auto' }} />
                            <input
                                type="number"
                                required
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                value={formData.min_monthly_pv || ''}
                                onChange={(e) => setFormData({ ...formData, min_monthly_pv: e.target.value })}
                                placeholder="Ej: 100"
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="submit" className={`button ${styles.submitBtn}`} disabled={isSaving}>
                            {isSaving ? <Loader2 className="spinner-small" size={18} /> : <><Save size={18} /> {editingId ? 'Actualizar' : 'Guardar'}</>}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => { setEditingId(null); setFormData({ level_number: '', min_people: '', min_pvg: '', min_monthly_pv: '100' }) }}
                                className={styles.cancelBtn}
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Tabla de Niveles */}
            <div className={`${styles.card} glass ${styles.tableContainer}`}>
                <Table headers={['Prioridad Meta', 'Requisito Estructura', 'Volumen de Red (PVG)', 'Calificación Personal', 'Operaciones']}>
                    {loading && milestones.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : milestones.map((m) => (
                        <tr key={m.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.levelText}>Meta Nivel {m.level_number}</div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.milestoneValue}>
                                    <Users size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                                    <span className={styles.highlightValue}>{m.min_people}</span> Personas
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.milestoneValue}>
                                    <TrendingUp size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                                    <span className={styles.highlightValue}>{m.min_pvg.toLocaleString()}</span> PV Grupal
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.milestoneValue}>
                                    <Zap size={12} style={{ marginRight: '6px', opacity: 0.5 }} />
                                    <span className={styles.highlightValue}>{m.min_monthly_pv}</span> PV Personal
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.actions}>
                                    <button onClick={() => handleEdit(m)} className={`${styles.iconBtn} ${styles.editBtn}`} title="Editar meta">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(m.id)} className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Eliminar meta">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && milestones.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <BarChart3 size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No se han configurado metas de regalías adicionales.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
