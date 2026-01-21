
-- FIJO MAESTRO DE REGISTRO Y COMISIONES (VERSIÓN CORREGIDA - PLAN DEL BENEFICIARIO)

-- 1. Asegurar columnas necesarias
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pending_liquidation NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pv NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_pv NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pvg NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_directs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_products_count INTEGER DEFAULT 0;

-- 2. Función de Reparto de Puntos (PVG)
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_sponsor UUID;
BEGIN
  SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = p_start_user_id;
  WHILE v_current_sponsor IS NOT NULL LOOP
    UPDATE public.profiles SET pvg = COALESCE(pvg, 0) + p_points WHERE id = v_current_sponsor;
    SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = v_current_sponsor;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función de Reparto de Comisiones (Bs) - CORREGIDA
CREATE OR REPLACE FUNCTION public.distribute_commissions(
  p_user_id UUID,
  p_combo_id UUID -- El combo que está comprando el nuevo socio
) RETURNS VOID AS $$
DECLARE
  v_buyer_combo_price NUMERIC;
  v_beneficiary_combo_id UUID;
  v_plan_id UUID;
  v_config JSONB;
  v_level INTEGER := 1;
  v_percentage NUMERIC;
  v_amount NUMERIC;
  v_current_beneficiary UUID;
BEGIN
  -- El precio base siempre es el del combo que se VENDE
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  
  -- Empezamos con el patrocinador directo
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 LOOP
    -- OBTENER EL PLAN DE QUIÉN COBRA (El Beneficiario)
    SELECT current_combo_id INTO v_beneficiary_combo_id 
    FROM public.profiles WHERE id = v_current_beneficiary;

    -- Si el beneficiario tiene un combo, buscamos su configuración de porcentajes
    IF v_beneficiary_combo_id IS NOT NULL THEN
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      
      -- Buscamos el porcentaje que le toca a este beneficiario por su propio plan
      v_percentage := (v_config->>v_level::text)::NUMERIC;

      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        -- SE MULTIPLICA EL PRECIO DEL COMBO VENDIDO * EL PORCENTAJE DEL PLAN DEL BENEFICIARIO
        v_amount := v_buyer_combo_price * (v_percentage / 100);

        INSERT INTO public.commissions (
          beneficiary_id, source_user_id, amount, commission_type, level_depth
        ) VALUES (
          v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level
        );

        UPDATE public.profiles 
        SET total_earnings = COALESCE(total_earnings, 0) + v_amount 
        WHERE id = v_current_beneficiary;
      END IF;
    END IF;

    -- Subir un nivel
    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER MAESTRO DE REGISTRO
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_combo_price NUMERIC := 0;
  v_free_prods INTEGER := 0;
  v_sponsor_id UUID;
BEGIN
  v_sponsor_id := (new.raw_user_meta_data->>'sponsor_id')::uuid;

  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, price, free_products_count 
    INTO v_combo_pv, v_combo_price, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, 
    current_combo_id, status, activation_date, 
    pv, monthly_pv, free_products_count
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

  IF v_combo_price > 0 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET pending_liquidation = COALESCE(pending_liquidation, 0) + v_combo_price WHERE id = v_sponsor_id;
  END IF;

  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET active_directs_count = COALESCE(active_directs_count, 0) + 1 WHERE id = v_sponsor_id;
  END IF;

  IF v_combo_pv > 0 THEN PERFORM public.distribute_pvg(new.id, v_combo_pv); END IF;

  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    PERFORM public.distribute_commissions(new.id, (new.raw_user_meta_data->>'current_combo_id')::uuid);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;