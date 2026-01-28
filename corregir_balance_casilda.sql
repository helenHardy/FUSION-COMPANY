-- =============================================
-- CORRECCIÓN MANUAL: CASILDA JAICO LISIDRO
-- =============================================
-- Este script ajusta la comisión errónea de 52.5 Bs a 42 Bs.

DO $$
DECLARE
  v_casilda_id UUID;
  v_baneza_id UUID;
  v_incorrect_amount NUMERIC := 52.5;
  v_correct_amount NUMERIC := 42.0; -- 350 (Combo 3) * 12% (Combo 2 de Casilda)
BEGIN
  -- 1. Buscar IDs por nombre (Búsqueda aproximada para seguridad)
  SELECT id INTO v_casilda_id FROM public.profiles WHERE full_name ILIKE '%CASILDA JAICO LISIDRO%' LIMIT 1;
  SELECT id INTO v_baneza_id FROM public.profiles WHERE full_name ILIKE '%BANEZA CHACA COYO%' LIMIT 1;

  IF v_casilda_id IS NULL OR v_baneza_id IS NULL THEN
    RAISE NOTICE 'No se encontró a Casilda o Baneza por nombre. Por favor verifica los nombres.';
    RETURN;
  END IF;

  -- 2. Corregir el registro en la tabla de comisiones
  -- Buscamos específicamente la comisión de inicio rápido de Baneza hacia Casilda con el monto viejo
  UPDATE public.commissions 
  SET amount = v_correct_amount
  WHERE beneficiary_id = v_casilda_id 
    AND source_user_id = v_baneza_id 
    AND commission_type = 'bono_inicio_rapido';

  -- 3. Recalcular el Total Ganado de Casilda
  -- Sumamos todas sus comisiones reales para asegurar que el perfil sea exacto
  UPDATE public.profiles
  SET total_earnings = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM public.commissions 
    WHERE beneficiary_id = v_casilda_id
  )
  WHERE id = v_casilda_id;

  RAISE NOTICE 'Corrección completada para Casilda. Monto actualizado de 52.5 a 42.0 Bs.';
END $$;
