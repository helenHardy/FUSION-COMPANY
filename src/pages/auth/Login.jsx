
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, Sparkles, Eye, EyeOff, ArrowRight, ShieldAlert } from 'lucide-react'
import styles from './Auth.module.css'
import logo from '../../assets/logo-full.png'

export default function Login() {
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        let loginEmail = identifier

        // Si no parece un correo electrónico (no contiene @), buscamos por carnet
        if (!identifier.includes('@')) {
            const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_user_email_by_document', {
                p_document_id: identifier
            })

            if (rpcError || !resolvedEmail) {
                setError('No se pudo encontrar una cuenta asociada a este Carnet.')
                setLoading(false)
                return
            }
            loginEmail = resolvedEmail
        }

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
        })

        if (authError) {
            setError('Credenciales inválidas. Por favor verifique sus datos.')
            setLoading(false)
        } else {
            navigate('/')
        }
    }

    return (
        <div className={styles.container}>
            {/* Split Visual Section (PC Only) */}
            <div className={styles.leftSection}>
                <div className={`${styles.glassCircle} ${styles.circle1}`} />
                <div className={`${styles.glassCircle} ${styles.circle2}`} />
                <div className={styles.visualContent}>
                    <h2 className={styles.promoTitle}>Potencia tu red con Fusion</h2>
                    <p className={styles.promoSubtitle}>
                        La plataforma definitiva para gestionar tu crecimiento, red y ganancias en un solo lugar con tecnología de vanguardia.
                    </p>
                </div>
            </div>

            {/* Form Section */}
            <div className={styles.rightSection}>
                <div className={styles.formWrapper}>
                    <div className={styles.brandSection}>
                        <div className={styles.logoContainer}>
                            <img src={logo} alt="Fusion Logo" className={styles.logoImage} />
                        </div>
                        <h1 className={styles.title}>Bienvenido</h1>
                        <p className={styles.subtitle}>Ingresa tus credenciales para continuar</p>
                    </div>

                    {error && (
                        <div className={styles.errorAlert}>
                            <ShieldAlert size={20} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Correo o Carnet</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="correo@ejemplo.com o Nro de Carnet"
                                    required
                                    className={styles.input}
                                />
                                <Mail size={18} className={styles.inputIcon} />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Contraseña</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className={styles.input}
                                />
                                <Lock size={18} className={styles.inputIcon} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={styles.passwordToggle}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.submitButton}
                        >
                            {loading ? (
                                <div className={styles.spinner} />
                            ) : (
                                <>
                                    Acceder al Portal
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* <div className={styles.footer}>
                        ¿Aún no eres miembro?
                        <Link to="/signup" className={styles.signupLink}>
                            Regístrate aquí
                        </Link>
                    </div> */}

                    <div className={styles.copyright}>
                        © 2026 Fusion Company. Todos los derechos reservados.
                    </div>
                </div>
            </div>
        </div>
    )
}
