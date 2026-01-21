import React from 'react'
import styles from './POS.module.css'

export const Ticket = ({ saleData, branchName, sellerName }) => {
    if (!saleData) return null

    const { items, customer, total, totalPV, date } = saleData

    return (
        <div id="printable-ticket" className={styles.ticketContainer}>
            {/* Header / Business Name */}
            <div className={styles.ticketHeader}>
                <h1 className={styles.companyName}>FUSION COMPANY</h1>
                <div className={styles.ticketSubtitle}>TICKET DE VENTA</div>
            </div>

            {/* Sale Meta Info */}
            <div className={styles.ticketMeta}>
                <div className={styles.metaRow}>
                    <span>FECHA: {new Date(date).toLocaleDateString()}</span>
                    <span>HORA: {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>SUCURSAL: {branchName?.toUpperCase()}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>CAJERO: {sellerName?.toUpperCase()}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>CLIENTE: {customer?.full_name?.toUpperCase() || 'CLIENTE GENERAL'}</span>
                </div>
                <div className={styles.metaRow}>
                    <span>NIT/CI: {customer?.document_id || '0'}</span>
                </div>
            </div>

            <div className={styles.divider}>------------------------------------------</div>

            {/* Items Table - Professional standard */}
            <table className={styles.itemsTable}>
                <thead>
                    <tr>
                        <th className={styles.colQty}>CANT</th>
                        <th className={styles.colDesc}>DESCRIPCIÓN</th>
                        <th className={styles.colTotal}>TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx}>
                            <td className={styles.colQty}>{item.quantity}</td>
                            <td className={styles.colDesc}>
                                {item.name?.toUpperCase()}
                                {item.isGift && <div className={styles.giftTag}>** REGALO **</div>}
                            </td>
                            <td className={styles.colTotal}>
                                {item.isGift ? "0.00" : (item.price * item.quantity).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className={styles.divider}>------------------------------------------</div>

            {/* Totals */}
            <div className={styles.totalsContainer}>
                <div className={styles.totalRow}>
                    <span>SUBTOTAL BS:</span>
                    <span>{total.toFixed(2)}</span>
                </div>
                <div className={styles.totalRow}>
                    <span>DESCUENTO BS:</span>
                    <span>0.00</span>
                </div>
                <div className={styles.grandTotal}>
                    <span>TOTAL BS:</span>
                    <span>{total.toFixed(2)}</span>
                </div>
            </div>

            <div className={styles.pointsInfo}>
                PUNTOS ACUMULADOS: {totalPV?.toFixed(2)} PV
            </div>

            {/* Footer */}
            <div className={styles.ticketFooter}>
                <p>¡GRACIAS POR SU PREFERENCIA!</p>
                <p>*** DOCUMENTO SIN VALOR FISCAL ***</p>
                <p>v2.0 - FUSION SYSTEM</p>
            </div>
        </div>
    )
}
