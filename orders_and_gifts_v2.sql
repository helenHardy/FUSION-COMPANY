
-- ACTUALIZACIÓN DE SCHEMA PARA SISTEMA DE PEDIDOS Y REGALOS

-- 1. Actualizar roles permitidos para incluir 'sucursal'
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'afiliado', 'sucursal'));

-- 2. Agregar balance de regalos a los perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gift_balance INTEGER DEFAULT 0;

-- 3. Agregar flag de regalo a los items de venta
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE;

-- 4. Actualizar estados de venta permitidos
ALTER TABLE public.sales 
DROP CONSTRAINT IF EXISTS sales_status_check;

ALTER TABLE public.sales 
ADD CONSTRAINT sales_status_check 
CHECK (status IN ('completado', 'cancelado', 'pendiente', 'rechazado'));

-- 4b. Agregar columnas faltantes a la tabla de ventas
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. Agregar manager_id a sucursales si no existe (para el rol sucursal)
ALTER TABLE public.sucursales 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

-- 6. Función para crear un pedido pendiente (desde el POS)
DROP FUNCTION IF EXISTS public.create_pending_order(uuid, uuid, uuid, jsonb, numeric, integer);
CREATE OR REPLACE FUNCTION public.create_pending_order(
    p_user_id UUID,
    p_branch_id UUID,
    p_seller_id UUID,
    p_items JSONB,
    p_total_amount DECIMAL,
    p_total_pv INTEGER
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item RECORD;
BEGIN
    -- Insertar la venta en estado 'pendiente'
    INSERT INTO public.sales (
        user_id,
        branch_id,
        seller_id,
        total_amount,
        total_pv,
        status,
        created_at
    ) VALUES (
        p_user_id,
        p_branch_id,
        p_seller_id,
        p_total_amount,
        p_total_pv,
        'pendiente',
        NOW()
    ) RETURNING id INTO v_sale_id;

    -- Insertar los items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        price_at_sale DECIMAL,
        pv_at_sale INTEGER,
        is_gift BOOLEAN
    ) LOOP
        INSERT INTO public.sale_items (
            sale_id,
            product_id,
            quantity,
            price_at_sale,
            pv_at_sale,
            is_gift
        ) VALUES (
            v_sale_id,
            v_item.product_id,
            v_item.quantity,
            v_item.price_at_sale,
            v_item.pv_at_sale,
            v_item.is_gift
        );
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función para aprobar un pedido (Ejecuta el descuento de stock y PV)
DROP FUNCTION IF EXISTS public.approve_order(uuid, uuid);
CREATE OR REPLACE FUNCTION public.approve_order(
    p_sale_id UUID,
    p_approver_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_branch_id UUID;
    v_total_pv NUMERIC := 0; -- Inicializar en 0
    v_item RECORD;
    v_gift_count INTEGER := 0;
    v_old_monthly_pv NUMERIC;
    v_sponsor_id UUID;
BEGIN
    -- Obtener info básica de la venta
    SELECT user_id, branch_id INTO v_user_id, v_branch_id
    FROM public.sales WHERE id = p_sale_id;

    -- Verificar si ya está completada
    IF EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND status = 'completado') THEN
        RAISE EXCEPTION 'Este pedido ya ha sido aprobado anteriormente.';
    END IF;

    -- 1. Descontar stock del inventario y RECALCULAR PV TOTAL
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        -- A. Descontar Stock
        UPDATE public.inventory 
        SET stock = stock - v_item.quantity
        WHERE branch_id = v_branch_id AND product_id = v_item.product_id;
        
        -- B. Sumar PV (Solo si no es regalo)
        IF NOT COALESCE(v_item.is_gift, FALSE) THEN
            v_total_pv := v_total_pv + (COALESCE(v_item.pv_at_sale, 0) * v_item.quantity);
        ELSE
            -- Contar productos de regalo
            v_gift_count := v_gift_count + v_item.quantity;
        END IF;
    END LOOP;

    -- 2. Descontar del balance de regalos del usuario si aplica
    IF v_gift_count > 0 THEN
        UPDATE public.profiles 
        SET free_products_count = GREATEST(0, COALESCE(free_products_count, 0) - v_gift_count)
        WHERE id = v_user_id;

        -- Compatibilidad con gift_balance si existe
        BEGIN
            UPDATE public.profiles 
            SET gift_balance = GREATEST(0, COALESCE(gift_balance, 0) - v_gift_count)
            WHERE id = v_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- 3. Marcar como completada, asignar el aprobador y ACTUALIZAR PV TOTAL en la venta
    UPDATE public.sales 
    SET status = 'completado',
        seller_id = p_approver_id,
        total_pv = v_total_pv, -- Guardamos el PV recalculado
        updated_at = NOW()
    WHERE id = p_sale_id;

    -- 4. SUMAR PV AL USUARIO Y DISTRIBUIR COMISIONES (Sincronizado con process_sale)
    IF v_total_pv > 0 AND v_user_id IS NOT NULL THEN
        -- A. Actualizar PV Personal y Mensual
        SELECT monthly_pv, sponsor_id INTO v_old_monthly_pv, v_sponsor_id 
        FROM public.profiles WHERE id = v_user_id;

        UPDATE public.profiles 
        SET monthly_pv = COALESCE(monthly_pv, 0) + v_total_pv,
            pv = COALESCE(pv, 0) + v_total_pv
        WHERE id = v_user_id;

        -- B. Verificar activación del patrocinador (umbral 100 PV)
        IF COALESCE(v_old_monthly_pv, 0) < 100 AND (COALESCE(v_old_monthly_pv, 0) + v_total_pv) >= 100 AND v_sponsor_id IS NOT NULL THEN
            UPDATE public.profiles 
            SET active_directs_count = COALESCE(active_directs_count, 0) + 1 
            WHERE id = v_sponsor_id;
        END IF;

        -- C. Escalar PVG en la red
        PERFORM public.distribute_pvg(v_user_id, v_total_pv);

        -- D. DISTRIBUIR REGALÍAS
        PERFORM public.distribute_royalties(v_user_id, v_total_pv);

        -- E. VERIFICAR ASCENSO DE RANGO
        PERFORM public.check_rank_promotion(v_user_id);
        
        IF v_sponsor_id IS NOT NULL THEN
            PERFORM public.check_rank_promotion(v_sponsor_id);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Políticas de RLS para la tabla de ventas (sales)
-- Asegurar que RLS esté activo
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Política para que administradores vean todo
DROP POLICY IF EXISTS "Admins ven todas las ventas" ON public.sales;
CREATE POLICY "Admins ven todas las ventas" ON public.sales
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Política para que usuarios de sucursal vean las ventas de su sucursal
DROP POLICY IF EXISTS "Sucursales ven sus ventas" ON public.sales;
CREATE POLICY "Sucursales ven sus ventas" ON public.sales
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sucursales 
            WHERE id = sales.branch_id AND manager_id = auth.uid()
        )
    );

-- Política para que cada usuario vea sus propias compras
DROP POLICY IF EXISTS "Usuarios ven sus propias compras" ON public.sales;
CREATE POLICY "Usuarios ven sus propias compras" ON public.sales
    FOR SELECT USING (user_id = auth.uid());
