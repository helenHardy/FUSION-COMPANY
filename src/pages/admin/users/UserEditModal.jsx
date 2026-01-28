import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Save, User, FileText, Mail, Calendar, Loader2, DollarSign, Shield, Users, Gift } from 'lucide-react'
import Modal from '../../../components/ui/Modal'
import { formatDate, formatCurrency } from '../../../lib/utils'
import styles from './UserEditModal.module.css'

export default function UserEditModal({ isOpen, onClose, user, onUserUpdated }) {
    const [formData, setFormData] = useState({
        full_name: '',
        document_id: '',
        birth_date: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || '',
                document_id: user.document_id || '',
                birth_date: user.birth_date || ''
            })
        }
    }, [user])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    document_id: formData.document_id,
                    birth_date: formData.birth_date
                })
                .eq('id', user.id)

            if (error) throw error

            onUserUpdated()
            onClose()
        } catch (err) {
            console.error('Error actualizando usuario:', err)
            alert('Error al actualizar datos')
        } finally {
            setLoading(false)
        }
    }

    const calculateAge = (birthDate) => {
        if (!birthDate) return null
        const today = new Date()
        const birth = new Date(birthDate)
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--
        }
        return age
    }

    if (!user) return null

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
        >
            <div className={styles.modalContent}>
                {/* Header Gradient */}
                <div className={styles.headerGradient}></div>

                {/* Profile Section */}
                <div className={styles.profileSection}>
                    <div className={styles.avatarContainer}>
                        <div className={styles.avatar}>
                            {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    <h3 className={styles.userName}>
                        {user.full_name}
                    </h3>

                    <div className={styles.badges}>
                        <span className={`${styles.badge} ${user.status === 'activo' ? styles.badgeActive : styles.badgeInactive}`}>
                            {user.status}
                        </span>
                        <span className={`${styles.badge} ${styles.badgeRole}`}>
                            <Shield size={12} />
                            {user.role}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        {/* Personal Info */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <h4 className={styles.sectionTitle}>
                                Información Personal
                            </h4>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <User size={16} className={styles.iconBlue} />
                                Nombre Completo
                            </label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                className={styles.input}
                                placeholder="Nombre del usuario"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <FileText size={16} className={styles.iconBlue} />
                                Documento ID / CI
                            </label>
                            <input
                                type="text"
                                value={formData.document_id}
                                onChange={e => setFormData({ ...formData, document_id: e.target.value })}
                                className={styles.input}
                                placeholder="Número de documento"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <Gift size={16} className={styles.iconPink} />
                                Fecha de Nacimiento
                            </label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="date"
                                    value={formData.birth_date}
                                    onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                    className={styles.input}
                                />
                                {formData.birth_date && (
                                    <span className={styles.ageTag}>
                                        {calculateAge(formData.birth_date)} años
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Spacer for grid if needed or keep empty */}
                        <div className={styles.formGroup}></div>

                        {/* System Info */}
                        <div className={styles.sectionTitle} style={{ marginTop: '1rem' }}>
                            Datos del Sistema
                        </div>

                        <div className={styles.infoGrid} style={{ gridColumn: '1 / -1' }}>
                            <div className={styles.infoCard}>
                                <div className={styles.infoLabel}>
                                    <Mail size={12} /> Email
                                </div>
                                <div className={styles.infoValue} title={user.email}>
                                    {user.email || 'N/A'}
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.infoLabel}>
                                    <Users size={12} /> Sponsor
                                </div>
                                <div className={styles.infoValue}>
                                    {user.sponsor?.full_name || 'Sin Sponsor'}
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.infoLabel}>
                                    <DollarSign size={12} /> Ganancias
                                </div>
                                <div className={`${styles.infoValue} ${styles.textGreen}`}>
                                    {formatCurrency(user.total_earnings || 0)}
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.infoLabel}>
                                    <Calendar size={12} /> Registro
                                </div>
                                <div className={styles.infoValue}>
                                    {formatDate(user.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={onClose}
                            className={styles.btnCancel}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.btnSave}
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    )
}
