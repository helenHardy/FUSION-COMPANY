
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function GainPlans() {
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({ name: '', levels: 1, config: { 1: 0 } })
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        fetchPlans()
    }, [])

    const fetchPlans = async () => {
        try {
            const { data, error } = await supabase
                .from('gain_plans')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setPlans(data)
        } catch (error) {
            console.error('Error fetching plans:', error)
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
        // Clean up extra levels if shrinking
        for (let i = count + 1; i <= 20; i++) delete newConfig[i]
        // Add default 0 for new levels
        for (let i = 1; i <= count; i++) {
            if (newConfig[i] === undefined) newConfig[i] = 0
        }

        setFormData({
            ...formData,
            levels: count,
            config: newConfig
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = {
                name: formData.name,
                levels: formData.levels,
                config: formData.config
            }

            let error
            if (editingId) {
                ({ error } = await supabase.from('gain_plans').update(payload).eq('id', editingId))
            } else {
                ({ error } = await supabase.from('gain_plans').insert([payload]))
            }

            if (error) throw error
            setIsModalOpen(false)
            fetchPlans()
            resetForm()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (plan) => {
        setEditingId(plan.id)
        setFormData({
            name: plan.name,
            levels: plan.levels,
            config: plan.config || {}
        })
        setIsModalOpen(true)
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({ name: '', levels: 1, config: { 1: 0 } })
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Planes de Ganancia</h1>
                <button className="btn" style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={() => { resetForm(); setIsModalOpen(true) }}>
                    <Plus size={20} />
                    Nuevo Plan
                </button>
            </div>

            <Table headers={['Nombre', 'Niveles', 'Resumen', 'Acciones']}>
                {plans.map(plan => (
                    <tr key={plan.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem' }}>{plan.name}</td>
                        <td style={{ padding: '1rem' }}>{plan.levels} Niveles</td>
                        <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {Object.entries(plan.config || {}).map(([lvl, pct]) => (
                                    <span key={lvl} style={{ fontSize: '0.75em', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                        N{lvl}: {pct}%
                                    </span>
                                ))}
                            </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                            <button
                                onClick={() => handleEdit(plan)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                            >
                                <Edit2 size={18} />
                            </button>
                        </td>
                    </tr>
                ))}
            </Table>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Plan' : 'Configurar Nuevo Plan'}
            >
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre del Plan</label>
                        <input
                            className="input"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Ej: Plan Estándar, Plan Gold"
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Cantidad de Niveles Profundos</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            className="input"
                            value={formData.levels}
                            onChange={e => updateLevels(parseInt(e.target.value) || 1)}
                            required
                        />
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                        <h4 style={{ marginTop: 0 }}>Porcentajes por Nivel</h4>
                        {Array.from({ length: formData.levels }).map((_, idx) => {
                            const level = idx + 1
                            return (
                                <div key={level} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ width: '80px', fontWeight: '500' }}>Nivel {level}:</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input"
                                        style={{ marginBottom: 0, width: '100px' }}
                                        value={formData.config[level] || 0}
                                        onChange={e => handleLevelChange(level, e.target.value)}
                                    />
                                    <span style={{ marginLeft: '0.5rem' }}>%</span>
                                </div>
                            )
                        })}
                    </div>

                    <button type="submit" className="btn" style={{ width: '100%' }}>Guardar Configuración</button>
                </form>
            </Modal>
        </div>
    )
}
