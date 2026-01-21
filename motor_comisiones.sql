
-- MOTOR DE COMISIONES MULTINIVEL (RECURSIVO)
-- Esta función sube por el árbol de patrocinio y reparte los Bs según el plan del combo.

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
  -- 1. Obtener datos del combo y su plan
  SELECT price, plan_id INTO v_combo_price, v_plan_id 
  FROM public.combos WHERE id = p_combo_id;

  SELECT config INTO v_config 
  FROM public.gain_plans WHERE id = v_plan_id;

  -- 2. Obtener el primer patrocinador (Nivel 1)
  SELECT sponsor_id INTO v_current_beneficiary 
  FROM public.profiles WHERE id = p_user_id;

  -- 3. Bucle para subir niveles
  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 LOOP
    -- Obtener el porcentaje para este nivel desde el JSON (ej: {"1": 10})
    v_percentage := (v_config->>v_level::text)::NUMERIC;

    IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
      v_amount := v_combo_price * (v_percentage / 100);

      -- REGISTRAR LA COMISIÓN
      INSERT INTO public.commissions (
        beneficiary_id,
        source_user_id,
        amount,
        commission_type,
        level_depth
      ) VALUES (
        v_current_beneficiary,
        p_user_id,
        v_amount,
        'bono_inicio_rapido',
        v_level
      );
    END IF;

    -- Subir al siguiente nivel
    SELECT sponsor_id INTO v_current_beneficiary 
    FROM public.profiles WHERE id = v_current_beneficiary;
    
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER FINAL ACTUALIZADO
-- Llama al repartidor de comisiones inmediatamente al registrarse con combo
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, current_combo_id, status, activation_date
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    (new.raw_user_meta_data->>'sponsor_id')::uuid,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    'activo',
    NOW()
  );

  -- ACTIVAR REPARTO DE COMISIONES SI HAY COMBO
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    PERFORM public.distribute_commissions(
      new.id, 
      (new.raw_user_meta_data->>'current_combo_id')::uuid
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
