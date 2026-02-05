import React from 'react'
import styles from './POS.module.css'
import logo from '../../assets/logo-icon.png'

export const Ticket = ({ saleData, branchName, sellerName, format = 'thermal' }) => {
    if (!saleData) return null

    const { items = [], customer, total = 0, totalPV = 0, date } = saleData

    if (format === 'letter') {
        return (
            <div id="printable-ticket" className="letterContainer">
                <div className="letterHeader">
                    <div className="companyInfo">
                        <h1>TIENDA FUSION</h1>
                        <p>Sucursal: {String(branchName || 'CENTRAL').toUpperCase()}</p>
                        <p>Vendedor: {String(sellerName || 'SISTEMA').toUpperCase()}</p>
                    </div>
                    <div className="saleInfo">
                        <div className="notaTitulo">NOTA DE VENTA</div>
                        <p><strong>NRO:</strong> {String(new Date(date).getTime()).slice(-6)}</p>
                        <p><strong>FECHA:</strong> {new Date(date).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="letterCustomer">
                    <p><strong>CLIENTE:</strong> {String(customer?.full_name || 'CLIENTE GENERAL').toUpperCase()}</p>
                    <p><strong>NIT/CI:</strong> {customer?.document_id || '0'}</p>
                </div>

                <table className="letterTable">
                    <thead>
                        <tr>
                            <th>CANT.</th>
                            <th>DESCRIPCIÓN</th>
                            <th>P. UNIT.</th>
                            <th>SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.quantity}</td>
                                <td>{item.name?.toUpperCase()} {item.isGift ? '(REGALO)' : ''}</td>
                                <td>{item.isGift ? '0.00' : (item.price || 0).toFixed(2)}</td>
                                <td>{item.isGift ? '0.00' : (item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="letterFooter">
                    <div className="signatureBox">
                        <div className="signatureLine"></div>
                        <p>RECIBÍ CONFORME</p>
                    </div>
                    <div className="letterTotals">
                        <div className="totalRowLetter">
                            <span>TOTAL BS:</span>
                            <strong>{total.toFixed(2)}</strong>
                        </div>
                        <div className="totalRowLetter">
                            <span>PUNTOS ACUMULADOS:</span>
                            <strong>{totalPV.toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
                <div className="letterDisclaimer">
                    Este documento es una nota de venta y no tiene valor fiscal.
                </div>
            </div>
        )
    }

    // Default Thermal Format
    return (
        <div id="printable-ticket" className="ticketContainer">
            {/* Header */}
            <div className="ticketHeader">
                {/* <img src={logo} alt="Fusion Logo" style={{ width: '40px', height: '40px', marginBottom: '5px' }} /> */}
                <div className="ticketTitle">COMPROBANTE VENTA</div>
                {/* <div className={styles.ticketSubtitle}>FUSION</div> */}
            </div>

            <div className="divider">============================</div>

            {/* Meta Info */}
            <div className="ticketMeta">
                <div className="metaRow">
                    <span>FECHA: {new Date(date).toLocaleDateString()}</span>
                </div>
                <div className="metaRow">
                    <span>HORA: {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="metaRow">
                    <span>NRO OP: {String(new Date(date).getTime()).slice(-6)}</span>
                </div>
                <div className="metaRow">
                    <span>SUCURSAL: {String(branchName || 'CENTRAL').toUpperCase()}</span>
                </div>
                <div className="metaRow">
                    <span>ATENDIDO: {String(sellerName || 'SISTEMA').toUpperCase()}</span>
                </div>

                <div className="dividerDashed">----------------------------</div>

                <div className="metaRow">
                    <span>CLI: {String(customer?.full_name || 'CLIENTE GENERAL').toUpperCase()}</span>
                </div>
                <div className="metaRow">
                    <span>NIT/CI: {customer?.document_id || '0'}</span>
                </div>
            </div>

            <div className="divider">============================</div>

            {/* Items Header */}
            <div className="ticketItems">
                <div className="itemsHeader">
                    <span style={{ width: '10%' }}>C.</span>
                    <span style={{ width: '60%' }}>DETALLE</span>
                    <span style={{ width: '30%', textAlign: 'right' }}>SUBT.</span>
                </div>
                <div className="dividerDashedSmall">----------------------------</div>

                {/* Items List */}
                {items.map((item, idx) => (
                    <div key={idx} className="itemRowWrapper">
                        <div className="itemMainLine">
                            <span style={{ width: '10%' }}>{item.quantity}</span>
                            <span style={{ width: '60%', fontWeight: '700' }}>{item.name?.toUpperCase()}</span>
                            <span style={{ width: '30%', textAlign: 'right', fontWeight: '800' }}>
                                {item.isGift ? "0.00" : (item.price * item.quantity).toFixed(2)}
                            </span>
                        </div>
                        <div className="itemDetailLine">
                            <span>PU: {(item.price || 0).toFixed(2)}</span>
                            {item.isGift && <span className="giftLabel">** REGALO **</span>}
                        </div>
                    </div>
                ))}
            </div>

            <div className="divider">============================</div>

            {/* Totals */}
            <div className="totalsBox">
                <div className="totalLine">
                    <span>SUB-TOTAL:</span>
                    <span>{total.toFixed(2)}</span>
                </div>
                <div className="totalLineLarge">
                    <span>TOTAL A PAGAR:</span>
                    <span>{total.toFixed(2)} BS</span>
                </div>
            </div>

            <div className="dividerDashed">----------------------------</div>

            <div className="fidelityBox">
                <span>PV ACUMULADOS: {totalPV.toFixed(2)}</span>
            </div>

            <div className="ticketFooter">
                <div className="thankYou">¡GRACIAS POR SU COMPRA!</div>
                <div className="validez">Este comprobante no tiene valor fiscal.</div>
                {/* <div className="version">FUSION APP v4.0 PRO</div> */}
            </div>
        </div>
    )
}
