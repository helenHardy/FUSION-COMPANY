
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Save, Trash2, Award, Zap, Users, BarChart3, ChevronRight, Layers, Loader2 } from 'lucide-react'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import styles from './RanksConfig.module.css'

export default function RanksConfig() {
    const [ranks, setRanks] = useState([])
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        min_pv: 0,
        min_pvg: 0,
        min_pv_monthly: 0,
        min_active_directs: 0,
        order_index: 0,
        royalties_config: {},
        reward_description: '',
        structure_requirements: []
    })

    useEffect(() => {
        fetchRanks()
    }, [])

    const fetchRanks = async () => {
        try {
            setLoading(true)
            const { data } = await supabase
                .from('ranks')
                .select('*')
                .order('order_index', { ascending: true })
            setRanks(data || [])
        } catch (err) {
            console.error("Error fetching ranks:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (rank) => {
        setFormData({
            ...rank,
            royalties_config: rank.royalties_config || {},
            reward_description: rank.reward_description || '',
            structure_requirements: rank.structure_requirements || []
        })
        setShowModal(true)
    }

    const handleNew = () => {
        setFormData({
            id: null,
            name: '',
            min_pv: 0,
            min_pvg: 0,
            min_pv_monthly: 0,
            min_active_directs: 0,
            order_index: ranks.length + 1,
            royalties_config: {},
            reward_description: '',
            structure_requirements: []
        })
        setShowModal(true)
    }

    const saveRank = async (e) => {
        e.preventDefault()
        setIsSaving(true)

        try {
            const { error } = await supabase
                .from('ranks')
                .upsert({
                    id: formData.id || undefined,
                    name: formData.name,
                    min_pv: parseFloat(formData.min_pv),
                    min_pvg: parseFloat(formData.min_pvg),
                    min_pv_monthly: parseFloat(formData.min_pv_monthly),
                    min_active_directs: parseInt(formData.min_active_directs),
                    order_index: parseInt(formData.order_index),
                    royalties_config: formData.royalties_config,
                    reward_description: formData.reward_description,
                    structure_requirements: formData.structure_requirements
                })

            if (error) throw error

            await fetchRanks()
            setShowModal(false)
        } catch (err) {
            alert("Error al guardar rango: " + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const updateLevelPerc = (level, val) => {
        setFormData({
            ...formData,
            royalties_config: {
                ...formData.royalties_config,
                [`N${level}`]: val === '' ? 0 : parseFloat(val)
            }
        })
    }

    const addStructureReq = () => {
        setFormData({
            ...formData,
            structure_requirements: [...formData.structure_requirements, { rank: '', count: 1 }]
        })
    }

    const removeStructureReq = (index) => {
        const newReqs = [...formData.structure_requirements]
        newReqs.splice(index, 1)
        setFormData({ ...formData, structure_requirements: newReqs })
    }

    const updateStructureReq = (index, field, val) => {
        const newReqs = [...formData.structure_requirements]
        newReqs[index] = { ...newReqs[index], [field]: field === 'count' ? parseInt(val) : val }
        setFormData({ ...formData, structure_requirements: newReqs })
    }

    const deleteRank = async (id) => {
        if (!confirm("¿Seguro que desea eliminar este rango? Moverá a los usuarios a un rango inferior.")) return

        const { error } = await supabase.from('ranks').delete().eq('id', id)
        if (error) alert(error.message)
        else fetchRanks()
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Carrera <span className={styles.highlight}>Corporativa</span>
                    </h1>
                    <p className={styles.subtitle}>Configuración de jerarquías, requisitos de liderazgo y beneficios de red.</p>
                </div>
                <button className={`button ${styles.addButton}`} onClick={handleNew}>
                    <Plus size={20} /> Nuevo Rango
                </button>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Prioridad', 'Rango de Liderazgo', 'Requisitos Técnicos', 'Premio / Beneficio', 'Bonificación', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : ranks.map(rank => {
                        const activeLevels = Object.entries(rank.royalties_config || {})
                            .filter(([_, val]) => val > 0).length

                        return (
                            <tr key={rank.id} className={styles.tr}>
                                <td className={styles.td}>
                                    <div className={styles.orderBadge}>#{rank.order_index}</div>
                                </td>
                                <td className={styles.td}>
                                    <div className={styles.rankCell}>
                                        <div className={styles.rankIcon}>
                                            <Award size={22} />
                                        </div>
                                        <span className={styles.rankName}>{rank.name}</span>
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <div className={styles.reqText}>
                                        <div><Zap size={12} style={{ display: 'inline', marginRight: '6px' }} /> PV Mensual: <span className={styles.reqValue}>{rank.min_pv_monthly}</span></div>
                                        <div><Users size={12} style={{ display: 'inline', marginRight: '6px' }} /> Directos: <span className={styles.reqValue}>{rank.min_active_directs}</span></div>
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <div>
                                        <div className={styles.pvgValue}>{rank.min_pvg.toLocaleString()} PVG</div>
                                        {rank.reward_description && (
                                            <div className={styles.rewardText} style={{ color: '#f59e0b', fontWeight: '700', marginTop: '4px' }}>
                                                🎁 {rank.reward_description}
                                            </div>
                                        )}
                                        {rank.structure_requirements?.length > 0 && (
                                            <div className={styles.structureBadge}>
                                                {rank.structure_requirements.map((r, i) => (
                                                    <div key={i}>• {r.count} {r.rank}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <div className={`${styles.levelBadge} ${activeLevels > 0 ? styles.levelActive : styles.levelInactive}`}>
                                        <Layers size={12} style={{ marginRight: '6px' }} />
                                        {activeLevels} Niveles
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <div className={styles.actions}>
                                        <button className={`button btn-secondary ${styles.editBtn}`} onClick={() => handleEdit(rank)}>
                                            Configurar
                                        </button>
                                        <button onClick={() => deleteRank(rank.id)} className={styles.deleteBtn} title="Eliminar rango">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </Table>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={formData.id ? 'Editar Jerarquía' : 'Nuevo Nivel en Carrera'}>
                <form onSubmit={saveRank}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre del Rango</label>
                            <input type="text" className="input" placeholder="Ej: Diamante Corona" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nivel Altura</label>
                            <div style={{ position: 'relative' }}>
                                <BarChart3 style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={16} />
                                <input type="number" className="input" style={{ paddingLeft: '40px' }} required value={formData.order_index} onChange={e => setFormData({ ...formData, order_index: e.target.value })} />
                            </div>
                        </div>
                        <div className={styles.inputGroup} style={{ gridColumn: 'span 2' }}>
                            <label className={styles.label}>Premio por Alcanzar este Rango</label>
                            <input type="text" className="input" placeholder="Ej: Licuadora Profesional, Moto 125cc, etc." value={formData.reward_description} onChange={e => setFormData({ ...formData, reward_description: e.target.value })} />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Describe el premio físico que recibirá el afiliado al llegar a este nivel.</p>
                        </div>
                    </div>

                    <div className={styles.twoCol}>
                        <section className={styles.section}>
                            <h4 className={styles.sectionTitle}><Zap size={16} color="var(--primary-light)" /> Calificación</h4>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>PV Personal (Meta Mensual)</label>
                                <input type="number" className="input" value={formData.min_pv_monthly} onChange={e => setFormData({ ...formData, min_pv_monthly: e.target.value })} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Socios Directos (Activos)</label>
                                <input type="number" className="input" value={formData.min_active_directs} onChange={e => setFormData({ ...formData, min_active_directs: e.target.value })} />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>PVG Grupal de Red</label>
                                <input type="number" className="input" value={formData.min_pvg} onChange={e => setFormData({ ...formData, min_pvg: e.target.value })} />
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h4 className={styles.sectionTitle}><Layers size={16} color="var(--primary-light)" /> Regalías (%)</h4>
                                <button
                                    type="button"
                                    className={styles.addLevelBtn}
                                    onClick={() => {
                                        // Find the current max level displayed (at least 10)
                                        const currentMax = Object.keys(formData.royalties_config).reduce((max, key) => {
                                            const num = parseInt(key.replace('N', ''));
                                            return num > max ? num : max;
                                        }, 10);
                                        updateLevelPerc(currentMax + 1, 0);
                                    }}
                                >
                                    <Plus size={14} /> Nivel
                                </button>
                            </div>
                            <div className={styles.royaltyGrid}>
                                {Array.from({ length: Math.max(10, Object.keys(formData.royalties_config).length) }).map((_, i) => {
                                    const lvl = i + 1;
                                    return (
                                        <div key={lvl} className={styles.royaltyItem}>
                                            <span className={styles.lvlLabel}>N{lvl}</span>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className={styles.lvlInput}
                                                value={formData.royalties_config[`N${lvl}`] || 0}
                                                onChange={e => updateLevelPerc(lvl, e.target.value)}
                                            />
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h4 className={styles.sectionTitle}><Users size={16} color="var(--primary-light)" /> Estructura Necesaria</h4>
                            <button type="button" className={styles.addLevelBtn} onClick={addStructureReq}>
                                <Plus size={14} /> Requisito
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {formData.structure_requirements.map((req, idx) => (
                                <div key={idx} className={styles.structureRow}>
                                    <div style={{ position: 'relative' }}>
                                        <ChevronRight size={14} style={{ position: 'absolute', left: '10px', top: '14px', color: 'var(--text-dim)' }} />
                                        <select className="input" style={{ paddingLeft: '32px', height: '42px' }} value={req.rank} onChange={e => updateStructureReq(idx, 'rank', e.target.value)}>
                                            <option value="">Seleccionar Rango...</option>
                                            {ranks.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                                        </select>
                                    </div>
                                    <input type="number" className="input" style={{ height: '42px' }} placeholder="Cantidad" value={req.count} onChange={e => updateStructureReq(idx, 'count', e.target.value)} />
                                    <button type="button" onClick={() => removeStructureReq(idx)} className={styles.deleteBtn} style={{ opacity: 1 }}><Trash2 size={16} /></button>
                                </div>
                            ))}
                            {formData.structure_requirements.length === 0 && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', margin: '0.5rem 0' }}>Sin requerimientos de estructura específicos.</p>
                            )}
                        </div>
                    </section>

                    <div className={styles.modalActions}>
                        <button type="button" className={`button btn-secondary ${styles.cancelButton}`} onClick={() => setShowModal(false)}>Cancelar</button>
                        <button type="submit" className={`button ${styles.saveButton}`} disabled={isSaving}>
                            {isSaving ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                    <Loader2 className="spinner-small" size={20} /> Guardando...
                                </div>
                            ) : (
                                <><Save size={20} /> Guardar Configuración</>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
