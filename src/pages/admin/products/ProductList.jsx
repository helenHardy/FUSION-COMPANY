
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Table from '../../../components/ui/Table'
import Badge from '../../../components/ui/Badge'
import Modal from '../../../components/ui/Modal'
import { Plus, Edit2, Trash2, Package, Tag, Calculator, Info, Loader2, Sparkles } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils'
import styles from './ProductList.module.css'

export default function ProductList() {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({ name: '', description: '', price: 0, pv_points: 0, status: 'activo' })
    const [editingId, setEditingId] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)

    useEffect(() => {
        fetchProducts()
    }, [])

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setProducts(data)
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setImagePreview(reader.result)
            }
            reader.readAsDataURL(file)
        }
    }

    const uploadImage = async () => {
        if (!imageFile) return formData.image_url

        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError, data } = await supabase.storage
            .from('products')
            .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(filePath)

        return publicUrl
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            setSubmitting(true)

            // Step 1: Upload image if exists
            let imageUrl = formData.image_url
            try {
                imageUrl = await uploadImage()
            } catch (error) {
                console.error('Storage error:', error)
                alert('Error al subir la imagen. Asegúrate de que el bucket "products" exista.')
                setSubmitting(false)
                return
            }

            const payload = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                pv_points: parseFloat(formData.pv_points),
                status: formData.status,
                image_url: imageUrl
            }

            let error
            if (editingId) {
                ({ error } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', editingId))
            } else {
                ({ error } = await supabase
                    .from('products')
                    .insert([payload]))
            }

            if (error) throw error

            setIsModalOpen(false)
            fetchProducts()
            resetForm()
        } catch (error) {
            console.error('Error saving product:', error)
            alert('Error al guardar el producto')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (product) => {
        setFormData({
            name: product.name,
            description: product.description || '',
            price: product.price,
            pv_points: product.pv_points,
            status: product.status,
            image_url: product.image_url || ''
        })
        setImagePreview(product.image_url || null)
        setEditingId(product.id)
        setIsModalOpen(true)
    }

    const resetForm = () => {
        setFormData({ name: '', description: '', price: 0, pv_points: 0, status: 'activo', image_url: '' })
        setImageFile(null)
        setImagePreview(null)
        setEditingId(null)
    }

    const handleDelete = async (product) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar el producto "${product.name}"? Esta acción borrará también el stock asociado en todas las sucursales.`)) return

        try {
            // Primero borramos el inventario asociado (por FK)
            await supabase
                .from('inventory')
                .delete()
                .eq('product_id', product.id)

            // Luego borramos el producto
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id)

            if (error) throw error

            fetchProducts()
        } catch (error) {
            console.error('Error deleting product:', error)
            alert('Error al eliminar el producto: ' + error.message)
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        Catálogo de <span className={styles.highlight}>Productos</span>
                    </h1>
                    <p className={styles.subtitle}>Gestión centralizada del inventario y puntos de carrera.</p>
                </div>
                <button
                    className={`button ${styles.addButton}`}
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                >
                    <Plus size={20} />
                    Nuevo Producto
                </button>
            </header>

            <div className={`${styles.tableCard} glass`}>
                <Table headers={['Producto', 'Precio Unitario', 'Puntos (PV)', 'Estado', 'Acciones']}>
                    {loading ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                <Loader2 className="spinner" size={40} />
                            </td>
                        </tr>
                    ) : products.map((product) => (
                        <tr key={product.id} className={styles.tr}>
                            <td className={styles.td}>
                                <div className={styles.productCell}>
                                    <div className={styles.productIcon}>
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className={styles.productThumbnail} />
                                        ) : (
                                            <Package size={20} />
                                        )}
                                    </div>
                                    <div>
                                        <div className={styles.productName}>{product.name}</div>
                                        <div className={styles.productDesc} title={product.description}>
                                            {product.description || 'Sin descripción'}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <span className={styles.price}>{formatCurrency(product.price)}</span>
                            </td>
                            <td className={styles.td}>
                                <div className={styles.pointsWrapper}>
                                    <Sparkles size={14} color="#10b981" />
                                    <span className={styles.points}>{product.pv_points} PV</span>
                                </div>
                            </td>
                            <td className={styles.td}>
                                <Badge status={product.status} />
                            </td>
                            <td className={styles.td}>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => handleEdit(product)}
                                        className={styles.editButton}
                                        title="Editar producto"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product)}
                                        className={styles.deleteButton}
                                        title="Eliminar producto"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
                {!loading && products.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                        <Package size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No hay productos registrados en el catálogo.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Editar Producto' : 'Nuevo Producto'}
            >
                <form onSubmit={handleSubmit}>
                    <div className={styles.imageUploadSection}>
                        <div className={styles.imagePreviewWrapper}>
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className={styles.imagePreview} />
                            ) : (
                                <div className={styles.imagePlaceholder}>
                                    <Plus size={32} />
                                    <span>Imagen</span>
                                </div>
                            )}
                        </div>
                        <div className={styles.fileInputWrapper}>
                            <div className={styles.fileInputLabel}>
                                <Plus size={18} /> Seleccionar Imagen
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className={styles.fileInput}
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Nombre del Producto</label>
                        <div style={{ position: 'relative' }}>
                            <Tag style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={18} />
                            <input
                                className="input"
                                style={{ paddingLeft: '44px' }}
                                placeholder="Ej: Suplemento Vitamínico"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Descripción Detallada</label>
                        <textarea
                            className="input"
                            placeholder="Describe las características del producto..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows="3"
                        />
                    </div>

                    <div className={styles.row}>
                        <div className={`${styles.formGroup} ${styles.col}`}>
                            <label className={styles.label}>Precio (Bs)</label>
                            <div style={{ position: 'relative' }}>
                                <Calculator style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={18} />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    style={{ paddingLeft: '44px' }}
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className={`${styles.formGroup} ${styles.col}`}>
                            <label className={styles.label}>Puntos (PV)</label>
                            <div style={{ position: 'relative' }}>
                                <Sparkles style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={18} />
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input"
                                    style={{ paddingLeft: '44px' }}
                                    value={formData.pv_points}
                                    onChange={e => setFormData({ ...formData, pv_points: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginBottom: '2.5rem' }}>
                        <label className={styles.label}>Visibilidad en Catálogo</label>
                        <div style={{ position: 'relative' }}>
                            <Info style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dim)' }} size={18} />
                            <select
                                className="input"
                                style={{ paddingLeft: '44px', fontWeight: '700' }}
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="activo">Activo (Visible)</option>
                                <option value="inactivo">Inactivo (Oculto)</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" className={`button ${styles.submitButton}`} disabled={submitting}>
                        {submitting ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                <Loader2 className="spinner-small" size={20} />
                                Guardando Producto...
                            </div>
                        ) : (
                            <>{editingId ? 'Actualizar Cambios' : 'Registrar Producto'}</>
                        )}
                    </button>
                </form>
            </Modal>
        </div>
    )
}
