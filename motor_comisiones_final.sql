-- =============================================
-- MOTOR DE COMISIONES CONSOLIDADO (VERSIÓN FINAL)
-- Lógica: (Plan del Beneficiario) x (Precio del Comprador)
-- =============================================

-- Limpiar versión previa para evitar conflictos de firma
DROP FUNCTION IF EXISTS public.distribute_commissions(uuid, uuid);

CREATE OR REPLACE FUNCTION public.distribute_commissions(
  p_user_id UUID,
  p_combo_id UUID -- Combo que compra el nuevo socio
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
  v_depth_limit INTEGER := 0;
BEGIN
  -- 1. Obtener el precio del combo vendido (el monto base del cálculo)
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  
  -- 2. Empezar con el patrocinador directo (Nivel 1)
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  -- 3. Recorrer la línea ascendente (Límite de 20 niveles y protección de 100 saltos para bucles)
  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 AND v_depth_limit < 100 LOOP
    
    -- 4. Obtener el combo actual de quien cobraría la comisión
    SELECT current_combo_id INTO v_beneficiary_combo_id 
    FROM public.profiles WHERE id = v_current_beneficiary;

    -- Solo paga si el beneficiario tiene un combo activo
    IF v_beneficiary_combo_id IS NOT NULL THEN
      -- 5. Obtener el plan de ganancias configurado para ese combo del beneficiario
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      
      -- 6. Intentar obtener el porcentaje para este nivel específico desde el combo DEL BENEFICIARIO
      -- Si el combo solo tiene 3 niveles, devolverá NULL para el nivel 4.
      v_percentage := (v_config->>v_level::text)::NUMERIC;

      -- 7. Aplicar el pago solo si el plan del beneficiario tiene porcentaje para este nivel
      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        -- CÁLCULO ESTRELLA: Precio del producto vendido * % de quien cobra
        v_amount := v_buyer_combo_price * (v_percentage / 100);

        -- Registrar el movimiento de comisión
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

        -- Actualizar ganancias totales del perfil
        UPDATE public.profiles 
        SET total_earnings = COALESCE(total_earnings, 0) + v_amount 
        WHERE id = v_current_beneficiary;
      END IF;
    END IF;

    -- 8. Subir al siguiente patrocinador y aumentar el contador de nivel
    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
