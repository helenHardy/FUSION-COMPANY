-- =============================================================
-- LOGIC MLM ELITE: CONSOLIDACIÓN Y PROTECCIÓN DE INTEGRIDAD
-- =============================================================
-- Este parche asegura que:
-- 1. Las comisiones se paguen según el plan del BENEFICIARIO.
-- 2. El ascenso de rangos sea estructural (no solo puntos).
-- 3. No existan triggers conflictivos.

BEGIN;

-- 1. DESHABILITAR TRIGGERS OBSOLETOS O CONFLICTIVOS
-- Eliminamos el trigger simple para usar la función de ascenso avanzada
DROP TRIGGER IF EXISTS trigger_rank_promotion ON public.profiles;
DROP FUNCTION IF EXISTS public.check_rank_promotion() CASCADE;

-- 2. MOTOR DE COMISIONES (Bono Inicio Rápido) - CORREGIDO
-- Usa el plan_id del BENEFICIARIO como solicitó el usuario.
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
  -- Obtenemos el precio del combo que compró el nuevo afiliado
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  
  -- Empezamos por el patrocinador directo
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;
  
  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 AND v_depth_limit < 100 LOOP
    -- INFO DEL BENEFICIARIO (El que recibe la comisión)
    SELECT current_combo_id INTO v_beneficiary_combo_id FROM public.profiles WHERE id = v_current_beneficiary;
    
    IF v_beneficiary_combo_id IS NOT NULL THEN
      -- Usamos el PLAN del combo que tiene el BENEFICIARIO
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      
      v_percentage := (v_config->>v_level::text)::NUMERIC;
      
      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        v_amount := v_buyer_combo_price * (v_percentage / 100);
        
        -- Registrar la comisión
        INSERT INTO public.commissions (
          beneficiary_id, source_user_id, amount, commission_type, level_depth
        ) VALUES (
          v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level
        );
        
        -- Actualizar balance del beneficiario
        UPDATE public.profiles 
        SET total_earnings = COALESCE(total_earnings, 0) + v_amount 
        WHERE id = v_current_beneficiary;
      END IF;
    END IF;
    
    -- Subir al siguiente nivel
    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. FUNCIÓN DE ASCENSO DE RANGO AVANZADA (ESTRUCTURAL)
CREATE OR REPLACE FUNCTION public.check_rank_promotion(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_record RECORD;
    v_next_rank RECORD;
    v_structure_met BOOLEAN := TRUE;
    v_branch_count INTEGER := 0;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    
    -- Buscar el rango inmediatamente superior al actual
    SELECT * INTO v_next_rank FROM public.ranks 
    WHERE order_index > (
        SELECT order_index FROM public.ranks WHERE name = COALESCE(v_user_record.current_rank, 'Básico')
    )
    ORDER BY order_index ASC LIMIT 1;

    IF v_next_rank IS NULL THEN RETURN; END IF;

    -- Requisitos de puntos (Personales y de Red)
    IF COALESCE(v_user_record.pv, 0) < v_next_rank.min_pv OR 
       COALESCE(v_user_record.pvg, 0) < v_next_rank.min_pvg THEN
        RETURN;
    END IF;

    -- Requisitos de Estructura (Ej: Tener 2 Oros en ramas distintas)
    IF v_next_rank.required_downline_rank IS NOT NULL AND v_next_rank.required_downline_count > 0 THEN
        SELECT COUNT(DISTINCT child.id) INTO v_branch_count
        FROM public.profiles child
        WHERE child.sponsor_id = p_user_id
        AND EXISTS (
            WITH RECURSIVE downline AS (
                SELECT id, current_rank FROM public.profiles WHERE id = child.id
                UNION ALL
                SELECT p.id, p.current_rank FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
            )
            SELECT 1 FROM downline WHERE current_rank = v_next_rank.required_downline_rank
        );
        
        IF v_branch_count < v_next_rank.required_downline_count THEN 
            v_structure_met := FALSE; 
        END IF;
    END IF;

    IF v_structure_met THEN
        UPDATE public.profiles SET current_rank = v_next_rank.name WHERE id = p_user_id;
        -- Recursividad: Al subir de rango, podría calificar al siguiente inmediatamente
        PERFORM public.check_rank_promotion(p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que la función de calificación mensual exista para las regalías
CREATE OR REPLACE FUNCTION public.check_monthly_qualification(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_rank_record RECORD;
    v_user_record RECORD;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank_record FROM public.ranks WHERE name = COALESCE(v_user_record.current_rank, 'Básico');
    
    IF v_rank_record.id IS NULL THEN RETURN FALSE; END IF;
    
    -- Los rangos mínimos personal (Ej: 100 PV) y directos activos
    RETURN (
        COALESCE(v_user_record.monthly_pv, 0) >= COALESCE(v_rank_record.min_pv_monthly, 0) AND
        COALESCE(v_user_record.active_directs_count, 0) >= COALESCE(v_rank_record.min_active_directs, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
