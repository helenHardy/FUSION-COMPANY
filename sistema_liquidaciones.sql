
-- GESTIÓN DE COBROS Y LIQUIDACIONES DE EFECTIVO

-- 1. Añadir columna de deuda por liquidar en perfiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pending_liquidation NUMERIC(10, 2) DEFAULT 0;

-- 2. Crear tabla de historial de liquidaciones
CREATE TABLE IF NOT EXISTS public.liquidations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    admin_id UUID REFERENCES public.profiles(id),
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ACTUALIZAR TRIGGER DE REGISTRO PARA CARGAR LA DEUDA AL PATROCINADOR
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_combo_price NUMERIC := 0;
  v_free_prods INTEGER := 0;
  v_sponsor_id UUID;
BEGIN
  v_sponsor_id := (new.raw_user_meta_data->>'sponsor_id')::uuid;

  -- Obtener info del combo (Puntos y Precio)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, price, free_products_count 
    INTO v_combo_pv, v_combo_price, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  -- Insertar Nuevo Perfil
  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, 
    current_combo_id, status, activation_date, pv, free_products_count
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
    v_free_prods
  );

  -- CARGAR EL DINERO COBRADO AL PATROCINADOR (DEUDA)
  IF v_combo_price > 0 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET pending_liquidation = pending_liquidation + v_combo_price 
    WHERE id = v_sponsor_id;
  END IF;

  -- REPARTIR PUNTOS A LA RED (PVG)
  IF v_combo_pv > 0 THEN
    PERFORM public.distribute_pvg(new.id, v_combo_pv);
  END IF;

  -- REPARTIR COMISIONES (Bs)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    PERFORM public.distribute_commissions(
      new.id, 
      (new.raw_user_meta_data->>'current_combo_id')::uuid
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función de Seguridad Auxiliar (Si no existe)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Función para Liquidar Deuda (Admin)
CREATE OR REPLACE FUNCTION public.liquidate_user_balance(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS VOID AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden liquidar balances.';
  END IF;

  -- Obtener el monto actual
  SELECT pending_liquidation INTO v_amount FROM public.profiles WHERE id = p_user_id;

  IF v_amount > 0 THEN
    -- Registrar en historial
    INSERT INTO public.liquidations (user_id, admin_id, amount) 
    VALUES (p_user_id, p_admin_id, v_amount);

    -- Resetear balance del usuario
    UPDATE public.profiles SET pending_liquidation = 0 WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
