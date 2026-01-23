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
    const [showCart, setShowCart] = useState(false)

    useEffect(() => {
        fetchBranches()
    }, [])

    useEffect(() => {
        if (selectedBranch) {
            fetchInventory()
        }
    }, [selectedBranch])

    useEffect(() => {
        if (profile?.role === 'afiliado' && !selectedCustomer) {
            setSelectedCustomer(profile)
        }
    }, [profile, selectedCustomer])

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
        if (!product?.id) return
        const currentGifts = cart.filter(item => item.isGift).reduce((sum, item) => sum + item.quantity, 0)
        const availableGifts = (selectedCustomer?.free_products_count || 0) - currentGifts
        const shouldBeGift = availableGifts > 0

        const existing = cart.find(item => item.id === product.id && item.isGift === shouldBeGift)

        if (existing) {
            const totalQty = cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0)
            if (totalQty >= product.stock) return
            setCart(cart.map(item => (item.id === product.id && item.isGift === shouldBeGift) ? { ...item, quantity: item.quantity + 1 } : item))
        } else {
            setCart([...cart, { ...product, quantity: 1, isGift: shouldBeGift }])
        }
    }

    useEffect(() => {
        if (!selectedCustomer) {
            if (cart.some(i => i.isGift)) setCart(cart.map(i => ({ ...i, isGift: false })))
            return
        }
        const balance = selectedCustomer.free_products_count || 0
        const newCart = []
        let remainingGifts = balance
        const units = []
        cart.forEach(item => { for (let k = 0; k < item.quantity; k++) units.push({ ...item, quantity: 1 }) })
        units.forEach(u => { if (remainingGifts > 0) { u.isGift = true; remainingGifts-- } else { u.isGift = false } })
        units.forEach(u => {
            const existing = newCart.find(i => i.id === u.id && i.isGift === u.isGift)
            if (existing) existing.quantity += 1; else newCart.push(u)
        })
        if (JSON.stringify(newCart) !== JSON.stringify(cart)) setCart(newCart)
    }, [selectedCustomer, cart])

    const toggleGift = (id, isGift) => {
        if (!selectedCustomer) return
        const giftCount = cart.filter(item => item.isGift).reduce((sum, i) => sum + i.quantity, 0)
        if (!isGift && giftCount >= (selectedCustomer.free_products_count || 0)) {
            alert("El cliente no tiene suficiente balance de regalos.")
            return
        }
        const updated = cart.map(item => (item.id === id && item.isGift === isGift) ? { ...item, isGift: !isGift } : item)
        const consolidated = []
        updated.forEach(u => {
            const existing = consolidated.find(i => i.id === u.id && i.isGift === u.isGift)
            if (existing) existing.quantity += u.quantity; else consolidated.push(u)
        })
        setCart(consolidated)
    }

    const updateQuantity = (id, isGift, delta) => {
        setCart(cart.map(item => {
            if (item.id === id && item.isGift === isGift) {
                const newQty = item.quantity + delta
                if (newQty < 1 || newQty > item.stock) return item
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
        const isManager = ['admin', 'sucursal', 'cajero'].includes(profile.role)
        if (!selectedCustomer && !isManager) { alert("Por favor seleccione un cliente"); return }
        if (cart.length === 0) return
        setLoading(true)
        try {
            const items = cart.map(item => ({ product_id: item.id, quantity: item.quantity, price: item.price, pv: item.pv_points, price_at_sale: item.price, pv_at_sale: item.pv_points, is_gift: item.isGift }))
            const isManager = ['admin', 'sucursal', 'cajero'].includes(profile.role)
            let rpcName = isManager ? 'process_sale' : 'create_pending_order'
            let params = { p_user_id: selectedCustomer?.id || null, p_branch_id: selectedBranch, p_seller_id: profile.id, p_items: items }
            if (!isManager) { params.p_total_amount = totalAmount; params.p_total_pv = totalPV }

            const { error } = await supabase.rpc(rpcName, params)
            if (error) throw error

            setSuccess(isManager ? "¡Venta realizada con éxito!" : "¡Pedido solicitado con éxito!")
            if (isManager) {
                setLastSale({ items: [...cart], customer: selectedCustomer, total: totalAmount, totalPV: totalPV, date: new Date().toISOString(), branchName: branches.find(b => b.id === selectedBranch)?.name || 'Central', sellerName: profile.full_name || profile.email })
            }
            setCart([]); setSelectedCustomer(null); setCustomerSearch(''); setShowCart(false); fetchInventory()
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) { alert("Error: " + err.message) } finally { setLoading(false) }
    }

    const handlePrint = () => {
        const ticketContent = document.getElementById('printable-ticket');
        if (!ticketContent) return;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        const css = `
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; padding: 0; width: 58mm; background: white; color: black; font-family: 'Courier New', Courier, monospace; font-size: 8pt; line-height: 1.2; overflow-x: hidden; }
            #printable-ticket { width: 58mm; padding: 2mm 1mm; box-sizing: border-box; }
            .ticketHeader { text-align: center; margin-bottom: 2mm; border-bottom: 0.5pt dashed black; padding-bottom: 1.5mm; }
            .ticketTitle { font-size: 10pt; font-weight: 950; line-height: 1.1; margin: 0; }
            .ticketSubtitle { font-size: 8pt; font-weight: 700; margin-top: 1mm; }
            .divider { text-align: center; margin: 1.5mm 0; font-weight: 900; letter-spacing: -1px; }
            .ticketMeta { font-size: 8pt; margin-bottom: 2mm; }
            .metaRow { display: flex; justify-content: space-between; margin-bottom: 0.5mm; line-height: 1; }
            .ticketItems { width: 100%; margin: 2mm 0; }
            .itemsHeader { display: flex; justify-content: space-between; font-weight: 950; border-bottom: 0.5pt solid black; padding-bottom: 0.5mm; margin-bottom: 1mm; }
            .itemRowWrapper { margin-bottom: 1.5mm; padding-bottom: 0.8mm; border-bottom: 0.1pt solid #ddd; }
            .itemMainLine { display: flex; justify-content: space-between; font-weight: 700; }
            .itemDetailLine { display: flex; gap: 2mm; font-size: 7pt; font-style: italic; margin-top: 0.2mm; }
            .giftLabel { font-weight: 900; background: black; color: white; padding: 0 1mm; font-size: 7pt; }
            .totalsBox { border-top: 0.5pt solid black; padding-top: 1mm; margin-top: 1mm; }
            .totalLine { display: flex; justify-content: space-between; margin-bottom: 0.5mm; }
            .totalLineLarge { display: flex; justify-content: space-between; margin-top: 1.5mm; font-size: 10pt; font-weight: 950; border-top: 1pt solid black; padding-top: 1mm; }
            .fidelityBox { text-align: center; margin: 3mm 0; border: 0.5pt solid black; padding: 1mm; font-weight: 800; font-size: 8.5pt; }
            .ticketFooter { text-align: center; margin-top: 4mm; font-size: 7.5pt; line-height: 1.2; }
            .thankYou { font-weight: 900; font-size: 8.5pt; margin-bottom: 1mm; }
            .validez { font-size: 7pt; opacity: 0.8; }
        `;
        doc.open(); doc.write('<html><head><style>' + css + '</style></head><body>'); doc.write(ticketContent.innerHTML); doc.write('</body></html>'); doc.close();
        iframe.contentWindow.focus();
        setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000) }, 500);
    };

    return (
        <div className={styles.container}>
            <div className={styles.productsSection}>
                <header className={styles.header}>
                    <h2 className={styles.title}>Tienda <span className={styles.highlight}>Fusion</span></h2>
                    <p className={styles.subtitle}>Suministros corporativos y productos exclusivos.</p>
                </header>

                <div className={`${styles.filterBar} glass`}>
                    <div className={styles.branchBox}>
                        <label className={styles.inputLabel}>Punto de Venta</label>
                        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="input">
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className={styles.searchBox}>
                        <label className={styles.inputLabel}>Buscar Productos</label>
                        <div className={styles.searchInputWrapper}>
                            <Search className={styles.searchIcon} size={18} />
                            <input type="text" placeholder="Buscar..." className={`input ${styles.searchInput}`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className={styles.productGrid}>
                    {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
                        <div key={product.id} className={styles.productCard}>
                            <div className={styles.imageContainer}>
                                {product.image_url ? <img src={product.image_url} alt={product.name} className={styles.image} /> : <Package className={styles.placeholderIcon} size={64} />}
                            </div>
                            <div className={styles.infoBox}>
                                <h4 className={styles.productName}>{product.name}</h4>
                                <div className={styles.priceRow}>
                                    <div className={styles.price}>{formatCurrency(product.price)}</div>
                                    <div className={styles.pvBadge}>{product.pv_points} PV</div>
                                </div>
                                <div className={`${styles.stock} ${product.stock < 10 ? styles.stockLow : styles.stockNormal}`}>{product.stock} unidades</div>
                                <button className={styles.addButton} onClick={() => addToCart(product)}><Plus size={18} /> Añadir</button>
                            </div>
                        </div>
                    ))}
                </div>

                <button className={styles.mobileToggle} onClick={() => setShowCart(true)}>
                    <ShoppingCart size={24} />
                    <span>Carrito</span>
                    {cart.length > 0 && (
                        <span className={styles.cartBadge}>
                            {cart.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                    )}
                </button>
            </div>

            <div className={`${styles.cartContainer} ${showCart ? styles.cartContainerOpen : ''}`}>
                <div className={styles.cartCard}>
                    <div className={styles.cartHeader}>
                        <div className={styles.cartTitleBox}><ShoppingCart size={24} /><h3 className={styles.cartTitle}>Venta Actual</h3></div>
                        <button className={styles.closeCart} onClick={() => setShowCart(false)}><X size={24} /></button>
                    </div>

                    <div className={styles.customerSection}>
                        <label className={styles.inputLabel}>Cliente</label>
                        {!selectedCustomer ? (
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder={profile?.role === 'afiliado' ? "Cargando cliente..." : "Buscar cliente..."}
                                    value={customerSearch}
                                    onChange={e => searchCustomers(e.target.value)}
                                    disabled={profile?.role === 'afiliado'}
                                />
                                {customers.length > 0 && (
                                    <div className={styles.searchResults}>
                                        {customers.map(c => (
                                            <div key={c.id} onClick={() => setSelectedCustomer(c)} className={styles.searchItem}>
                                                <div>{c.full_name}</div><div style={{ fontSize: '0.7rem', opacity: 0.6 }}>ID: {c.document_id}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.selectedCustomer}>
                                <div className={styles.customerInfo}>
                                    <div>{selectedCustomer.full_name}</div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>#{selectedCustomer.document_id}</div>
                                    {(selectedCustomer.free_products_count > 0) && (
                                        <div style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                            <Package size={12} /> {selectedCustomer.free_products_count} Regalos Disponibles
                                        </div>
                                    )}
                                </div>
                                {profile?.role !== 'afiliado' && (
                                    <button onClick={() => setSelectedCustomer(null)}><X size={16} /></button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.cartItems}>
                        {cart.length === 0 ? (
                            <p className={styles.emptyCart}>Carrito vacío</p>
                        ) : (
                            cart.map(item => (
                                <div key={`${item.id}-${item.isGift}`} className={styles.cartItem}>
                                    <div className={styles.itemMain}>
                                        <div className={styles.itemName}>
                                            {item.name}
                                            {item.isGift && <span className={styles.giftLabel}>REGALO</span>}
                                        </div>
                                        <div className={styles.itemMeta}>
                                            {item.isGift ? '0.00 Bs' : formatCurrency(item.price)} • {item.isGift ? '0' : item.pv_points} PV
                                        </div>
                                    </div>
                                    <div className={styles.qtyControls}>
                                        <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.isGift, -1)}>
                                            <Minus size={14} />
                                        </button>
                                        <span className={styles.qtyValue}>{item.quantity}</span>
                                        <button className={styles.qtyBtn} onClick={() => updateQuantity(item.id, item.isGift, 1)}>
                                            <Plus size={14} />
                                        </button>
                                        <button className={styles.deleteBtn} onClick={() => removeFromCart(item.id, item.isGift)}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.cartFooter}>
                        <div className={styles.totalRow}><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
                        <button
                            className={styles.checkoutBtn}
                            disabled={loading || cart.length === 0 || (!selectedCustomer && !['admin', 'sucursal', 'cajero'].includes(profile?.role))}
                            onClick={handleCheckout}
                        >
                            {['admin', 'sucursal', 'cajero'].includes(profile?.role) && !selectedCustomer ? 'Venta Anónima' : 'Finalizar Venta'}
                        </button>
                    </div>
                </div>
            </div>

            {success && <div className={styles.successToast}><CheckCircle size={24} /><span>{success}</span></div>}

            {lastSale && (
                <div className={`${styles.modalOverlay} ${styles['print-modal-visible']}`}>
                    <div className={styles.ticketModal}>
                        <CheckCircle size={48} color="#10b981" />
                        <h2>¡Venta Exitosa!</h2>
                        <div className={styles.buttonGroup}>
                            <button onClick={handlePrint} className={styles.printBtn}><Printer size={20} /> Imprimir Ticket</button>
                            <button onClick={() => setLastSale(null)} className={styles.closeModalBtn}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'none' }}>
                {lastSale && <Ticket saleData={lastSale} branchName={profile?.branch_name} sellerName={profile?.full_name} />}
            </div>
        </div>
    )
}
