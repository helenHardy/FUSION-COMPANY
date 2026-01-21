
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

    -- Nota: Al marcar como completada, se deberían disparar los procesos
    -- habituales de distribución de comisiones (si existen triggers previos).
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
