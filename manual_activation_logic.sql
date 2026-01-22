-- 0. CORREGIR EL CONSTRAINT DE ESTADO EN PROFILES
-- El estado 'pendiente' es necesario para el nuevo flujo de activación manual.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('activo', 'inactivo', 'pendiente'));

-- 1. MODIFICAR EL TRIGGER DE NUEVO USUARIO
-- El nuevo usuario entra como 'pendiente' y NO reparte puntos ni comisiones aún.
-- Tampoco se carga deuda al patrocinador ya que el admin cobra directamente.

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
    'pendiente', -- Estado inicial
    NULL,        -- No hay fecha de activación aún
    0,           -- Puntos en 0 hasta activar
    0,           -- Productos gratis en 0 hasta activar
    0            -- No se genera deuda al patrocinador
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNCIÓN PARA ACTIVACIÓN MANUAL POR EL ADMIN
-- Esta función reparte los beneficios (PV y Comisiones) tras confirmar el pago.

CREATE OR REPLACE FUNCTION public.activate_affiliate(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS VOID AS $$
DECLARE
  v_combo_id UUID;
  v_combo_pv NUMERIC;
  v_free_prods INTEGER;
  v_status TEXT;
BEGIN
  -- Verificar que quien activa es admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden activar cuentas.';
  END IF;

  -- Obtener info del perfil
  SELECT current_combo_id, status INTO v_combo_id, v_status 
  FROM public.profiles WHERE id = p_user_id;

  IF v_status <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta cuenta ya está activa o no está pendiente.';
  END IF;

  -- Obtener beneficios del combo
  SELECT pv_awarded, free_products_count INTO v_combo_pv, v_free_prods
  FROM public.combos WHERE id = v_combo_id;

  -- 1. Activar Perfil
  UPDATE public.profiles SET
    status = 'activo',
    activation_date = NOW(),
    pv = v_combo_pv,
    free_products_count = v_free_prods
  WHERE id = p_user_id;

  -- 2. Repartir Puntos a la Red (PVG)
  IF v_combo_pv > 0 THEN
    PERFORM public.distribute_pvg(p_user_id, v_combo_pv);
  END IF;

  -- 3. Repartir Comisiones (Bs)
  IF v_combo_id IS NOT NULL THEN
    PERFORM public.distribute_commissions(p_user_id, v_combo_id);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
