import React from 'react'
import styles from './POS.module.css'
import logo from '../../assets/logo-icon.png'

export const Ticket = ({ saleData, branchName, sellerName }) => {
    if (!saleData) return null

    const { items = [], customer, total = 0, totalPV = 0, date } = saleData

    return (
        <div id="printable-ticket" className={styles.ticketContainer}>
            {/* Header */}
            <div className={styles.ticketHeader}>
                <img src={logo} alt="Fusion Logo" style={{ width: '40px', height: '40px', marginBottom: '5px' }} />
                <div className={styles.ticketTitle}>COMPROBANTE VENTA</div>
                <div className={styles.ticketSubtitle}>FUSION COMPANY</div>
            </div>

            <div className={styles.divider}>==========================</div>

            {/* Meta Info */}
            <div className={styles.ticketMeta}>
                <div className={styles.metaRow}>
                    <span>FECHA: {new Date(date).toLocaleDateString()}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>HORA: {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>NRO OP: {String(new Date(date).getTime()).slice(-6)}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>SUCURSAL: {String(branchName || 'CENTRAL').toUpperCase()}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>ATENDIDO: {String(sellerName || 'SISTEMA').toUpperCase()}</span>
                </div>

                <div className={styles.dividerDashed}>--------------------------</div>

                <div className={styles.metaRow}>
                    <span>CLI: {String(customer?.full_name || 'CLIENTE GENERAL').toUpperCase()}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>NIT/CI: {customer?.document_id || '0'}</span>
                </div>
            </div>

            <div className={styles.divider}>==========================</div>

            {/* Items Header */}
            <div className={styles.ticketItems}>
                <div className={styles.itemsHeader}>
                    <span style={{ width: '10%' }}>C.</span>
                    <span style={{ width: '60%' }}>DETALLE</span>
                    <span style={{ width: '30%', textAlign: 'right' }}>SUBT.</span>
                </div>
                <div className={styles.dividerDashedSmall}>--------------------------</div>

                {/* Items List */}
                {items.map((item, idx) => (
                    <div key={idx} className={styles.itemRowWrapper}>
                        <div className={styles.itemMainLine}>
                            <span style={{ width: '10%' }}>{item.quantity}</span>
                            <span style={{ width: '60%', fontWeight: '700' }}>{item.name?.toUpperCase()}</span>
                            <span style={{ width: '30%', textAlign: 'right', fontWeight: '800' }}>
                                {item.isGift ? "0.00" : (item.price * item.quantity).toFixed(2)}
                            </span>
                        </div>
                        <div className={styles.itemDetailLine}>
                            <span>PU: {(item.price || 0).toFixed(2)}</span>
                            {item.isGift && <span className={styles.giftLabel}>** REGALO **</span>}
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.divider}>==========================</div>

            {/* Totals */}
            <div className={styles.totalsBox}>
                <div className={styles.totalLine}>
                    <span>SUB-TOTAL:</span>
                    <span>{total.toFixed(2)}</span>
                </div>
                <div className={styles.totalLineLarge}>
                    <span>TOTAL A PAGAR:</span>
                    <span>{total.toFixed(2)} BS</span>
                </div>
            </div>

            <div className={styles.dividerDashed}>--------------------------</div>

            <div className={styles.fidelityBox}>
                <span>PV ACUMULADOS: {totalPV.toFixed(2)}</span>
            </div>

            <div className={styles.ticketFooter}>
                <div className={styles.thankYou}>¡GRACIAS POR SU COMPRA!</div>
                <div className={styles.validez}>Este comprobante no tiene valor fiscal.</div>
                <div className={styles.version}>FUSION APP v4.0 PRO</div>
            </div>
        </div>
    )
}
