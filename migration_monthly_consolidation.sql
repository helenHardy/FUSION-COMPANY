-- ========================================================
-- MIGRACIÓN: CONSOLIDACIÓN DE BONOS Y CIERRE MENSUAL (V3)
-- ========================================================

BEGIN;

-- 1. ESTRUCTURA DE DATOS: PVG Mensual
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_pvg NUMERIC(15, 2) DEFAULT 0;

-- 2. ACTUALIZAR DISTRIBUCIÓN DE PUNTOS (Para llenar el PVG Mensual)
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_sponsor UUID;
BEGIN
  SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = p_start_user_id;
  WHILE v_current_sponsor IS NOT NULL LOOP
    UPDATE public.profiles SET 
        pvg = COALESCE(pvg, 0) + p_points,
        monthly_pvg = COALESCE(monthly_pvg, 0) + p_points -- Nuevo contador mensual
    WHERE id = v_current_sponsor;
    
    SELECT sponsor_id INTO v_current_sponsor FROM public.profiles WHERE id = v_current_sponsor;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNCIÓN MAESTRA DE CIERRE MENSUAL CONSOLIDADO
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_percent_personal NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_user RECORD;
    v_total_bonus NUMERIC;
    v_personal_bonus NUMERIC;
    v_royalties_total NUMERIC;
    v_rank_record RECORD;
    v_milestone RECORD;
    v_percentage NUMERIC;
    v_setting_val TEXT;
BEGIN
    -- A. Obtener configuración del bono personal
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    v_percent_personal := COALESCE(v_setting_val::NUMERIC, 15);
    
    -- B. Determinar periodo
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- C. Procesar cada usuario que tuvo actividad este mes
    FOR v_user IN 
        SELECT p.*, r.royalties_config 
        FROM profiles p
        LEFT JOIN ranks r ON p.current_rank = r.name
        WHERE p.monthly_pv > 0 OR p.monthly_pvg > 0
    LOOP
        v_total_bonus := 0;
        v_personal_bonus := 0;
        v_royalties_total := 0;

        -- 1. Calcular Bono PV Personal
        IF v_user.monthly_pv > 0 THEN
            v_personal_bonus := (v_user.monthly_pv * v_percent_personal / 100.0);
        END IF;

        -- 2. Calcular Regalías por Metas alcanzadas (Niveles)
        -- Solo si el rango tiene configuración de regalías
        IF v_user.royalties_config IS NOT NULL AND v_user.royalties_config != '{}'::jsonb THEN
            -- Recorremos todas las metas configuradas
            FOR v_milestone IN SELECT * FROM royalty_milestones ORDER BY level_number ASC LOOP
                -- ¿Cumple requisitos de la meta con sus datos MENSUALES?
                -- Nota: Usamos monthly_pvg como solicitó el usuario
                IF v_user.monthly_pvg >= v_milestone.min_pvg AND 
                   v_user.monthly_pv >= v_milestone.min_monthly_pv THEN
                   
                   -- Buscar porcentaje para este nivel en su rango
                   v_percentage := (v_user.royalties_config->>( 'N' || v_milestone.level_number ))::NUMERIC;
                   
                   IF v_percentage > 0 THEN
                        v_royalties_total := v_royalties_total + (v_user.monthly_pvg * v_percentage / 100.0);
                   END IF;
                END IF;
            END LOOP;
        END IF;

        v_total_bonus := v_personal_bonus + v_royalties_total;

        -- 3. Si hay bono, registrarlo
        IF v_total_bonus > 0 THEN
            INSERT INTO user_monthly_bonuses (
                user_id, period_month, period_year, pv_amount, 
                percentage, bonus_amount, created_at
            ) VALUES (
                v_user.id, v_month, v_year, v_user.monthly_pv, 
                v_percent_personal, v_total_bonus, NOW()
            )
            ON CONFLICT (user_id, period_month, period_year) 
            DO UPDATE SET bonus_amount = EXCLUDED.bonus_amount;
            
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- D. REINICIO DE CONTADORES MENSUALES
    UPDATE profiles
    SET monthly_pv = 0,
        monthly_pvg = 0,
        active_directs_count = 0;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_users', v_count, 
        'period', v_month::text || '/' || v_year::text,
        'action', 'cierre_consolidado_mensual',
        'at', NOW()
    );
END;
$$;

COMMIT;
