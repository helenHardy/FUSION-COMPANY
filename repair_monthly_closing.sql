-- REPARACIÓN DE FUNCIÓN DE CIERRE MENSUAL
-- Este script corrige posibles errores de casting (400) y mejora la robustez

CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB AS $$
DECLARE
    v_percent NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_setting_val TEXT;
BEGIN
    -- 1. Obtener porcentaje de forma segura
    SELECT value INTO v_setting_val FROM public.system_settings WHERE key = 'monthly_pv_bonus_percent';
    
    -- Intentar convertir a numérico, si falla usar 15 por defecto
    BEGIN
        v_percent := v_setting_val::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_percent := 15;
    END;

    IF v_percent IS NULL THEN v_percent := 15; END IF;
    
    -- 2. Determinar el periodo (Mes actual)
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- 3. Snapshot de bonos para usuarios con PV > 0
    -- Usamos subconsulta para asegurar que el cálculo sea numérico
    INSERT INTO public.user_monthly_bonuses (user_id, period_month, period_year, pv_amount, percentage, bonus_amount)
    SELECT 
        id, 
        v_month, 
        v_year, 
        COALESCE(monthly_pv, 0), 
        v_percent, 
        (COALESCE(monthly_pv, 0) * v_percent / 100.0)
    FROM public.profiles
    WHERE monthly_pv > 0
    ON CONFLICT (user_id, period_month, period_year) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 4. Reiniciar contadores del mes
    UPDATE public.profiles
    SET monthly_pv = 0,
        active_directs_count = 0;

    -- 5. Retornar éxito con casting explícito a texto para evitar errores de tipo en jsonb_build_object
    RETURN jsonb_build_object(
        'success', true, 
        'processed_users', v_count, 
        'period', v_month::text || '/' || v_year::text,
        'closing_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO authenticated;
