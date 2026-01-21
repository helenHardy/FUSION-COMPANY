import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { User, Mail, Lock, CheckCircle, ArrowRight, LogIn } from 'lucide-react'
import styles from './Auth.module.css'

export default function PublicRegister() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

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
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        role: 'afiliado', // Will be promoted to admin manually
                    }
                }
            })

            if (error) throw error

            if (data.user) {
                alert('Usuario creado correctamente. Ahora ejecuta el SQL para hacerlo Admin.')
                navigate('/login')
            }

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            {/* Animated Background Elements */}
            <div className={`${styles.floatingShape} ${styles.shape1}`} />
            <div className={`${styles.floatingShape} ${styles.shape2}`} />
            <div className={`${styles.floatingShape} ${styles.shape3}`} />

            <div className={styles.contentWrapper}>
                <div className={styles.card}>
                    {/* Header */}
                    <div className={styles.brandSection}>
                        <div className={styles.logoContainer}>
                            <User size={40} color="white" />
                        </div>
                        <h1 className={styles.title}>Crear Cuenta</h1>
                        <p className={styles.subtitle}>Únete a Fusion Company</p>
                    </div>

                    {error && (
                        <div className={styles.errorAlert}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister}>
                        {/* Full Name */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Nombre Completo</label>
                            <div className={styles.inputWrapper}>
                                <User size={20} className={styles.inputIcon} />
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="Juan Pérez"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Correo Electrónico</label>
                            <div className={styles.inputWrapper}>
                                <Mail size={20} className={styles.inputIcon} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="tu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Contraseña</label>
                            <div className={styles.inputWrapper}>
                                <Lock size={20} className={styles.inputIcon} />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={styles.input}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.submitButton}
                        >
                            {loading ? (
                                <>
                                    <div className={styles.spinner} />
                                    Creando cuenta...
                                </>
                            ) : (
                                <>
                                    Registrarse
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>

                        {/* Footer Link */}
                        <div className={styles.footer}>
                            <Link to="/login" className={styles.signupLink}>
                                <LogIn size={18} />
                                ¿Ya tienes cuenta? Inicia Sesión
                            </Link>
                        </div>
                    </form>
                </div>

                <div className={styles.copyright}>
                    © 2026 Fusion Company. Todos los derechos reservados.
                </div>
            </div>
        </div>
    )
}
