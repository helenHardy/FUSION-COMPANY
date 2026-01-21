
export default function Table({ headers, children }) {
    return (
        <div style={{
            overflowX: 'auto',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            backdropFilter: 'var(--glass-blur)'
        }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{
                    backgroundColor: 'var(--input-bg)',
                    borderBottom: '1px solid var(--border-color)'
                }}>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index} style={{
                                padding: '1rem 1.5rem',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                color: 'var(--text-dim)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody style={{ backgroundColor: 'transparent' }}>
                    {children}
                </tbody>
            </table>
        </div>
    )
}
