-- MASTER FIX: CIERRE MENSUAL Y BONOS
-- Este script repara la estructura completa para eliminar el error 400

-- 1. Asegurar extensiones para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Asegurar columnas en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_pv NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_directs_count INTEGER DEFAULT 0;

-- 3. Asegurar tabla de configuración
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial si no existe
INSERT INTO public.system_settings (key, value, description)
VALUES ('monthly_pv_bonus_percent', '15', 'Porcentaje para el Bono de PV Mensual')
ON CONFLICT (key) DO NOTHING;

-- 4. Asegurar tabla de bonos mensuales
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

-- 5. FUNCIÓN DE CIERRE MENSUAL (REPARADA Y ROBUSTA)
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_percent NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_setting_val TEXT;
BEGIN
    -- A. Obtener porcentaje de forma segura
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    
    BEGIN
        v_percent := v_setting_val::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
        v_percent := 15;
    END;

    IF v_percent IS NULL THEN v_percent := 15; END IF;
    
    -- B. Determinar el periodo (Mes actual)
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- C. Crear Snapshot de bonos (Solo si el PV > 0)
    INSERT INTO user_monthly_bonuses (user_id, period_month, period_year, pv_amount, percentage, bonus_amount)
    SELECT 
        id, 
        v_month, 
        v_year, 
        COALESCE(monthly_pv, 0), 
        v_percent, 
        (COALESCE(monthly_pv, 0) * v_percent / 100.0)
    FROM profiles
    WHERE monthly_pv > 0
    ON CONFLICT (user_id, period_month, period_year) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- D. Reiniciar contadores del mes en perfiles
    UPDATE profiles
    SET monthly_pv = 0,
        active_directs_count = 0;

    -- E. Retornar JSON con resultados
    RETURN jsonb_build_object(
        'success', true, 
        'processed_users', v_count, 
        'period', v_month::text || '/' || v_year::text,
        'closing_at', NOW()
    );
END;
$$;

-- 6. PERMISOS EXPLÍCITOS
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.user_monthly_bonuses TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO authenticated;
