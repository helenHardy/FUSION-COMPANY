-- 1. LIMPIEZA DE FUNCIONES PREVIAS (Para evitar conflictos de firma)
DROP FUNCTION IF EXISTS public.distribute_pvg(uuid, numeric);
DROP FUNCTION IF EXISTS public.distribute_royalties(uuid, numeric);
DROP FUNCTION IF EXISTS public.distribute_commissions(uuid, uuid);
DROP FUNCTION IF EXISTS public.process_sale(uuid, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.approve_order(uuid, uuid);

-- 2. RESTRICCIONES DE INTEGRIDAD
-- Asegurar que el Documento de Identidad sea único (Evita bucles y registros duplicados)
-- NOTA: Esto fallará si ya tienes duplicados; usa resolve_duplicates.sql primero si es necesario.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_document_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_document_id_key UNIQUE (document_id);

-- Asegurar que el stock no pueda ser negativo
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_stock_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_stock_check CHECK (stock >= 0);


-- 3. PROTECCIÓN CONTRA BUCLES INFINITOS (SAFETY DEPTH LIMITS)

-- A. Distribución de PVG (Deep Safety)
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_sponsor UUID;
  v_depth_limit INTEGER := 0; -- Contador de seguridad
BEGIN
  SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = p_start_user_id;

  WHILE v_current_sponsor IS NOT NULL AND v_depth_limit < 100 LOOP
    UPDATE public.profiles 
    SET pvg = pvg + p_points 
    WHERE id = v_current_sponsor;

    SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = v_current_sponsor;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
  
  -- Si llegamos a 100 niveles, probablemente hay un ciclo o la red es anormalmente profunda
  IF v_depth_limit >= 100 THEN
    RAISE WARNING 'Límite de profundidad alcanzado en distribute_pvg para el usuario %', p_start_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Distribución de Regalías (Deep Safety)
CREATE OR REPLACE FUNCTION public.distribute_royalties(
    p_buyer_id UUID,
    p_total_pv NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_upline_record RECORD;
    v_current_upline_id UUID;
    v_level INTEGER := 1;
    v_percentage NUMERIC;
    v_commission_amount NUMERIC;
    v_rank_record RECORD;
    v_depth_limit INTEGER := 0;
BEGIN
    SELECT sponsor_id INTO v_current_upline_id FROM public.profiles WHERE id = p_buyer_id;

    WHILE v_current_upline_id IS NOT NULL AND v_level <= 10 AND v_depth_limit < 100 LOOP
        SELECT * INTO v_upline_record FROM public.profiles WHERE id = v_current_upline_id;
        SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_upline_record.current_rank;

        IF public.check_monthly_qualification(v_current_upline_id) THEN
            v_percentage := (v_rank_record.royalties_config->>( 'N' || v_level ))::NUMERIC;

            IF v_percentage > 0 THEN
                v_commission_amount := (p_total_pv * v_percentage) / 100;

                INSERT INTO public.commissions (
                    beneficiary_id, source_user_id, amount, commission_type, level_depth
                ) VALUES (
                    v_current_upline_id, p_buyer_id, v_commission_amount, 'regalia', v_level
                );

                UPDATE public.profiles 
                SET total_earnings = total_earnings + v_commission_amount
                WHERE id = v_current_upline_id;
            END IF;
        END IF;

        v_current_upline_id := v_upline_record.sponsor_id;
        v_level := v_level + 1;
        v_depth_limit := v_depth_limit + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Distribución de Comisiones Rapid Start (Deep Safety)
CREATE OR REPLACE FUNCTION public.distribute_commissions(
  p_user_id UUID,
  p_combo_id UUID
) RETURNS VOID AS $$
DECLARE
  v_sponsor_id UUID;
  v_plan_id UUID;
  v_combo_price NUMERIC;
  v_config JSONB;
  v_level INTEGER := 1;
  v_percentage NUMERIC;
  v_amount NUMERIC;
  v_current_beneficiary UUID;
  v_depth_limit INTEGER := 0;
BEGIN
  SELECT price, plan_id INTO v_combo_price, v_plan_id FROM public.combos WHERE id = p_combo_id;
  SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 AND v_depth_limit < 100 LOOP
    v_percentage := (v_config->>v_level::text)::NUMERIC;

    IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
      v_amount := v_combo_price * (v_percentage / 100);

      INSERT INTO public.commissions (
        beneficiary_id, source_user_id, amount, commission_type, level_depth
      ) VALUES (
        v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level
      );

      UPDATE public.profiles 
      SET total_earnings = total_earnings + v_amount 
      WHERE id = v_current_beneficiary;
    END IF;

    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. MEJORA DE PROCESS_SALE (VERIFICACIÓN DE STOCK)

CREATE OR REPLACE FUNCTION public.process_sale(
  p_user_id UUID,
  p_branch_id UUID,
  p_seller_id UUID,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_total_amount NUMERIC := 0;
  v_total_pv NUMERIC := 0;
  v_old_monthly_pv NUMERIC;
  v_sponsor_id UUID;
  v_current_stock INTEGER;
BEGIN
  -- A. Crear el registro de la venta principal
  INSERT INTO public.sales (
    user_id, branch_id, total_amount, total_pv, status, created_at
  ) VALUES (
    p_user_id, p_branch_id, 0, 0, 'completado', NOW()
  ) RETURNING id INTO v_sale_id;

  -- B. Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID, 
    quantity INTEGER, 
    price NUMERIC, 
    pv NUMERIC,
    is_gift BOOLEAN
  ) LOOP
    
    -- 1. Verificar stock disponible explícitamente antes de intentar descuenta
    SELECT stock INTO v_current_stock 
    FROM public.inventory 
    WHERE branch_id = p_branch_id AND product_id = v_item.product_id;

    IF v_current_stock IS NULL OR v_current_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %. Disponible: %, Solicitado: %', 
        (SELECT name FROM public.products WHERE id = v_item.product_id), 
        COALESCE(v_current_stock, 0), 
        v_item.quantity;
    END IF;

    -- 2. Registrar el detalle
    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, price_at_sale, pv_at_sale, is_gift
    ) VALUES (
      v_sale_id, v_item.product_id, v_item.quantity, v_item.price, v_item.pv, COALESCE(v_item.is_gift, FALSE)
    );

    -- 3. Descontar Stock
    UPDATE public.inventory 
    SET stock = stock - v_item.quantity 
    WHERE branch_id = p_branch_id AND product_id = v_item.product_id;

    -- 4. Sumar totales
    v_total_amount := v_total_amount + (CASE WHEN v_item.is_gift THEN 0 ELSE v_item.price * v_item.quantity END);
    v_total_pv := v_total_pv + (CASE WHEN v_item.is_gift THEN 0 ELSE v_item.pv * v_item.quantity END);
    
    -- 5. Descontar del balance de regalos si aplica
    IF v_item.is_gift IS TRUE THEN
      UPDATE public.profiles 
      SET free_products_count = GREATEST(0, COALESCE(free_products_count, 0) - v_item.quantity)
      WHERE id = p_user_id;
    END IF;
  END LOOP;

  -- C. Actualizar los totales de la venta
  UPDATE public.sales 
  SET total_amount = v_total_amount, 
      total_pv = v_total_pv 
  WHERE id = v_sale_id;

  -- D. SUMAR PV Y DISTRIBUIR
  IF v_total_pv > 0 THEN
    SELECT monthly_pv, sponsor_id INTO v_old_monthly_pv, v_sponsor_id FROM public.profiles WHERE id = p_user_id;

    UPDATE public.profiles 
    SET monthly_pv = monthly_pv + v_total_pv,
        pv = pv + v_total_pv
    WHERE id = p_user_id;

    IF v_old_monthly_pv < 100 AND (v_old_monthly_pv + v_total_pv) >= 100 AND v_sponsor_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET active_directs_count = active_directs_count + 1 
        WHERE id = v_sponsor_id;
    END IF;

    PERFORM public.distribute_pvg(p_user_id, v_total_pv);
    PERFORM public.distribute_royalties(p_user_id, v_total_pv);
    PERFORM public.check_rank_promotion(p_user_id);
    IF v_sponsor_id IS NOT NULL THEN
        PERFORM public.check_rank_promotion(v_sponsor_id);
    END IF;
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. MEJORA DE APPROVE_ORDER (VERIFICACIÓN DE STOCK)

CREATE OR REPLACE FUNCTION public.approve_order(
    p_sale_id UUID,
    p_approver_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_branch_id UUID;
    v_total_pv NUMERIC := 0;
    v_item RECORD;
    v_gift_count INTEGER := 0;
    v_old_monthly_pv NUMERIC;
    v_sponsor_id UUID;
    v_current_stock INTEGER;
BEGIN
    -- Obtener info básica
    SELECT user_id, branch_id INTO v_user_id, v_branch_id
    FROM public.sales WHERE id = p_sale_id;

    -- Verificar si ya está completada
    IF EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND status = 'completado') THEN
        RAISE EXCEPTION 'Este pedido ya ha sido aprobado anteriormente.';
    END IF;

    -- 1. Descontar stock y Recalcular PV
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id LOOP
        
        -- A. Verificar stock disponible
        SELECT stock INTO v_current_stock 
        FROM public.inventory 
        WHERE branch_id = v_branch_id AND product_id = v_item.product_id;

        IF v_current_stock IS NULL OR v_current_stock < v_item.quantity THEN
          RAISE EXCEPTION 'Stock insuficiente para aprobar el pedido. Producto ID: %. Disponible: %, Requerido: %', 
            v_item.product_id, COALESCE(v_current_stock, 0), v_item.quantity;
        END IF;

        -- B. Descontar Stock
        UPDATE public.inventory 
        SET stock = stock - v_item.quantity
        WHERE branch_id = v_branch_id AND product_id = v_item.product_id;
        
        -- C. Sumar PV (Solo si no es regalo)
        IF NOT COALESCE(v_item.is_gift, FALSE) THEN
            v_total_pv := v_total_pv + (COALESCE(v_item.pv_at_sale, 0) * v_item.quantity);
        ELSE
            v_gift_count := v_gift_count + v_item.quantity;
        END IF;
    END LOOP;

    -- 2. Descontar regalos si aplica
    IF v_gift_count > 0 THEN
        UPDATE public.profiles 
        SET free_products_count = GREATEST(0, COALESCE(free_products_count, 0) - v_gift_count)
        WHERE id = v_user_id;
    END IF;

    -- 3. Marcar como completada
    UPDATE public.sales 
    SET status = 'completado',
        seller_id = p_approver_id,
        total_pv = v_total_pv,
        updated_at = NOW()
    WHERE id = p_sale_id;

    -- 4. Distribución de beneficios (Con seguridad de profundidad en las funciones internas)
    IF v_total_pv > 0 AND v_user_id IS NOT NULL THEN
        SELECT monthly_pv, sponsor_id INTO v_old_monthly_pv, v_sponsor_id 
        FROM public.profiles WHERE id = v_user_id;

        UPDATE public.profiles 
        SET monthly_pv = COALESCE(monthly_pv, 0) + v_total_pv,
            pv = COALESCE(pv, 0) + v_total_pv
        WHERE id = v_user_id;

        IF COALESCE(v_old_monthly_pv, 0) < 100 AND (COALESCE(v_old_monthly_pv, 0) + v_total_pv) >= 100 AND v_sponsor_id IS NOT NULL THEN
            UPDATE public.profiles SET active_directs_count = COALESCE(active_directs_count, 0) + 1 WHERE id = v_sponsor_id;
        END IF;

        PERFORM public.distribute_pvg(v_user_id, v_total_pv);
        PERFORM public.distribute_royalties(v_user_id, v_total_pv);
        PERFORM public.check_rank_promotion(v_user_id);
        IF v_sponsor_id IS NOT NULL THEN PERFORM public.check_rank_promotion(v_sponsor_id); END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
