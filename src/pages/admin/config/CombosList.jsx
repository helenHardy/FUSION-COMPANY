
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import { formatCurrency } from '../../../lib/utils'
import { Plus, Edit2, Trash2, Package, Sparkles, Gift, Layers, Settings, Info, Loader2, TrendingUp, DollarSign } from 'lucide-react'
import styles from './CombosList.module.css'

export default function CombosList() {
    const [combos, setCombos] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        pv_awarded: 0,
        free_products_count: 0,
        status: 'activo',
        levels: 1,
        config: { 1: 0 }
    })
    const [editingId, setEditingId] = useState(null)
    const [editingPlanId, setEditingPlanId] = useState(null)

    useEffect(() => {
        fetchCombos()
    }, [])

    const fetchCombos = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('combos')
                .select('*, gain_plans(*)')
                .order('created_at', { ascending: false })

            if (error) throw error
            setCombos(data || [])
        } catch (error) {
            console.error('Error fetching combos:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLevelChange = (level, percentage) => {
        setFormData(prev => ({
            ...prev,
            config: {
                ...prev.config,
                [level]: parseFloat(percentage) || 0
            }
        }))
    }

    const updateLevels = (count) => {
        const newConfig = { ...formData.config }
        for (let i = 1; i <= count; i++) {
            if (newConfig[i] === undefined) newConfig[i] = 0
        }
        setFormData({ ...formData, levels: count, config: newConfig })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const planPayload = {
                name: `Plan ${formData.name}`,
                levels: formData.levels,
                config: formData.config
            }

            let planId = editingPlanId
            if (editingPlanId) {
                await supabase.from('gain_plans').update(planPayload).eq('id', editingPlanId)
            } else {
                const { data: newPlan, error: planError } = await supabase
                    .from('gain_plans')
                    .insert([planPayload])
                    .select()
                    .single()
                if (planError) throw planError
                planId = newPlan.id
            }

            const comboPayload = {
                name: formData.name,
                price: parseFloat(formData.price),
                pv_awarded: parseFloat(formData.pv_awarded),
                free_products_count: parseInt(formData.free_products_count) || 0,
                plan_id: planId,
                status: formData.status
            }

            let error
            if (editingId) {
                ({ error } = await supabase.from('combos').update(comboPayload).eq('id', editingId))
            } else {
                ({ error } = await supabase.from('combos').insert([comboPayload]))
            }

            if (error) throw error

            setIsModalOpen(false)
            fetchCombos()
            resetForm()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (combo) => {
        setEditingId(combo.id)
        setEditingPlanId(combo.plan_id)
        setFormData({
            name: combo.name,
            price: combo.price,
            pv_awarded: combo.pv_awarded,
            free_products_count: combo.free_products_count || 0,
            status: combo.status,
            levels: combo.gain_plans?.levels || 1,
            config: combo.gain_plans?.config || { 1: 0 }
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (combo) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el combo "${combo.name}"? Esta acción no se puede deshacer.`)) return

        try {
            // Primero eliminamos el combo
            const { error: comboError } = await supabase
                .from('combos')
                .delete()
                .eq('id', combo.id)

            if (comboError) throw comboError

            // Luego intentamos eliminar el plan de ganancias si existe
            if (combo.plan_id) {
                await supabase
                    .from('gain_plans')
                    .delete()
                    .eq('id', combo.plan_id)
            }

            fetchCombos()
        } catch (err) {
            alert('Error eliminando combo: ' + err.message)
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setEditingPlanId(null)
        setFormData({
            name: '',
            price: 0,
            pv_awarded: 0,
            free_products_count: 0,
            status: 'activo',
            levels: 1,
            config: { 1: 0 }
        })
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <span className={styles.highlight}>Combos</span> de Activación
                    </h1>
                    <p className={styles.subtitle}>Paquetes de entrada y configuración de repartición de ganancias por red.</p>
                </div>
                <button
                    className={`button ${styles.addButton}`}
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                >
                    <Plus size={20} />
                    Nuevo Combo
                </button>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Combo', 'Precio', 'Puntos (PV)', 'Regalo', 'Plan de Comisiones', 'Estado', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : combos.map(combo => (
                        <tr key={combo.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.comboCell}>
                                    <div className={styles.comboIcon}>
                                        <Package size={20} />
                                    </div>
                                    <span className={styles.comboName}>{combo.name}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <span className={styles.price}>{formatCurrency(combo.price)}</span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.pointsWrapper}>
                                    <Sparkles size={14} color="#10b981" />
                                    <span className={styles.points}>{combo.pv_awarded} PV</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={`${styles.freeText} ${combo.free_products_count > 0 ? styles.hasFree : ''}`}>
                                    <Gift size={14} style={{ display: 'inline', marginRight: '6px', opacity: combo.free_products_count > 0 ? 1 : 0.3 }} />
                                    {combo.free_products_count || 0} prod.
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.commissionsWrapper}>
                                    {Object.entries(combo.gain_plans?.config || {})
                                        .filter(([_, pct]) => parseFloat(pct) > 0)
                                        .map(([lvl, pct]) => {
                                            const percentage = parseFloat(pct);
                                            const amount = combo.price * (percentage / 100);

                                            return (
                                                <span key={lvl} className={styles.commissionBadge} title={`Comisión de ${formatCurrency(amount)}`}>
                                                    N{lvl}: {pct}%
                                                </span>
                                            );
                                        })}
                                    {Object.entries(combo.gain_plans?.config || {}).filter(([_, pct]) => parseFloat(pct) > 0).length === 0 && (
                                        <span className={styles.noCommissions}>Venta directa únicamente</span>
                                    )}
                                </div>
                            </td>
                            <td className={styles.td}>
                                <Badge status={combo.status} />
                            </td>
                            <td className={styles.td}>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => handleEdit(combo)}
                                        className={styles.editButton}
                                        title="Editar combo y plan"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(combo)}
                                        className={styles.deleteButton}
                                        title="Eliminar combo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && combos.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <Package size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No hay combos configurados profesionalmente.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Combo y Plan' : 'Configurar Nuevo Combo'}
            >
                <form onSubmit={handleSubmit}>
                    <section className={styles.formSection}>
                        <h4 className={styles.sectionTitle}>
                            <Info size={18} /> Información Base
                        </h4>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Nombre del Paquete</label>
                            <input
                                className="input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Ej: Elite Business Pack"
                            />
                        </div>

                        <div className={styles.row}>
                            <div className={`${styles.formGroup} ${styles.col}`}>
                                <label className={styles.label}>Inversión (Bs)</label>
                                <div style={{ position: 'relative' }}>
                                    <DollarSign style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                                    <input type="number" step="0.01" className="input" style={{ paddingLeft: '40px' }} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                                </div>
                            </div>
                            <div className={`${styles.formGroup} ${styles.col}`}>
                                <label className={styles.label}>Valor en PV</label>
                                <div style={{ position: 'relative' }}>
                                    <Sparkles style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                                    <input type="number" step="0.01" className="input" style={{ paddingLeft: '40px' }} value={formData.pv_awarded} onChange={e => setFormData({ ...formData, pv_awarded: e.target.value })} required />
                                </div>
                            </div>
                            <div className={`${styles.formGroup} ${styles.col}`}>
                                <label className={styles.label}>Productos Regalo</label>
                                <div style={{ position: 'relative' }}>
                                    <Gift style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                                    <input type="number" className="input" style={{ paddingLeft: '40px' }} value={formData.free_products_count} onChange={e => setFormData({ ...formData, free_products_count: e.target.value })} required />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={styles.formSection}>
                        <h4 className={styles.sectionTitle}>
                            <TrendingUp size={18} /> Distribución por Red
                        </h4>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Niveles de Profundidad</label>
                            <div style={{ position: 'relative' }}>
                                <Layers style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    className="input"
                                    style={{ paddingLeft: '40px' }}
                                    value={formData.levels}
                                    onChange={e => updateLevels(parseInt(e.target.value) || 1)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.levelScrollArea}>
                            {Array.from({ length: formData.levels }).map((_, idx) => {
                                const level = idx + 1
                                return (
                                    <div key={level} className={styles.levelRow}>
                                        <span className={styles.levelLabel}>Nivel {level}:</span>
                                        <div className={styles.levelInputWrapper}>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="input"
                                                style={{ marginBottom: 0, height: '42px' }}
                                                value={formData.config[level] || 0}
                                                onChange={e => handleLevelChange(level, e.target.value)}
                                            />
                                            <span className={styles.percentSymbol}>%</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    <div className={styles.formGroup} style={{ marginTop: '1.5rem', marginBottom: '2.5rem' }}>
                        <label className={styles.label}>Estado del Combo</label>
                        <div style={{ position: 'relative' }}>
                            <Settings style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                            <select
                                className="input"
                                style={{ paddingLeft: '40px', fontWeight: '700' }}
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="activo">Activo (Disponible en registro)</option>
                                <option value="inactivo">Inactivo (Deshabilitado)</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" className={`button ${styles.submitButton}`} disabled={submitting}>
                        {submitting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <Loader2 className="spinner-small" size={20} />
                                Procesando configuración...
                            </div>
                        ) : (
                            <>{editingId ? 'Actualizar Combo y Plan' : 'Crear Combo y Plan de Ganancia'}</>
                        )}
                    </button>
                </form>
            </Modal>
        </div>
    )
}
