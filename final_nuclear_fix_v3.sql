-- NUCLEAR REPAIR: CIERRE MENSUAL (V3)
-- Este script borra versiones anteriores y reconstruye todo con máxima compatibilidad

-- 1. Limpieza total de funciones previas (para evitar conflictos de firma)
DROP FUNCTION IF EXISTS public.execute_monthly_closing();
DROP FUNCTION IF EXISTS public.execute_monthly_closing(uuid);

-- 2. Asegurar columnas base
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_pv NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_directs_count INTEGER DEFAULT 0;

-- 3. Tablas de soporte
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value, description)
VALUES ('monthly_pv_bonus_percent', '15', 'Porcentaje para el Bono de PV Mensual')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_monthly_bonuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    pv_amount NUMERIC(15, 2) NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    bonus_amount NUMERIC(15, 2) NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_month, period_year)
);

-- 4. FUNCIÓN MAESTRA (Con búsqueda explícita y seguridad total)
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
    v_percent NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_setting_val TEXT;
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- A. Obtener porcentaje
        SELECT value INTO v_setting_val FROM public.system_settings WHERE key = 'monthly_pv_bonus_percent';
        v_percent := COALESCE(v_setting_val::NUMERIC, 15);

        -- B. Determinar periodo
        v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
        v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

        -- C. Snapshot de bonos
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

        -- D. Reiniciar contadores
        UPDATE public.profiles
        SET monthly_pv = 0,
            active_directs_count = 0
        WHERE id IS NOT NULL; -- Requerido para evitar el error de 'safe update'

        RETURN jsonb_build_object(
            'success', true, 
            'processed_users', v_count, 
            'period', v_month::text || '/' || v_year::text,
            'closing_at', NOW()
        );

    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
        RETURN jsonb_build_object(
            'success', false,
            'error', v_error_msg,
            'detail', 'Error interno en execute_monthly_closing'
        );
    END;
END;
$$;

-- 5. PERMISOS
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO service_role;
