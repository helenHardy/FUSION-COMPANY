import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { User, Shield, CreditCard, Calendar, Award, Package, Sparkles, CheckCircle, XCircle } from 'lucide-react'
import styles from './Profile.module.css'

export default function Profile() {
    const { profile, user, refreshProfile } = useAuth()
    const [editingBank, setEditingBank] = useState(false)
    const [bankData, setBankData] = useState({
        bank_name: profile?.bank_name || '',
        account_number: profile?.account_number || ''
    })
    const [saving, setSaving] = useState(false)

    // Password change state
    const [changingPassword, setChangingPassword] = useState(false)
    const [passwords, setPasswords] = useState({ new: '', confirm: '' })
    const [passLoading, setPassLoading] = useState(false)

    const handleUpdateBank = async () => {
        if (!bankData.bank_name.trim() || !bankData.account_number.trim()) {
            alert("Por favor complete ambos campos bancarios")
            return
        }
        setSaving(true)
        try {
            // We'll update the profile directly as we don't have a specific bank RPC, 
            // or we can use a generic update if available. 
            // Since we added these columns, a direct update is fine if RLS allows.
            const { error } = await supabase
                .from('profiles')
                .update({
                    bank_name: bankData.bank_name,
                    account_number: bankData.account_number
                })
                .eq('id', profile.id)

            if (error) throw error
            await refreshProfile()
            setEditingBank(false)
            alert('Datos bancarios vinculados correctamente. Ahora son de solo lectura.')
        } catch (err) {
            console.error("Error al actualizar datos bancarios:", err)
            alert("Error: " + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) {
            alert("Las contraseñas no coinciden")
            return
        }
        if (passwords.new.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setPassLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.new
            })
            if (error) throw error
            alert('Contraseña actualizada correctamente')
            setChangingPassword(false)
            setPasswords({ new: '', confirm: '' })
        } catch (err) {
            console.error("Error al cambiar contraseña:", err)
            alert("Error: " + err.message)
        } finally {
            setPassLoading(false)
        }
    }

    if (!profile) return (
        <div className={styles.container} style={{ textAlign: 'center', padding: '5rem' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Cargando perfil corporativo...</p>
        </div>
    )

    const isActive = profile.status === 'activo'

    return (
        <div className={styles.container}>
            {/* User Hero */}
            <header className={styles.profileHero}>
                <div className={styles.avatarBox}>
                    <User size={48} />
                </div>
                <h1 className={styles.userName}>{profile.full_name}</h1>
                <div className={styles.userRole}>{profile.role}</div>
                <div className={styles.userRole}>{profile.role}</div>

                <div className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
                    {isActive ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle size={14} /> Miembro Activo
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <XCircle size={14} /> Cuenta Inactiva
                        </div>
                    )}
                </div>
            </header>

            {/* Information Grid */}
            <div className={styles.infoGrid}>
                <div className={`${styles.infoCard} glass`}>
                    <div className={styles.iconContainer}>
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <span className={styles.fieldLabel}>Documento ID</span>
                        <div className={styles.fieldValue}>{profile.document_id || 'No registrado'}</div>
                    </div>
                </div>

                <div className={`${styles.infoCard} glass`}>
                    <div className={styles.iconContainer}>
                        <Award size={20} />
                    </div>
                    <div>
                        <span className={styles.fieldLabel}>Rango de Carrera</span>
                        <div className={`${styles.fieldValue} ${styles.rankValue}`}>
                            {profile.current_rank || 'Aliado Básico'}
                        </div>
                    </div>
                </div>

                <div className={`${styles.infoCard} glass`}>
                    <div className={styles.iconContainer}>
                        <Calendar size={20} />
                    </div>
                    <div>
                        <span className={styles.fieldLabel}>Fecha de Activación</span>
                        <div className={styles.fieldValue}>{formatDate(profile.activation_date)}</div>
                    </div>
                </div>

                <div className={`${styles.infoCard} glass`}>
                    <div className={styles.iconContainer}>
                        <Shield size={20} />
                    </div>
                    <div>
                        <span className={styles.fieldLabel}>Verificación</span>
                        <div className={styles.fieldValue}>Cuenta Verificada</div>
                    </div>
                </div>

                <div className={`${styles.infoCard} glass`}>
                    <div className={styles.iconContainer}>
                        <Package size={20} />
                    </div>
                    <div>
                        <span className={styles.fieldLabel}>Regalos Disponibles</span>
                        <div className={`${styles.fieldValue} ${styles.rankValue}`} style={{ color: '#22d3ee' }}>
                            {profile.free_products_count || 0} productos
                        </div>
                    </div>
                </div>

                {/* Bank Information Card */}
                <div className={`${styles.infoCard} ${styles.bankCard} glass`}>
                    <div className={styles.iconContainer} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <Sparkles size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={styles.fieldLabel}>Datos de Cobro</span>
                            {(!profile.bank_name || !profile.account_number) && !editingBank && (
                                <button className={styles.editDataBtn} onClick={() => setEditingBank(true)}>Configurar</button>
                            )}
                        </div>

                        {editingBank ? (
                            <div className={styles.bankEditForm}>
                                <input
                                    type="text"
                                    placeholder="Nombre del Banco"
                                    className={styles.bankInput}
                                    value={bankData.bank_name}
                                    onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Nro de Cuenta"
                                    className={styles.bankInput}
                                    value={bankData.account_number}
                                    onChange={(e) => setBankData({ ...bankData, account_number: e.target.value })}
                                />
                                <div className={styles.bankActions}>
                                    <button className={styles.bankSaveBtn} onClick={handleUpdateBank} disabled={saving}>
                                        {saving ? '...' : 'Vincular'}
                                    </button>
                                    <button className={styles.bankCancelBtn} onClick={() => setEditingBank(false)}>X</button>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.bankDisplay}>
                                <div className={styles.fieldValue}>
                                    {profile.bank_name || 'No configurado'}
                                </div>
                                <div className={styles.accountSub}>
                                    {profile.account_number ? `Cuenta: ${profile.account_number}` : 'Vincule su cuenta para recibir pagos'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Security Section */}
                <div className={styles.benefitSection}>
                    <div className={`${styles.benefitCard} glass`} style={{ borderLeftColor: '#f87171' }}>
                        <div className={styles.benefitContent}>
                            <div className={styles.benefitHeader}>
                                <div style={{ color: '#f87171' }}>
                                    <Shield size={24} />
                                </div>
                                <h3 className={styles.benefitTitle}>Seguridad de la Cuenta</h3>
                            </div>

                            {changingPassword ? (
                                <form onSubmit={handleChangePassword} className={styles.passForm}>
                                    <input
                                        type="password"
                                        placeholder="Nueva contraseña"
                                        className={styles.passInput}
                                        value={passwords.new}
                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                        required
                                    />
                                    <input
                                        type="password"
                                        placeholder="Confirmar contraseña"
                                        className={styles.passInput}
                                        value={passwords.confirm}
                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                        required
                                    />
                                    <div className={styles.passActions}>
                                        <button type="submit" className={styles.saveBtn} disabled={passLoading}>
                                            {passLoading ? 'Cambiando...' : 'Confirmar Cambio'}
                                        </button>
                                        <button type="button" className={styles.cancelBtn} onClick={() => setChangingPassword(false)}>
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <p className={styles.benefitDescription}>
                                        Mantén tu cuenta protegida. Te recomendamos cambiar tu contraseña periódicamente.
                                    </p>
                                    <button className={styles.passBtn} onClick={() => setChangingPassword(true)}>
                                        Cambiar mi Contraseña
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
