
-- CONSOLIDACIÓN DE COLUMNAS DE REGALOS
-- Había una duplicidad entre gift_balance y free_products_count. 
-- Nos quedamos con free_products_count ya que es la que usa el registro.

-- 1. Migrar cualquier dato de gift_balance a free_products_count si es mayor
UPDATE public.profiles 
SET free_products_count = GREATEST(COALESCE(free_products_count, 0), COALESCE(gift_balance, 0));

-- 2. Eliminar la columna duplicada para evitar confusiones futuras
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS gift_balance;

-- 3. Actualizar la función approve_order para usar definitivamente free_products_count
CREATE OR REPLACE FUNCTION public.approve_order(
    p_sale_id UUID,
    p_approver_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_branch_id UUID;
    v_total_pv INTEGER;
    v_item RECORD;
    v_gift_count INTEGER := 0;
BEGIN
    -- Obtener info de la venta
    SELECT user_id, branch_id, total_pv INTO v_user_id, v_branch_id, v_total_pv
    FROM public.sales WHERE id = p_sale_id;

    -- Verificar si ya está completada
    IF EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND status = 'completado') THEN
        RAISE EXCEPTION 'Este pedido ya ha sido aprobado anteriormente.';
    END IF;

    -- 1. Descontar stock del inventario de la sucursal correspondiente
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        UPDATE public.inventory 
        SET stock = stock - v_item.quantity
        WHERE branch_id = v_branch_id AND product_id = v_item.product_id;
        
        -- Contar productos de regalo
        IF v_item.is_gift THEN
            v_gift_count := v_gift_count + v_item.quantity;
        END IF;
    END LOOP;

    -- 2. Descontar del balance de regalos del usuario si aplica
    IF v_gift_count > 0 THEN
        UPDATE public.profiles 
        SET free_products_count = free_products_count - v_gift_count
        WHERE id = v_user_id;
    END IF;

    -- 3. Marcar como completada y asignar el aprobador
    UPDATE public.sales 
    SET status = 'completado',
        seller_id = p_approver_id,
        updated_at = NOW()
    WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
