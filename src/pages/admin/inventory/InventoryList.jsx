
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Minus, Search, Package, Store, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import styles from './InventoryList.module.css'

export default function InventoryList() {
    const [branches, setBranches] = useState([])
    const [selectedBranch, setSelectedBranch] = useState('')
    const [inventory, setInventory] = useState([])
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Modal state for stock adjustment
    const [showModal, setShowModal] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [adjustment, setAdjustment] = useState(0)

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (selectedBranch) {
            fetchInventory()
        }
    }, [selectedBranch])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const [branchesRes, productsRes] = await Promise.all([
                supabase.from('sucursales').select('*').eq('status', 'activo'),
                supabase.from('products').select('*').eq('status', 'activo')
            ])

            setBranches(branchesRes.data || [])
            setProducts(productsRes.data || [])

            if (branchesRes.data?.length > 0) {
                setSelectedBranch(branchesRes.data[0].id)
            }
        } catch (err) {
            console.error("Error al cargar datos iniciales:", err)
        } finally {
            setLoading(false)
        }
    }

    const fetchInventory = async () => {
        try {
            const { data } = await supabase
                .from('inventory')
                .select('*')
                .eq('branch_id', selectedBranch)
            setInventory(data || [])
        } catch (err) {
            console.error("Error al cargar inventario:", err)
        }
    }

    const handleAdjustStock = (product) => {
        const currentStock = inventory.find(i => i.product_id === product.id)?.stock || 0
        setSelectedItem({ ...product, currentStock })
        setAdjustment(0)
        setShowModal(true)
    }

    const saveAdjustment = async () => {
        if (!selectedItem || isUpdating) return
        setIsUpdating(true)

        const newStock = Math.max(0, selectedItem.currentStock + adjustment)

        try {
            const { error } = await supabase
                .from('inventory')
                .upsert({
                    branch_id: selectedBranch,
                    product_id: selectedItem.id,
                    stock: newStock,
                    updated_at: new Date()
                }, { onConflict: 'branch_id,product_id' })

            if (error) throw error

            await fetchInventory()
            setShowModal(false)
        } catch (err) {
            alert("Error al actualizar stock: " + err.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>
                    Control de <span className={styles.highlight}>Inventario</span>
                </h1>
                <p className={styles.subtitle}>Supervisión y ajuste de stock en tiempo real por sucursal corporal.</p>
            </header>

            <div className={`${styles.filterBar} glass`}>
                <div className={styles.filterGroup}>
                    <label className={styles.label}>Punto de Venta</label>
                    <div className={styles.inputWrapper}>
                        <Store className={styles.inputIcon} size={18} />
                        <select
                            className={`input ${styles.selectField}`}
                            style={{ fontWeight: '700' }}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className={styles.searchGroup}>
                    <label className={styles.label}>Buscar Producto</label>
                    <div className={styles.inputWrapper}>
                        <Search className={styles.inputIcon} size={18} />
                        <input
                            type="text"
                            placeholder="Nombre del producto..."
                            className={`input ${styles.inputField}`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Producto', 'Categoría', 'Precio Lista', 'Puntos (PV)', 'Stock Disponible', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : filteredProducts.map(product => {
                        const item = inventory.find(i => i.product_id === product.id)
                        const stock = item?.stock || 0
                        const isLow = stock <= 5

                        return (
                            <tr key={product.id} className={styles.tr}>
                                <td className={styles.td}>
                                    <div className={styles.productCell}>
                                        <div className={styles.productIcon}>
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className={styles.productImage} />
                                            ) : (
                                                <Package size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <div className={styles.productName}>{product.name}</div>
                                            <div className={styles.category}>{product.category || 'Sin categoría'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <span style={{ fontWeight: '700', color: 'white' }}>{product.price} Bs</span>
                                </td>
                                <td className={styles.td}>
                                    <span style={{ fontWeight: '800', color: 'var(--primary-light)' }}>{product.pv_points} PV</span>
                                </td>
                                <td className={styles.td}>
                                    <div className={`${styles.stockBadge} ${isLow ? styles.stockLow : styles.stockHigh}`}>
                                        {isLow ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                                        {stock} unidades
                                    </div>
                                </td>
                                <td className={styles.td}>
                                    <button
                                        className={`button btn-secondary ${styles.adjustButton}`}
                                        onClick={() => handleAdjustStock(product)}
                                    >
                                        Ajustar Stock
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </Table>
                {!loading && filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <Package size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No se encontraron productos en esta sucursal.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`Ajustar Inventario: ${selectedItem?.name}`}
            >
                <div className={styles.adjustPanel}>
                    <div className={styles.stockOverview}>
                        <div className={styles.overviewLabel}>Proyección de Stock</div>
                        <div className={styles.overviewValue} style={{ color: AdjustmentColor(adjustment, selectedItem?.currentStock) }}>
                            {selectedItem?.currentStock + adjustment}
                        </div>
                        <div className={styles.overviewSubtext}>
                            {adjustment !== 0 ? (
                                <>Base: {selectedItem?.currentStock} <span style={{ opacity: 0.5 }}>→</span> {adjustment > 0 ? '+' : ''}{adjustment}</>
                            ) : (
                                'Sin cambios pendientes'
                            )}
                        </div>
                    </div>

                    <div className={styles.controlsRow}>
                        <button
                            className={styles.circleBtn}
                            onClick={() => setAdjustment(prev => prev - 1)}
                            title="Disminuir"
                        >
                            <Minus size={24} />
                        </button>

                        <div className={styles.manualInputBox}>
                            <label className={styles.label}>Variación</label>
                            <input
                                type="number"
                                className={`input ${styles.manualInput}`}
                                value={adjustment}
                                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <button
                            className={styles.circleBtn}
                            onClick={() => setAdjustment(prev => prev + 1)}
                            title="Aumentar"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    <div className={styles.actionsRow}>
                        <button
                            className={`button btn-secondary ${styles.cancelBtn}`}
                            onClick={() => setShowModal(false)}
                        >
                            Cancelar
                        </button>
                        <button
                            className={`button ${styles.saveBtn}`}
                            onClick={saveAdjustment}
                            disabled={isUpdating}
                        >
                            {isUpdating ? (
                                <Loader2 className="spinner-small" size={20} />
                            ) : (
                                <><Save size={20} /> Guardar Cambios</>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function AdjustmentColor(adj, current) {
    const total = current + adj
    if (total <= 0) return '#f87171' // Red
    if (total < 5) return '#facc15' // Yellow
    return '#10b981' // Green
}
