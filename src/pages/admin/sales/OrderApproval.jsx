
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import { CheckCircle, XCircle, Eye, ShoppingCart, User, MapPin, Package, Info, Loader2, Sparkles, AlertCircle, Printer, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import { Ticket } from '../../shop/Ticket'
import styles from './OrderApproval.module.css'

export default function OrderApproval() {
    const { profile } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [orderDetails, setOrderDetails] = useState([])
    const [printFormat, setPrintFormat] = useState('thermal')

    const thermalCSS = `
        @page { size: 58mm auto; margin: 0; }
        body { margin: 0; padding: 5mm; font-family: 'Courier New', Courier, monospace; background: white; color: black; }
        .ticketContainer { width: 48mm; margin: 0 auto; }
        .ticketHeader { text-align: center; margin-bottom: 5mm; border-bottom: 1px dashed #000; padding-bottom: 2mm; }
        .ticketTitle { font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase; }
        .ticketSubtitle { font-size: 9pt; margin: 1mm 0; }
        .ticketDivider { border-top: 1px dashed #000; margin: 2mm 0; }
        .ticketMeta { font-size: 8pt; margin-bottom: 3mm; }
        .ticketTable { width: 100%; border-collapse: collapse; font-size: 8pt; }
        .ticketTable th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 1mm; }
        .ticketTable td { padding: 1mm 0; vertical-align: top; }
        .ticketTotalSection { margin-top: 3mm; border-top: 1px double #000; padding-top: 2mm; }
        .totalRow { display: flex; justify-content: space-between; font-weight: bold; font-size: 10pt; }
        .pvRow { display: flex; justify-content: space-between; font-size: 8pt; margin-top: 1mm; }
        .ticketFooter { text-align: center; margin-top: 5mm; font-size: 7pt; font-style: italic; }
    `;

    const letterCSS = `
        @page { size: letter; margin: 20mm; }
        body { font-family: 'Inter', system-ui, sans-serif; background: white; color: #1e293b; padding: 0; }
        .letterContainer { max-width: 100%; margin: 0 auto; color: #334155; }
        .letterHeader { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem; }
        .companyInfo h1 { margin: 0; color: #6366f1; font-size: 24pt; font-weight: 900; }
        .notaVenta { text-align: right; }
        .notaVenta h2 { margin: 0; font-size: 18pt; color: #1e293b; }
        .letterContent { margin-bottom: 2rem; }
        .clientInfo { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; }
        .infoGroup label { display: block; font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .letterTable { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
        .letterTable th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 9pt; font-weight: 800; border-bottom: 1px solid #e2e8f0; }
        .letterTable td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 10pt; }
        .letterTotals { margin-left: auto; width: 250px; background: #f8fafc; padding: 1rem; border-radius: 12px; }
        .totalLine { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .totalMain { font-weight: 900; color: #6366f1; font-size: 14pt; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
        .signatureArea { margin-top: 4rem; display: flex; justify-content: center; }
        .signBox { width: 250px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px; font-size: 9pt; color: #64748b; }
    `;

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        try {
            setLoading(true)
            let query = supabase
                .from('sales')
                .select('*, profiles(full_name, document_id, free_products_count), sucursales(name)')
                .eq('status', 'pendiente')
                .order('created_at', { ascending: false })

            // Si es sucursal, filtrar por su sucursal asignada. Los administradores y cajeros ven todo.
            if (profile.role === 'sucursal') {
                const { data: branch } = await supabase.from('sucursales').select('id').eq('manager_id', profile.id).maybeSingle()
                if (branch) query = query.eq('branch_id', branch.id)
                else {
                    // Si no tiene sucursal asignada, mejor no mostrar nada o mostrar vacío
                    setOrders([])
                    setLoading(false)
                    return
                }
            }

            const { data, error } = await query
            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Error fetching orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchOrderDetails = async (saleId) => {
        const { data, error } = await supabase
            .from('sale_items')
            .select('*, products(name, image_url)')
            .eq('sale_id', saleId)

        if (!error) setOrderDetails(data)
    }

    const handleViewDetails = (order) => {
        setSelectedOrder(order)
        fetchOrderDetails(order.id)
    }

    const handleApprove = async (orderId) => {
        if (!confirm('¿Estás seguro de que deseas aprobar este pedido? Esto descontará el stock y generará los puntos/comisiones.')) return

        setApproving(true)
        try {
            const { error } = await supabase.rpc('approve_order', {
                p_sale_id: orderId,
                p_approver_id: profile.id
            })

            if (error) throw error

            alert('¡Pedido aprobado con éxito!')
            setSelectedOrder(null)
            fetchOrders()
        } catch (error) {
            alert(`Error: ${error.message}`)
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async (orderId) => {
        if (!confirm('¿Deseas rechazar este pedido?')) return

        try {
            const { error } = await supabase
                .from('sales')
                .update({ status: 'rechazado' })
                .eq('id', orderId)

            if (error) throw error
            setSelectedOrder(null)
            fetchOrders()
        } catch (error) {
            alert(error.message)
        }
    }

    const handlePrint = async (order) => {
        try {
            let items = []
            if (selectedOrder && selectedOrder.id === order.id && orderDetails.length > 0) {
                items = orderDetails
            } else {
                const { data, error } = await supabase
                    .from('sale_items')
                    .select('*, products(name)')
                    .eq('sale_id', order.id)
                if (error) throw error
                items = data
            }

            const saleData = {
                items: items.map(i => ({
                    quantity: i.quantity,
                    name: i.products?.name,
                    price: i.price_at_sale,
                    isGift: i.price_at_sale === 0
                })),
                total: order.total_amount,
                totalPV: order.total_pv,
                date: order.created_at,
                customer: {
                    full_name: order.profiles?.full_name,
                    document_id: order.profiles?.document_id
                }
            }

            // Create temporary iframe for printing
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;

            // Simple render function since we can't easily use React inside iframe's doc.write without complex setup
            // Instead we use the state-of-the-art approach: render to a hidden div and clone its innerHTML
            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            document.body.appendChild(tempDiv);

            // Logic to get the rendered HTML of the Ticket component
            // Since we can't easily do that here, we'll use the hidden element approach
            // Set the printing status so hidden div populates
            const ticketElement = document.getElementById('printable-ticket-approval');
            if (ticketElement) {
                const css = printFormat === 'thermal' ? thermalCSS : letterCSS;
                doc.open();
                doc.write(`
                    <html>
                        <head>
                            <title>Imprimir Comprobante</title>
                            <style>${css}</style>
                        </head>
                        <body>
                            ${ticketElement.innerHTML}
                        </body>
                    </html>
                `);
                doc.close();

                iframe.contentWindow.focus();
                setTimeout(() => {
                    iframe.contentWindow.print();
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 500);
            }

        } catch (err) {
            console.error("Error al imprimir:", err)
            alert("Error al obtener detalles para impresión")
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Control de <span className={styles.highlight}>Pedidos</span>
                    </h1>
                    <p className={styles.subtitle}>Supervisión y aprobación de solicitudes de sucursales y socios.</p>
                </div>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Fecha', 'Socio', 'Sucursal', 'Total', 'PV', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : orders.map((order) => (
                        <tr key={order.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.dateCell}>
                                    <span className={styles.dateText}>{formatDate(order.created_at)}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.userCell}>
                                    <User size={16} color="var(--primary-light)" />
                                    <span>{order.profiles?.full_name}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.branchCell}>
                                    <MapPin size={16} color="var(--text-dim)" />
                                    <span>{order.sucursales?.name}</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <span className={styles.amount}>{formatCurrency(order.total_amount)}</span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.pvBadge}>
                                    <Sparkles size={12} />
                                    {order.total_pv} PV
                                </div>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.actions}>
                                    <button onClick={() => handleViewDetails(order)} className={styles.viewBtn}>
                                        <Eye size={16} />
                                    </button>
                                    <button onClick={() => handlePrint(order)} className={styles.viewBtn} style={{ background: '#f59e0b', color: 'white' }} title="Imprimir Ticket">
                                        <Printer size={16} />
                                    </button>
                                    <button onClick={() => handleApprove(order.id)} className={styles.approveBtn}>
                                        <CheckCircle size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && orders.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-dim)' }}>
                        <ShoppingCart size={64} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No hay pedidos pendientes por el momento.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title="Detalles del Pedido"
                width="700px"
            >
                {selectedOrder && (
                    <div className={styles.detailContent}>
                        <div className={styles.detailHeader}>
                            <div className={styles.detailUserCard}>
                                <div className={styles.avatar}>
                                    <User size={24} />
                                </div>
                                <div>
                                    <div className={styles.detailUserName}>{selectedOrder.profiles?.full_name}</div>
                                    <div className={styles.detailUserId}>ID: {selectedOrder.profiles?.document_id}</div>
                                    <div className={styles.detailGiftBalance}>Balance Regalos: {selectedOrder.profiles?.free_products_count}</div>
                                </div>
                            </div>
                            <div className={styles.detailAmountCard}>
                                <div className={styles.detailTotal}>{formatCurrency(selectedOrder.total_amount)}</div>
                                <div className={styles.detailPV}>{selectedOrder.total_pv} Puntos Totales</div>
                            </div>
                        </div>

                        {/* Format Selection UI */}
                        <div className={styles.formatSelectorBox}>
                            <h4 className={styles.sectionTitle}>Formato de Impresión</h4>
                            <div className={styles.formatOptions}>
                                <button
                                    className={`${styles.formatOption} ${printFormat === 'letter' ? styles.activeFormat : ''}`}
                                    onClick={() => setPrintFormat('letter')}
                                >
                                    <div className={styles.formatIcon}>
                                        <FileText size={20} />
                                    </div>
                                    <div className={styles.formatText}>
                                        <strong>Hoja Carta</strong>
                                        <span>Normal (Nota Venta)</span>
                                    </div>
                                </button>
                                <button
                                    className={`${styles.formatOption} ${printFormat === 'thermal' ? styles.activeFormat : ''}`}
                                    onClick={() => setPrintFormat('thermal')}
                                >
                                    <div className={styles.formatIcon}>
                                        <Printer size={20} />
                                    </div>
                                    <div className={styles.formatText}>
                                        <strong>Ticket térmico</strong>
                                        <span>Simplificado (58mm)</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div className={styles.itemsList}>
                            <h4 className={styles.sectionTitle}>Productos en Pedido</h4>
                            {orderDetails.map(item => (
                                <div key={item.id} className={styles.detailItem}>
                                    <div className={styles.itemImg}>
                                        {item.products?.image_url ? (
                                            <img src={item.products.image_url} alt={item.products.name} />
                                        ) : (
                                            <Package size={20} />
                                        )}
                                    </div>
                                    <div className={styles.itemInfo}>
                                        <div className={styles.itemName}>
                                            {item.products?.name}
                                            {item.is_gift && <span className={styles.giftBadge}>REGALO</span>}
                                        </div>
                                        <div className={styles.itemMeta}>
                                            {item.quantity} x {item.is_gift ? '0.00 Bs' : formatCurrency(item.price_at_sale)}
                                        </div>
                                    </div>
                                    <div className={styles.itemTotal}>
                                        {item.is_gift ? 'GRATIS' : formatCurrency(item.price_at_sale * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.modalActions}>
                            <button onClick={() => handleReject(selectedOrder.id)} className={styles.rejectBtn} disabled={approving}>
                                <XCircle size={20} /> Rechazar Pedido
                            </button>
                            <button onClick={() => handleApprove(selectedOrder.id)} className={styles.approveFullBtn} disabled={approving}>
                                {approving ? (
                                    <Loader2 className="spinner-small" size={20} />
                                ) : (
                                    <>
                                        <CheckCircle size={20} /> Aprobar y Despachar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Hidden Ticket for Printing */}
            <div className={styles.hiddenPrintWrapper}>
                <div id="printable-ticket-approval">
                    <Ticket
                        saleData={selectedOrder ? {
                            items: orderDetails.map(i => ({
                                quantity: i.quantity,
                                name: i.products?.name,
                                price: i.price_at_sale,
                                isGift: i.price_at_sale === 0
                            })),
                            total: selectedOrder.total_amount,
                            totalPV: selectedOrder.total_pv,
                            date: selectedOrder.created_at,
                            customer: {
                                full_name: selectedOrder.profiles?.full_name,
                                document_id: selectedOrder.profiles?.document_id
                            }
                        } : null}
                        branchName={selectedOrder?.sucursales?.name || 'CENTRAL'}
                        sellerName="ADMIN"
                        format={printFormat}
                    />
                </div>
            </div>
        </div>
    )
}
