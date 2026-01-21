
export default function Badge({ status, type = 'default' }) {
    const styles = {
        activo: {
            bg: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            label: 'Activo',
            border: '1px solid rgba(16, 185, 129, 0.2)'
        },
        inactivo: {
            bg: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            label: 'Inactivo',
            border: '1px solid rgba(239, 68, 68, 0.2)'
        },
        default: {
            bg: 'var(--input-bg)',
            color: 'var(--text-dim)',
            label: status,
            border: '1px solid var(--border-color)'
        }
    }

    const config = styles[status] || styles.default

    return (
        <span style={{
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            backgroundColor: config.bg,
            color: config.color,
            border: config.border,
            display: 'inline-flex',
            alignItems: 'center'
        }}>
            {config.label}
        </span>
    )
}
