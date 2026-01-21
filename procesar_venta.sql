
-- FUNCIÓN PARA PROCESAR UNA VENTA (POS)
-- Esta función asegura que todo pase o falle en conjunto (Transacción Atómica)

CREATE OR REPLACE FUNCTION public.process_sale(
  p_user_id UUID,        -- El comprador (afiliado)
  p_branch_id UUID,      -- Desde qué sucursal
  p_seller_id UUID,      -- Quién hace la venta (cajero/admin)
  p_items JSONB          -- Lista de items: [{"product_id": "...", "quantity": 1, "price": 10, "pv": 5}, ...]
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_total_amount NUMERIC := 0;
  v_total_pv NUMERIC := 0;
  v_old_monthly_pv NUMERIC;
  v_sponsor_id UUID;
BEGIN
  -- 1. Crear el registro de la venta principal
  INSERT INTO public.sales (
    user_id, branch_id, total_amount, total_pv, status, created_at
  ) VALUES (
    p_user_id, p_branch_id, 0, 0, 'completado', NOW()
  ) RETURNING id INTO v_sale_id;

  -- 2. Procesar cada item del JSON
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    product_id UUID, 
    quantity INTEGER, 
    price NUMERIC, 
    pv NUMERIC,
    is_gift BOOLEAN
  ) LOOP
    -- A. Registrar el detalle del item
    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, price_at_sale, pv_at_sale, is_gift
    ) VALUES (
      v_sale_id, v_item.product_id, v_item.quantity, v_item.price, v_item.pv, COALESCE(v_item.is_gift, FALSE)
    );

    -- B. Descontar Stock del inventario de la sucursal
    UPDATE public.inventory 
    SET stock = stock - v_item.quantity 
    WHERE branch_id = p_branch_id AND product_id = v_item.product_id;

    -- C. Sumar totales
    v_total_amount := v_total_amount + (CASE WHEN v_item.is_gift THEN 0 ELSE v_item.price * v_item.quantity END);
    v_total_pv := v_total_pv + (CASE WHEN v_item.is_gift THEN 0 ELSE v_item.pv * v_item.quantity END);
    
    -- D. Descontar del balance de regalos si aplica
    IF v_item.is_gift IS TRUE THEN
      UPDATE public.profiles 
      SET free_products_count = GREATEST(0, COALESCE(free_products_count, 0) - v_item.quantity)
      WHERE id = p_user_id;
    END IF;
  END LOOP;

  -- 3. Actualizar los totales de la venta
  UPDATE public.sales 
  SET total_amount = v_total_amount, 
      total_pv = v_total_pv 
  WHERE id = v_sale_id;

  -- 4. SUMAR PV AL USUARIO Y PVG A LA RED
  IF v_total_pv > 0 THEN
    -- A. Actualizar PV Personal y Mensual
    -- Primero obtenemos el estado actual del PV mensual
    SELECT monthly_pv, sponsor_id INTO v_old_monthly_pv, v_sponsor_id FROM public.profiles WHERE id = p_user_id;

    UPDATE public.profiles 
    SET monthly_pv = monthly_pv + v_total_pv,
        pv = pv + v_total_pv
    WHERE id = p_user_id;

    -- B. Si el usuario pasa el umbral de activación (100 PV), sumamos al contador de su patrocinador
    IF v_old_monthly_pv < 100 AND (v_old_monthly_pv + v_total_pv) >= 100 AND v_sponsor_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET active_directs_count = active_directs_count + 1 
        WHERE id = v_sponsor_id;
    END IF;

    -- C. Escalar PVG en la red
    PERFORM public.distribute_pvg(p_user_id, v_total_pv);

    -- D. DISTRIBUIR REGALÍAS (Residual con Compresión Dinámica)
    PERFORM public.distribute_royalties(p_user_id, v_total_pv);

    -- E. VERIFICAR ASCENSO DE RANGO
    PERFORM public.check_rank_promotion(p_user_id);
    
    -- También verificar para el patrocinador
    IF v_sponsor_id IS NOT NULL THEN
        PERFORM public.check_rank_promotion(v_sponsor_id);
    END IF;
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
