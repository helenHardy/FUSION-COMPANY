
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Mail, Lock, User, CreditCard, Sparkles, Package, AlertCircle, Loader2 } from 'lucide-react'
import styles from './Register.module.css'

export default function Register() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [combos, setCombos] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        documentId: '',
        comboId: ''
    })

    // Create a temporary client with PERSISTENCE DISABLED to avoid warning and session conflicts
    const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    )

    useEffect(() => {
        const fetchCombos = async () => {
            const { data, error } = await supabase
                .from('combos')
                .select('*')
                .eq('status', 'activo')

            if (error) {
                console.error("Error fetching combos:", error)
            } else {
                setCombos(data || [])
                if (data?.length > 0) {
                    setFormData(prev => ({ ...prev, comboId: data[0].id }))
                }
            }
        }
        fetchCombos()
    }, [])

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // 1. Sign up the user
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        document_id: formData.documentId,
                        role: 'afiliado',
                        sponsor_id: profile.id,
                        current_combo_id: formData.comboId
                    }
                }
            })

            if (authError) throw authError

            if (authData.user) {
                alert('Registro completado. El nuevo afiliado ha sido creado con estado PENDIENTE. Por favor, realiza el pago del combo con el administrador para activar la cuenta y recibir los beneficios.')
                navigate('/profile')
            }

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Registrar <span className={styles.highlight}>Afiliado</span>
                </h1>
                <p className={styles.subtitle}>
                    Expande tu red y ayuda a nuevos socios a comenzar su camino empresarial en Fusion.
                </p>
            </header>

            <div className={`${styles.formCard} glass`}>
                {error && (
                    <div className={styles.errorBanner}>
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleRegister}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Combo de Activación</label>
                        <div className={styles.inputWrapper}>
                            <Package className={styles.inputIcon} size={18} />
                            <select
                                name="comboId"
                                className={`input ${styles.selectField}`}
                                value={formData.comboId}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Seleccione un combo...</option>
                                {combos.map(combo => (
                                    <option key={combo.id} value={combo.id}>
                                        {combo.name} — {combo.price} Bs ({combo.pv_awarded} PV)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre Completo</label>
                        <div className={styles.inputWrapper}>
                            <User className={styles.inputIcon} size={18} />
                            <input
                                type="text"
                                name="fullName"
                                placeholder="Ej: Juan Pérez"
                                className={`input ${styles.inputField}`}
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Documento de Identidad</label>
                        <div className={styles.inputWrapper}>
                            <CreditCard className={styles.inputIcon} size={18} />
                            <input
                                type="text"
                                name="documentId"
                                placeholder="CI / Pasaporte"
                                className={`input ${styles.inputField}`}
                                value={formData.documentId}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Correo Electrónico</label>
                        <div className={styles.inputWrapper}>
                            <Mail className={styles.inputIcon} size={18} />
                            <input
                                type="email"
                                name="email"
                                placeholder="correo@ejemplo.com"
                                className={`input ${styles.inputField}`}
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginBottom: '2.5rem' }}>
                        <label className={styles.label}>Contraseña Temporal</label>
                        <div className={styles.inputWrapper}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                type="password"
                                name="password"
                                placeholder="********"
                                className={`input ${styles.inputField}`}
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className={`button ${styles.submitButton}`} disabled={loading}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Loader2 className="spinner-small" size={20} />
                                Procesando Registro...
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserPlus size={20} />
                                Registrar Nuevo Socio
                            </div>
                        )}
                    </button>
                </form>

                <div className={styles.infoBox}>
                    <Sparkles size={20} style={{ flexShrink: 0 }} />
                    <p>
                        Al registrar al nuevo socio, su cuenta quedará en estado <strong>Pendiente</strong>. Debes contactar al administrador para realizar el pago del combo y activar los beneficios (puntos y comisiones).
                    </p>
                </div>
            </div>
        </div>
    )
}
