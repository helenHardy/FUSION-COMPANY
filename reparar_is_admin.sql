
-- REPARAR FUNCIÓN IS_ADMIN Y LIQUIDACIONES

-- 1. Crear la versión de is_admin que acepta un UUID (la que falta)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Asegurar también la versión sin argumentos por si se usa en RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-crear la función de liquidación (ahora con is_admin corregido)
CREATE OR REPLACE FUNCTION public.liquidate_user_balance(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS VOID AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  -- Verificar que el que liquida es ADMIN
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

-- 4. Dar permisos finales
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.liquidate_user_balance(UUID, UUID) TO authenticated;
