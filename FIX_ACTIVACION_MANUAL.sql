-- 1. CORREGIR EL CONSTRAINT DE ESTADO EN PROFILES
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('activo', 'inactivo', 'pendiente'));

-- 2. MODIFICAR EL TRIGGER DE NUEVO USUARIO
-- Asegurar que guardamos el current_combo_id desde la meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    document_id, 
    role, 
    sponsor_id, 
    current_combo_id,
    status,
    activation_date,
    pv,
    monthly_pv,
    free_products_count,
    pending_liquidation
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    NULLIF(new.raw_user_meta_data->>'sponsor_id', '')::uuid,
    NULLIF(new.raw_user_meta_data->>'current_combo_id', '')::uuid,
    'pendiente',
    NULL,
    0,
    0,
    0,
    0
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN PARA ACTIVACIÓN MANUAL POR EL ADMIN
CREATE OR REPLACE FUNCTION public.activate_affiliate(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS VOID AS $$
DECLARE
  v_combo_id UUID;
  v_combo_pv NUMERIC;
  v_free_prods INTEGER;
  v_status TEXT;
  v_sponsor_id UUID;
  v_combo_price NUMERIC;
BEGIN
  -- Verificar que quien activa es admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden activar cuentas.';
  END IF;

  -- Obtener info del perfil (tomando el combo_id actual en la tabla)
  SELECT current_combo_id, status, sponsor_id INTO v_combo_id, v_status, v_sponsor_id
  FROM public.profiles WHERE id = p_user_id;

  IF v_status <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta cuenta ya está activa o no está pendiente.';
  END IF;

  IF v_combo_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene un combo seleccionado. Por favor asigne uno antes de activar.';
  END IF;

  -- Obtener beneficios del combo
  SELECT pv_awarded, free_products_count, price INTO v_combo_pv, v_free_prods, v_combo_price
  FROM public.combos WHERE id = v_combo_id;

  -- 1. Activar Perfil
  UPDATE public.profiles SET
    status = 'activo',
    activation_date = NOW(),
    pv = v_combo_pv,
    monthly_pv = v_combo_pv,
    free_products_count = v_free_prods
  WHERE id = p_user_id;

  -- 2. Contar como directo activo si el combo da >= 100 PV
  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET active_directs_count = active_directs_count + 1 
    WHERE id = v_sponsor_id;
  END IF;

  -- 3. Repartir Puntos a la Red (PVG)
  IF v_combo_pv > 0 THEN
    PERFORM public.distribute_pvg(p_user_id, v_combo_pv);
  END IF;

  -- 4. Repartir Comisiones (Bs)
  PERFORM public.distribute_commissions(p_user_id, v_combo_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
