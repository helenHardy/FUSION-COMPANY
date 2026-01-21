
-- 1. ACTUALIZAR TABLA PROFILES CON COLUMNAS DE ACUMULADOS
-- Esto permite que el Dashboard muestre los datos reales.
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pv NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pvg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_products_count INTEGER DEFAULT 0;

-- 2. FUNCIÓN PARA SUBIR PUNTOS A LA RED (RECURSIVO)
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_sponsor UUID;
BEGIN
  -- Obtener el patrocinador del usuario que generó los puntos
  SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = p_start_user_id;

  -- Subir por la red sumando PVG a todos los patrocinadores superiores
  WHILE v_current_sponsor IS NOT NULL LOOP
    UPDATE public.profiles 
    SET pvg = pvg + p_points 
    WHERE id = v_current_sponsor;

    SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = v_current_sponsor;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFACTORIZACIÓN DEL MOTOR DE COMISIONES (ACTUALIZA TOTAL_EARNINGS)
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
BEGIN
  SELECT price, plan_id INTO v_combo_price, v_plan_id FROM public.combos WHERE id = p_combo_id;
  SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 LOOP
    v_percentage := (v_config->>v_level::text)::NUMERIC;

    IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
      v_amount := v_combo_price * (v_percentage / 100);

      -- REGISTRAR COMISIÓN
      INSERT INTO public.commissions (
        beneficiary_id, source_user_id, amount, commission_type, level_depth
      ) VALUES (
        v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level
      );

      -- ACTUALIZAR GANANCIA ACUMULADA EN PERFIL
      UPDATE public.profiles 
      SET total_earnings = total_earnings + v_amount 
      WHERE id = v_current_beneficiary;
    END IF;

    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER DE REGISTRO MEJORADO (CON PV Y PVG)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_free_prods INTEGER := 0;
BEGIN
  -- Obtener info del combo
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, free_products_count INTO v_combo_pv, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  -- Insertar perfil
  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, 
    current_combo_id, status, activation_date, pv, free_products_count
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    (new.raw_user_meta_data->>'sponsor_id')::uuid,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    'activo',
    NOW(),
    v_combo_pv,
    v_free_prods
  );

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
