
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, ShoppingCart, User, Package, Trash2, Plus, Minus, CheckCircle, ArrowRight, X, Loader2, Sparkles, Printer } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { Ticket } from './Ticket'
import styles from './POS.module.css'

export default function POS() {
    const { profile } = useAuth()
    const [branches, setBranches] = useState([])
    const [selectedBranch, setSelectedBranch] = useState('')
    const [products, setProducts] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [cart, setCart] = useState([])
    const [customers, setCustomers] = useState([])
    const [customerSearch, setCustomerSearch] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(null)
    const [lastSale, setLastSale] = useState(null)
    const [showCart, setShowCart] = useState(false) // For mobile cart view

    useEffect(() => {
        fetchBranches()
    }, [])

    useEffect(() => {
        if (selectedBranch) {
            fetchInventory()
        }
    }, [selectedBranch])

    const fetchBranches = async () => {
        const { data } = await supabase.from('sucursales').select('*').eq('status', 'activo')
        setBranches(data || [])
        if (data?.length > 0) setSelectedBranch(data[0].id)
    }

    const fetchInventory = async () => {
        const { data } = await supabase
            .from('inventory')
            .select('stock, products(*)')
            .eq('branch_id', selectedBranch)
            .gt('stock', 0)

        if (data) {
            const formatted = data
                .filter(item => item.products)
                .map(item => ({
                    ...item.products,
                    stock: item.stock
                }))
            setProducts(formatted)
        }
    }

    const searchCustomers = async (query) => {
        setCustomerSearch(query)
        if (query.length < 3) {
            setCustomers([])
            return
        }
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .or(`full_name.ilike.%${query}%,document_id.ilike.%${query}%`)
            .limit(5)
        setCustomers(data || [])
    }

    const addToCart = (product) => {
        console.log("Adding to cart:", product.name)
        if (!product?.id) {
            console.error("Product has no ID", product)
            return
        }

        // Calcular cuántos regalos ya hay en el carrito
        const currentGifts = cart.filter(item => item.isGift).reduce((sum, item) => sum + item.quantity, 0)
        const availableGifts = (selectedCustomer?.free_products_count || 0) - currentGifts

        // Si hay balance disponible, se añade como regalo
        const shouldBeGift = availableGifts > 0

        const existing = cart.find(item => item.id === product.id && item.isGift === shouldBeGift)

        if (existing) {
            // Verificar stock total (gift + normal)
            const totalQty = cart
                .filter(item => item.id === product.id)
                .reduce((sum, item) => sum + item.quantity, 0)

            if (totalQty >= product.stock) return

            setCart(cart.map(item =>
                (item.id === product.id && item.isGift === shouldBeGift)
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            setCart([...cart, { ...product, quantity: 1, isGift: shouldBeGift }])
        }
    }

    // Sincronizar regalos automáticamente cuando cambia el cliente
    useEffect(() => {
        if (!selectedCustomer) {
            // Si se quita el cliente, todos los productos pasan a ser normales
            if (cart.some(i => i.isGift)) {
                setCart(cart.map(i => ({ ...i, isGift: false })))
            }
            return
        }

        const balance = selectedCustomer.free_products_count || 0
        if (balance >= 0) {
            const newCart = []
            let remainingGifts = balance

            // Aplanar el carrito para redistribuir regalos (unidades individuales)
            const units = []
            cart.forEach(item => {
                for (let k = 0; k < item.quantity; k++) {
                    units.push({ ...item, quantity: 1 })
                }
            })

            // Marcar unidades como regalo hasta agotar el balance
            units.forEach(u => {
                if (remainingGifts > 0) {
                    u.isGift = true
                    remainingGifts--
                } else {
                    u.isGift = false
                }
            })

            // Re-consolidar el carrito por ID e isGift
            units.forEach(u => {
                const existing = newCart.find(i => i.id === u.id && i.isGift === u.isGift)
                if (existing) {
                    existing.quantity += 1
                } else {
                    newCart.push(u)
                }
            })

            // Actualizar si hay cambios
            if (JSON.stringify(newCart) !== JSON.stringify(cart)) {
                setCart(newCart)
            }
        }
    }, [selectedCustomer, selectedCustomer?.free_products_count])

    const toggleGift = (id, isGift) => {
        if (!selectedCustomer) return

        const giftCount = cart.filter(item => item.isGift).reduce((sum, i) => sum + i.quantity, 0)

        if (!isGift && giftCount >= (selectedCustomer.free_products_count || 0)) {
            alert("El cliente no tiene suficiente balance de regalos.")
            return
        }

        // Simplemente invertimos el flag del item específico
        const updated = cart.map(item =>
            (item.id === id && item.isGift === isGift) ? { ...item, isGift: !isGift } : item
        )

        // Consolidar por si ahora hay dos líneas iguales
        const consolidated = []
        updated.forEach(u => {
            const existing = consolidated.find(i => i.id === u.id && i.isGift === u.isGift)
            if (existing) {
                existing.quantity += u.quantity
            } else {
                consolidated.push(u)
            }
        })

        setCart(consolidated)
    }

    const updateQuantity = (id, isGift, delta) => {
        setCart(cart.map(item => {
            if (item.id === id && item.isGift === isGift) {
                const newQty = item.quantity + delta
                if (newQty < 1) return item
                if (newQty > item.stock) return item
                return { ...item, quantity: newQty }
            }
            return item
        }))
    }

    const removeFromCart = (id, isGift) => {
        setCart(cart.filter(item => !(item.id === id && item.isGift === isGift)))
    }

    const totalAmount = cart.reduce((sum, item) => sum + (item.isGift ? 0 : item.price * item.quantity), 0)
    const totalPV = cart.reduce((sum, item) => sum + (item.isGift ? 0 : item.pv_points * item.quantity), 0)

    const handleCheckout = async () => {
        if (!selectedCustomer) {
            alert("Por favor seleccione un cliente")
            return
        }
        if (cart.length === 0) return

        setLoading(true)
        try {
            const items = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price,         // For process_sale compatibility
                pv: item.pv_points,        // For process_sale compatibility
                price_at_sale: item.price, // For create_pending_order
                pv_at_sale: item.pv_points, // For create_pending_order
                is_gift: item.isGift
            }))

            const isManager = ['admin', 'sucursal', 'cajero'].includes(profile.role)

            let rpcName = isManager ? 'process_sale' : 'create_pending_order'
            let params = isManager ? {
                p_user_id: selectedCustomer.id,
                p_branch_id: selectedBranch,
                p_seller_id: profile.id,
                p_items: items
            } : {
                p_user_id: selectedCustomer.id,
                p_branch_id: selectedBranch,
                p_seller_id: profile.id,
                p_items: items,
                p_total_amount: totalAmount,
                p_total_pv: totalPV
            }

            const { error } = await supabase.rpc(rpcName, params)

            if (error) throw error

            setSuccess(isManager ? "¡Venta realizada con éxito!" : "¡Pedido solicitado con éxito! Espera aprobación.")

            // Set last sale data for Ticket Modal
            if (isManager) {
                const branchName = branches.find(b => b.id === selectedBranch)?.name || 'Central'
                setLastSale({
                    items: [...cart],
                    customer: selectedCustomer,
                    total: totalAmount,
                    totalPV: totalPV,
                    date: new Date().toISOString(),
                    branchName,
                    sellerName: profile.full_name || profile.email
                })
            }

            setCart([])
            setSelectedCustomer(null)
            setCustomerSearch('')
            setShowCart(false)
            fetchInventory()

            // Only auto-hide success toast if we are NOT showing the modal (i.e. pending orders)
            if (!isManager) {
                setTimeout(() => setSuccess(null), 3000)
            } else {
                // For managers, we show modal, so maybe clear toast immediately or keep it?
                // Let's clear toast to avoid clutter since modal is clear enough
                setTimeout(() => setSuccess(null), 1000)
            }
        } catch (err) {
            alert("Error al procesar: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className={styles.container}>
                {/* Products Section */}
                <div className={styles.productsSection}>
                    <header className={styles.header}>
                        <div>
                            <h2 className={styles.title}>Tienda <span className={styles.highlight}>Fusion</span></h2>
                            <p className={styles.subtitle}>Suministros corporativos y productos exclusivos.</p>
                        </div>
                    </header>

                    <div className={`${styles.filterBar} glass`}>
                        <div className={styles.branchBox}>
                            <label className={styles.inputLabel}>Punto de Venta</label>
                            <select
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                                className="input"
                                style={{ fontWeight: '700' }}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className={styles.searchBox}>
                            <label className={styles.inputLabel}>Buscar Productos</label>
                            <div className={styles.searchInputWrapper}>
                                <Search className={styles.searchIcon} size={18} />
                                <input
                                    type="text"
                                    placeholder="Nombre o categoría..."
                                    className={`input ${styles.searchInput}`}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.productGrid}>
                        {products
                            .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(product => (
                                <div key={product.id} className={styles.productCard}>
                                    <div className={styles.imageContainer}>
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className={styles.image} />
                                        ) : (
                                            <Package className={styles.placeholderIcon} size={64} />
                                        )}
                                    </div>
                                    <div className={styles.infoBox}>
                                        <h4 className={styles.productName}>{product.name}</h4>
                                        <div className={styles.priceRow}>
                                            <div className={styles.price}>{formatCurrency(product.price)}</div>
                                            <div className={styles.pvBadge}>{product.pv_points} PV</div>
                                        </div>
                                        <div className={`${styles.stock} ${product.stock < 10 ? styles.stockLow : styles.stockNormal}`}>
                                            {product.stock} unidades
                                        </div>
                                        <button
                                            className={styles.addButton}
                                            onClick={() => addToCart(product)}
                                        >
                                            <Plus size={18} /> Añadir
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Cart Section */}
                <div className={`${styles.cartContainer} ${showCart ? styles.cartContainerOpen : ''}`}>
                    <div className={styles.cartCard}>
                        <div className={styles.cartHeader}>
                            <div className={styles.cartTitleBox}>
                                <div className={styles.cartHeaderIcon}>
                                    <ShoppingCart size={24} />
                                </div>
                                <h3 className={styles.cartTitle}>Venta Actual</h3>
                            </div>
                            <button className={styles.closeCart} onClick={() => setShowCart(false)}>
                                <X size={24} />
                            </button>
                        </div>

                        {/* Customer Selection */}
                        <div className={styles.customerSection}>
                            <label className={styles.inputLabel}>Asignar a Cliente</label>
                            {!selectedCustomer ? (
                                <div style={{ position: 'relative', marginTop: '8px' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Nombre o ID de Carnet..."
                                        value={customerSearch}
                                        onChange={e => searchCustomers(e.target.value)}
                                    />
                                    {customers.length > 0 && (
                                        <div className={styles.searchResults}>
                                            {customers.map(c => (
                                                <div key={c.id} onClick={() => setSelectedCustomer(c)} className={styles.searchItem}>
                                                    <div className={styles.customerName}>{c.full_name}</div>
                                                    <div className={styles.customerId}>ID: {c.document_id}</div>
                                                    {c.free_products_count > 0 && (
                                                        <div className={styles.giftBalance} style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                            <Sparkles size={12} />
                                                            <span>Tiene {c.free_products_count} regalos</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={styles.selectedCustomer}>
                                    <div className={styles.customerAvatar}>
                                        <User size={22} />
                                    </div>
                                    <div className={styles.customerInfo}>
                                        <div className={styles.customerName}>{selectedCustomer.full_name}</div>
                                        <div className={styles.customerId}>#{selectedCustomer.document_id}</div>
                                        {(selectedCustomer.free_products_count || 0) > 0 ? (
                                            <div className={styles.giftBalance}>
                                                <Sparkles size={12} />
                                                <span>Regalos: {selectedCustomer.free_products_count} disponibles</span>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                                                Sin regalos disponibles
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedCustomer(null)} className={styles.removeCustomer}>
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cart Items */}
                        <div className={styles.cartItems}>
                            {cart.length === 0 ? (
                                <div className={styles.emptyCart}>
                                    <ShoppingCart size={64} className={styles.emptyIcon} />
                                    <p style={{ fontWeight: '700' }}>El carrito está vacío</p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Selecciona productos para comenzar la venta.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={`${item.id}-${item.isGift}`} className={styles.cartItem}>
                                        <div className={styles.itemMain}>
                                            <div className={styles.itemName}>
                                                {item.name}
                                                {item.isGift && <span className={styles.giftLabel}>REGALO</span>}
                                            </div>
                                            <div className={styles.itemMeta}>
                                                {item.isGift ? 'Costo: 0 Bs' : formatCurrency(item.price)} <span style={{ opacity: 0.3 }}>•</span> {item.isGift ? '0 PV' : `${item.pv_points} PV`}
                                            </div>
                                        </div>
                                        <div className={styles.qtyControls}>
                                            {(selectedCustomer?.free_products_count || 0) > 0 && (
                                                <button
                                                    className={`${styles.giftToggle} ${item.isGift ? styles.giftActive : ''}`}
                                                    onClick={() => toggleGift(item.id, item.isGift)}
                                                    title="Marcar como regalo"
                                                >
                                                    <Sparkles size={14} />
                                                </button>
                                            )}
                                            <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.isGift, -1)}>
                                                <Minus size={14} />
                                            </button>
                                            <span className={styles.qtyValue}>{item.quantity}</span>
                                            <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.isGift, 1)}>
                                                <Plus size={14} />
                                            </button>
                                            <button onClick={() => removeFromCart(item.id, item.isGift)} className={styles.deleteBtn}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Checkout Summary */}
                        <div className={styles.cartFooter}>
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Puntos acumulados</span>
                                <span className={styles.totalPV}>{totalPV.toFixed(2)} PV</span>
                            </div>
                            <div className={styles.totalRow}>
                                <span className={styles.totalLabel}>Total</span>
                                <span className={styles.totalValue}>{formatCurrency(totalAmount)}</span>
                            </div>
                            <button
                                className={styles.checkoutBtn}
                                disabled={loading || cart.length === 0 || !selectedCustomer}
                                onClick={handleCheckout}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="spinner-small" size={24} />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Finalizar Venta</span>
                                        <ArrowRight size={22} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Cart Toggle */}
                <button className={`button ${styles.mobileToggle}`} onClick={() => setShowCart(true)}>
                    <ShoppingCart size={24} />
                    {cart.length > 0 && <span className={styles.cartBadge}>{cart.length}</span>}
                    <span>Ver Carrito</span>
                </button>

                {success && (
                    <div className={styles.successToast}>
                        <CheckCircle size={24} />
                        <span>{success}</span>
                    </div>
                )}

                {/* Ticket Modal */}
                {lastSale && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.ticketModal}>
                            <div className={styles.modalHeader}>
                                <div className={styles.successIconBox}>
                                    <CheckCircle size={32} />
                                </div>
                                <h2 className={styles.modalTitle}>¡Venta Exitosa!</h2>
                                <p className={styles.modalDescription}>La transacción se ha registrado correctamente.</p>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button onClick={() => window.print()} className={styles.printBtn}>
                                    <Printer size={20} />
                                    Imprimir Ticket
                                </button>

                                <button onClick={() => setLastSale(null)} className={styles.closeModalBtn}>
                                    Cerrar / Nueva Venta
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
            {/* Hidden Ticket Component for Print at the root level for best print reliability */}
            <Ticket saleData={lastSale} branchName={lastSale?.branchName} sellerName={lastSale?.sellerName} />
        </>
    )
}
