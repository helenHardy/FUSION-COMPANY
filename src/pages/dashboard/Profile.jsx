
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'
import { User, Shield, CreditCard, Calendar, Award, Package, Sparkles, CheckCircle, XCircle } from 'lucide-react'
import styles from './Profile.module.css'

export default function Profile() {
    const { profile } = useAuth()

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

                {/* Benefit Card */}
                <div className={styles.benefitSection}>
                    <div className={`${styles.benefitCard} glass`}>
                        <div className={styles.benefitContent}>
                            <div className={styles.benefitHeader}>
                                <div style={{ color: '#fbbf24' }}>
                                    <Sparkles size={24} />
                                </div>
                                <h3 className={styles.benefitTitle}>Beneficio de Combo</h3>
                            </div>
                            <p className={styles.benefitDescription}>
                                Como recompensa a tu lealtad, tienes productos de regalo esperándote en tu próxima visita a sucursal.
                            </p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className={styles.countBadge}>{profile.free_products_count || 0}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                Productos Disponibles
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
