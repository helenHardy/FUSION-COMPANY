-- ========================================================
-- FUNCIÓN PARA ELIMINAR PEDIDOS DE FORMA SEGURA
-- ========================================================

CREATE OR REPLACE FUNCTION public.delete_order_safely(p_sale_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Eliminar los items del pedido (sale_items)
    -- Es una relación fuerte y debe borrarse primero si no hay CASCADE
    DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

    -- 2. Eliminar comisiones si existieran (preventivo)
    DELETE FROM public.commissions WHERE source_sale_id = p_sale_id;

    -- 3. Eliminar la cabecera del pedido (sales)
    DELETE FROM public.sales WHERE id = p_sale_id;

    RAISE NOTICE 'Pedido eliminado correctamente.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
