
-- CORRECCIÓN: TRIGGER DE REGISTRO (DIRECTOS ACTIVOS)

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_combo_price NUMERIC := 0;
  v_free_prods INTEGER := 0;
  v_sponsor_id UUID;
BEGIN
  v_sponsor_id := (new.raw_user_meta_data->>'sponsor_id')::uuid;

  -- 1. Obtener info del combo (Puntos y Precio)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, price, free_products_count 
    INTO v_combo_pv, v_combo_price, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  -- 2. Insertar Nuevo Perfil con PV y Monthly PV
  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, 
    current_combo_id, status, activation_date, pv, monthly_pv, free_products_count
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    v_sponsor_id,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    'activo',
    NOW(),
    v_combo_pv,
    v_combo_pv,
    v_free_prods
  );

  -- 3. CARGAR DEUDA AL PATROCINADOR
  IF v_combo_price > 0 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET pending_liquidation = pending_liquidation + v_combo_price 
    WHERE id = v_sponsor_id;
  END IF;

  -- 4. CONTAR COMO DIRECTO ACTIVO (Si el combo da >= 100 PV)
  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET active_directs_count = active_directs_count + 1 
    WHERE id = v_sponsor_id;
  END IF;

  -- 5. REPARTIR PUNTOS A LA RED (PVG)
  IF v_combo_pv > 0 THEN
    PERFORM public.distribute_pvg(new.id, v_combo_pv);
  END IF;

  -- 6. REPARTIR COMISIONES (Bonos de Patrocinio)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    -- El sistema de comisiones (Bono de Inicio Rápido)
    PERFORM public.distribute_commissions(
      new.id, 
      (new.raw_user_meta_data->>'current_combo_id')::uuid
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
