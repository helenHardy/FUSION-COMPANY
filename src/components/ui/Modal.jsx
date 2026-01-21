
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-secondary)',
                backdropFilter: 'var(--glass-blur)',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                width: '90%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                position: 'relative',
                boxShadow: 'var(--shadow-premium)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                color: 'var(--text-main)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '2rem',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        fontFamily: 'Outfit, sans-serif'
                    }}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '8px',
                            cursor: 'pointer',
                            color: 'var(--text-dim)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '2rem' }}>
                    {children}
                </div>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            `}</style>
        </div>
    )
}
