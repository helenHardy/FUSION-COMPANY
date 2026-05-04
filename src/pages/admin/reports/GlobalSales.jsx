
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { BarChart3, ShoppingBag, Users, Zap, Calendar, TrendingUp, Wallet, ArrowDownCircle, Info, Filter, Download, RefreshCw, Target, PieChart, Loader2, Eye, Star, Store, Printer, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '../../../lib/utils'
import Table from '../../../components/ui/Table'
import Modal from '../../../components/ui/Modal'
import { Ticket } from '../../shop/Ticket'
import styles from './GlobalSales.module.css'

export default function GlobalSales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)

    // Filters
    const [branches, setBranches] = useState([])
    const [selectedBranch, setSelectedBranch] = useState('all')
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString())

    const [productsRanking, setProductsRanking] = useState([])
    const [bestSeller, setBestSeller] = useState(null)

    // Details Modal
    const [selectedSale, setSelectedSale] = useState(null)
    const [saleDetails, setSaleDetails] = useState([])
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [printFormat, setPrintFormat] = useState('thermal')
    const [isModalOpen, setIsModalOpen] = useState(false)

    const thermalCSS = `
        @page { size: 58mm auto; margin: 0; }
        body { margin: 0; padding: 2mm 2mm 2mm 4mm; width: 58mm; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; background: white; color: black; }
        .ticketContainer { width: 100%; margin: 0; }
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

    const { profile } = useAuth()
    const isAdmin = profile?.role === 'admin'

    useEffect(() => {
        fetchBranches()
    }, [])

    useEffect(() => {
        fetchData()
    }, [selectedBranch, selectedYear, selectedMonth, selectedDay])

    const fetchBranches = async () => {
        if (!isAdmin) return
        const { data } = await supabase.from('sucursales').select('*').order('name')
        if (data) setBranches(data)
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('sales')
                .select('*, profiles(full_name), sucursales(name)')
                .order('created_at', { ascending: false })

            // 1. Apply Branch Filter
            if (isAdmin) { // Admins can filter
                if (selectedBranch !== 'all') {
                    query = query.eq('branch_id', selectedBranch)
                }
            } else { // Non-admins are locked to their branch
                const { data: branch } = await supabase
                    .from('sucursales')
                    .select('id')
                    .eq('manager_id', profile.id)
                    .maybeSingle()

                if (branch) {
                    query = query.eq('branch_id', branch.id)
                } else {
                    setSales([])
                    setLoading(false)
                    return
                }
            }

            // 2. Apply Date Filters
            let startDate, endDate

            // Create dates in local time (browser timezone)
            const year = parseInt(selectedYear)
            const month = parseInt(selectedMonth) - 1 // JS months are 0-indexed

            if (selectedDay !== 'all') {
                // Specific Day in Local Time
                const day = parseInt(selectedDay)
                const start = new Date(year, month, day, 0, 0, 0) // Local start of day
                const end = new Date(year, month, day, 23, 59, 59, 999) // Local end of day

                startDate = start.toISOString()
                endDate = end.toISOString()
            } else {
                // Whole Month in Local Time
                const start = new Date(year, month, 1, 0, 0, 0)
                const end = new Date(year, month + 1, 0, 23, 59, 59, 999) // Last day of month

                startDate = start.toISOString()
                endDate = end.toISOString()
            }

            query = query.gte('created_at', startDate).lte('created_at', endDate)

            const { data: fetchedSales, error } = await query

            if (error) throw error

            setSales(fetchedSales || [])

            // 3. Process Stats Locally
            if (fetchedSales) {
                const totalRevenue = fetchedSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
                const totalPV = fetchedSales.reduce((sum, s) => sum + (Number(s.total_pv) || 0), 0)
                
                const t1Revenue = fetchedSales.filter(s => s.shift_number === 1).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
                const t2Revenue = fetchedSales.filter(s => s.shift_number === 2).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)

                setStats({
                    revenue: totalRevenue,
                    orders: fetchedSales.length,
                    pv: totalPV,
                    t1Revenue,
                    t2Revenue
                })

                // 4. Process Product Breakdown
                const saleIds = fetchedSales.map(s => s.id)
                if (saleIds.length > 0) {
                    const { data: items } = await supabase
                        .from('sale_items')
                        .select('quantity, products(name)')
                        .in('sale_id', saleIds)

                    if (items) {
                        const productMap = {}
                        items.forEach(item => {
                            const name = item.products?.name || 'Producto Eliminado'
                            productMap[name] = (productMap[name] || 0) + item.quantity
                        })

                        const ranked = Object.entries(productMap)
                            .map(([name, qty]) => ({ name, qty }))
                            .sort((a, b) => b.qty - a.qty)

                        setProductsRanking(ranked)
                        setBestSeller(ranked[0] || null)
                    }
                } else {
                    setProductsRanking([])
                    setBestSeller(null)
                }
            }

        } catch (err) {
            console.error("Error fetching report:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleViewDetails = async (sale) => {
        setSelectedSale(sale)
        setIsModalOpen(true)
        setDetailsLoading(true)
        try {
            const { data } = await supabase
                .from('sale_items')
                .select('*, products(name)')
                .eq('sale_id', sale.id)
            if (data) setSaleDetails(data)
        } catch (error) {
            console.error(error)
        } finally {
            setDetailsLoading(false)
        }
    }

    const handlePrint = async (order) => {
        try {
            let items = []
            if (selectedSale && selectedSale.id === order.id && saleDetails.length > 0) {
                items = saleDetails
            } else {
                const { data, error } = await supabase
                    .from('sale_items')
                    .select('*, products(name)')
                    .eq('sale_id', order.id)
                if (error) throw error
                items = data
            }

            // Actualizar estados para que el Ticket oculto tenga la data
            setSelectedSale(order)
            setSaleDetails(items)

            // Esperar un breve momento para que React renderice el Ticket oculto
            setTimeout(() => {
                const ticketElement = document.getElementById('printable-ticket-globalsales');
                if (!ticketElement) {
                    console.error("No se encontró el elemento ticketElement");
                    return;
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
                        // No limpiamos selectedSale aquí para no romper el modal si estaba abierto
                    }, 1000);
                }, 500);
            }, 100);

        } catch (err) {
            console.error("Error al imprimir:", err)
            alert("Error al obtener detalles para impresión")
        }
    }

    const years = [2024, 2025, 2026]
    const months = Array.from({ length: 12 }, (_, i) => i + 1)
    const days = Array.from({ length: 31 }, (_, i) => i + 1)

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Reporte <span className={styles.highlight}>Comercial</span></h1>
                    <p className={styles.subtitle}>Análisis detallado de ventas por sucursal y periodo.</p>
                </div>
                <button className={styles.refreshBtn} onClick={fetchData}><RefreshCw size={20} /></button>
            </header>

            {/* Advanced Filters */}
            <div className={`${styles.filterBar} glass`}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}><Store size={14} /> Sucursal</label>
                    <select
                        className={styles.select}
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={!isAdmin}
                    >
                        <option value="all">Todas las Sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.dateFilters}>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Año</label>
                        <select className={styles.select} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Mes</label>
                        <select className={styles.select} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                            {months.map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Día</label>
                        <select className={styles.select} value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
                            <option value="all">Todo el Mes</option>
                            {days.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                <StatsBox
                    label="Ingresos Netos"
                    value={formatCurrency(stats?.revenue || 0)}
                    icon={<Wallet size={24} />}
                    color="#10b981"
                    description="Total facturado en periodo"
                />
                <StatsBox
                    label="Ventas Realizadas"
                    value={stats?.orders || 0}
                    icon={<ShoppingBag size={24} />}
                    color="#6366f1"
                    description="Transacciones completadas"
                />
                <StatsBox
                    label="Producto Top"
                    value={bestSeller?.name || '---'}
                    icon={<Star size={24} />}
                    color="#f59e0b"
                    description={bestSeller ? `${bestSeller.qty} unidades` : 'Sin datos'}
                />
            </div>

            <div className={styles.contentGrid}>
                {/* Product Breakdown */}
                <div className={`${styles.card} glass`}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}><ShoppingBag size={18} /> Productos Vendidos</h3>
                    </header>
                    <div className={styles.productList}>
                        <div className={styles.tableHeaderRow}>
                            <span>Producto</span>
                            <span>Cant.</span>
                        </div>
                        <div className={styles.tableBody}>
                            {productsRanking.length > 0 ? productsRanking.map((p, i) => (
                                <div key={i} className={styles.productRow}>
                                    <span className={styles.prodName}>{p.name}</span>
                                    <span className={styles.prodQty}>{p.qty}</span>
                                </div>
                            )) : (
                                <div className={styles.emptyState}>No hay productos vendidos en este periodo.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sales History */}
                <div className={`${styles.card} glass`} style={{ flex: 2 }}>
                    <header className={styles.cardHeader}>
                        <h3 className={styles.cardTitle}><Calendar size={18} /> Historial de Ventas</h3>
                        <div className={styles.shiftSummary}>
                            <div className={styles.shiftMiniBox}>
                                <span className={styles.shiftMiniLabel}>Turno 1</span>
                                <span className={styles.shiftMiniValue}>{formatCurrency(stats?.t1Revenue || 0)}</span>
                            </div>
                            <div className={styles.shiftMiniBox}>
                                <span className={styles.shiftMiniLabel}>Turno 2</span>
                                <span className={styles.shiftMiniValue}>{formatCurrency(stats?.t2Revenue || 0)}</span>
                            </div>
                        </div>
                    </header>
                    <div className={styles.tableContainer}>
                        <table className={styles.historyTable}>
                            <thead>
                                <tr>
                                    <th>Ticket</th>
                                    <th>Turno</th>
                                    <th>Fecha</th>
                                    <th>Vendedor</th>
                                    {isAdmin && <th>Sucursal</th>}
                                    <th>Total</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5" className="text-center p-4"><Loader2 className="spinner" /></td></tr>
                                ) : sales.map(sale => (
                                    <tr key={sale.id}>
                                        <td style={{ fontWeight: 600, color: '#6366f1' }}>{sale.ticket_number ? sale.ticket_number.toString().padStart(4, '0') : '---'}</td>
                                        <td><span className={sale.shift_number === 1 ? styles.t1Badge : styles.t2Badge}>T{sale.shift_number || 1}</span></td>
                                        <td>{formatDate(sale.created_at)}</td>
                                        <td>{sale.profiles?.full_name || 'Desconocido'}</td>
                                        {isAdmin && <td>{sale.sucursales?.name}</td>}
                                        <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(sale.total_amount)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className={styles.iconBtn} onClick={() => handleViewDetails(sale)} title="Ver Detalles">
                                                    <Eye size={16} />
                                                </button>
                                                <button className={styles.iconBtn} onClick={() => handlePrint(sale)} style={{ color: '#6366f1' }} title="Imprimir Comprobante">
                                                    <Printer size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && sales.length === 0 && (
                                    <tr><td colSpan="5" className={styles.emptyTable}>Sin registros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedSale(null); }} title="Detalle de Venta">
                {selectedSale && (
                    <div className={styles.detailsContent}>
                        <div className={styles.detailHeader}>
                            <div><strong>ID Venta:</strong> #{selectedSale.id.slice(0, 8)}</div>
                            <div><strong>Total:</strong> {formatCurrency(selectedSale.total_amount)}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '8px' }}>
                            <select
                                value={printFormat}
                                onChange={(e) => setPrintFormat(e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                            >
                                <option value="thermal">Ticket Térmico (58mm)</option>
                                <option value="letter">Hoja Carta Normal</option>
                            </select>
                            <button
                                onClick={() => handlePrint(selectedSale)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#6366f1', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                            >
                                <Printer size={16} /> Imprimir Comprobante
                            </button>
                        </div>

                        <div className={styles.detailItems}>
                            {detailsLoading ? <Loader2 className="spinner" /> : saleDetails.map((item, i) => (
                                <div key={i} className={styles.detailItem}>
                                    <span>{item.products?.name} <span className={styles.qtyBadge}>x{item.quantity}</span></span>
                                    <span>{formatCurrency(item.price_at_sale * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Hidden Ticket for Printing */}
            <div style={{ display: 'none' }}>
                <div id="printable-ticket-globalsales">
                    <Ticket
                        saleData={selectedSale ? {
                            items: saleDetails.map(i => ({
                                quantity: i.quantity,
                                name: i.products?.name,
                                price: i.price_at_sale,
                                isGift: i.price_at_sale === 0
                            })),
                            total: selectedSale.total_amount,
                            totalPV: selectedSale.total_pv,
                            date: selectedSale.created_at,
                            customer: {
                                full_name: selectedSale.profiles?.full_name,
                                document_id: selectedSale.profiles?.document_id
                            },
                            ticket_number: selectedSale.ticket_number
                        } : null}
                        branchName={selectedSale?.sucursales?.name || 'CENTRAL'}
                        sellerName={selectedSale?.profiles?.full_name || 'VENDEDOR'}
                        format={printFormat}
                    />
                </div>
            </div>
        </div>
    )
}

function StatsBox({ label, value, icon, color, description }) {
    return (
        <div className={`${styles.statsBox} glass`}>
            <div>
                <div className={styles.statsLabel}>{label}</div>
                <div className={styles.statsValue}>{value}</div>
                <div className={styles.statsDesc}>{description}</div>
            </div>
            <div className={styles.statsIcon} style={{ background: `${color}15`, color: color, border: `1px solid ${color}25` }}>
                {icon}
            </div>
        </div>
    )
}
