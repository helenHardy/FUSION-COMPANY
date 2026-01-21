
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import { CheckCircle, XCircle, Eye, ShoppingCart, User, MapPin, Package, Info, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import styles from './OrderApproval.module.css'

export default function OrderApproval() {
    const { profile } = useAuth()
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [orderDetails, setOrderDetails] = useState([])

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

            // Si es sucursal, filtrar por su sucursal asignada
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
        </div>
    )
}
