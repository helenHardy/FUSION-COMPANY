-- ========================================================
-- MASTER PRODUCTION INTEGRITY: ACTIVACIÓN Y COMISIONES (V2)
-- ========================================================
-- Este script unifica y corrige los 3 pilares de producción:
-- 1. Comisiones basadas en el CONTENEDOR (Beneficiario).
-- 2. Actualización de métricas MLM (Directos activos, PV Mensual).
-- 3. Activación manual segura con promociones automáticas.

BEGIN;

-- 1. CORRECCIÓN DE COMISIONES (Beneficiario % * Precio Comprador)
CREATE OR REPLACE FUNCTION public.distribute_commissions(
  p_user_id UUID,
  p_combo_id UUID
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
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 AND v_depth_limit < 100 LOOP
    SELECT current_combo_id INTO v_beneficiary_combo_id FROM public.profiles WHERE id = v_current_beneficiary;

    IF v_beneficiary_combo_id IS NOT NULL THEN
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      v_percentage := (v_config->>v_level::text)::NUMERIC;

      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        v_amount := v_buyer_combo_price * (v_percentage / 100);
        INSERT INTO public.commissions (beneficiary_id, source_user_id, amount, commission_type, level_depth)
        VALUES (v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level);
        
        UPDATE public.profiles SET total_earnings = COALESCE(total_earnings, 0) + v_amount WHERE id = v_current_beneficiary;
      END IF;
    END IF;

    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNCIÓN DE ACTIVACIÓN MANUAL (CORREGIDA PARA PRODUCCIÓN)
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
BEGIN
  -- A. Verificación de Seguridad
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo los administradores pueden activar cuentas.';
  END IF;

  SELECT current_combo_id, status, sponsor_id INTO v_combo_id, v_status, v_sponsor_id 
  FROM public.profiles WHERE id = p_user_id;

  IF v_status <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta cuenta ya está activa o no está pendiente.';
  END IF;

  -- B. Obtener Beneficios del Combo
  SELECT pv_awarded, free_products_count INTO v_combo_pv, v_free_prods
  FROM public.combos WHERE id = v_combo_id;

  -- C. ACTIVACIÓN DE PERFIL Y MÉTRICAS PROPIAS
  UPDATE public.profiles SET
    status = 'activo',
    activation_date = NOW(),
    pv = COALESCE(pv, 0) + v_combo_pv,
    monthly_pv = COALESCE(monthly_pv, 0) + v_combo_pv, -- ¡NUEVO! Vital para calificación
    free_products_count = v_free_prods
  WHERE id = p_user_id;

  -- D. ACTUALIZACIÓN DEL PATROCINADOR (Directos Activos)
  -- Si el combo otorga al menos 100 PV, cuenta como directo activo calificado
  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles 
    SET active_directs_count = COALESCE(active_directs_count, 0) + 1 
    WHERE id = v_sponsor_id;
  END IF;

  -- E. REPARTO DE RED
  -- 1. Puntos (PVG)
  IF v_combo_pv > 0 THEN
    PERFORM public.distribute_pvg(p_user_id, v_combo_pv);
  END IF;

  -- 2. Comisiones (Bs) - Usa la nueva lógica de Beneficiario
  IF v_combo_id IS NOT NULL THEN
    PERFORM public.distribute_commissions(p_user_id, v_combo_id);
  END IF;

  -- F. VERIFICACIÓN DE RANGOS (Ascensión Automática)
  PERFORM public.check_rank_promotion(p_user_id);
  IF v_sponsor_id IS NOT NULL THEN
    PERFORM public.check_rank_promotion(v_sponsor_id);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
