-- FIX V7: REPARACIÓN NUCLEAR DE REGALÍAS Y BONOS
-- Este script asegura que TODA la estructura de la base de datos sea compatible con el Frontend.

-- 1. ASEGURAR COLUMNAS EN TABLAS CRÍTICAS
DO $$ 
BEGIN 
    -- En Profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_pv') THEN
        ALTER TABLE public.profiles ADD COLUMN monthly_pv NUMERIC(15, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_pvg') THEN
        ALTER TABLE public.profiles ADD COLUMN monthly_pvg NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- En Ranks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ranks' AND column_name='personal_bonus_percentage') THEN
        ALTER TABLE public.ranks ADD COLUMN personal_bonus_percentage NUMERIC(5, 2) DEFAULT 0;
    END IF;

    -- En Royalty Milestones (EL CAUSANTE PROBABLE DEL ERROR 400)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='royalty_milestones' AND column_name='min_monthly_pv') THEN
        ALTER TABLE public.royalty_milestones ADD COLUMN min_monthly_pv NUMERIC(15, 2) DEFAULT 0;
    END IF;
END $$;

-- 2. ELIMINAR FUNCIONES PREVIAS (Para evitar conflictos de firmas/parámetros)
DROP FUNCTION IF EXISTS public.get_user_royalty_status(UUID);
DROP FUNCTION IF EXISTS public.get_user_royalty_status();

-- 3. RECREAR FUNCIÓN DE ESTADO DE REGALÍAS CON MÁXIMA ROBUSTEZ
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    -- A. Obtener perfil y configuracion de rango
    SELECT 
        p.id, p.current_rank, p.monthly_pv, p.monthly_pvg,
        r.name as matched_rank_name,
        r.royalties_config as rank_config,
        r.personal_bonus_percentage as rank_personal_bonus
    INTO v_profile 
    FROM public.profiles p
    LEFT JOIN public.ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
    WHERE p.id = p_user_id;

    IF v_profile.id IS NULL THEN RETURN '[]'::jsonb; END IF;

    -- B. People count (Recursivo)
    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    -- C. Construir JSON (Asegurando COALESCE en cada campo para evitar errores de tipo en el Frontend)
    SELECT jsonb_agg(sub.item) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'level_number', rm.level_number,
            'min_people', rm.min_people,
            'min_pvg', rm.min_pvg,
            'min_monthly_pv', COALESCE(rm.min_monthly_pv, 0),
            'current_people', v_total_downline,
            'current_pvg', COALESCE(v_profile.monthly_pvg, 0),
            'current_monthly_pv', COALESCE(v_profile.monthly_pv, 0),
            'rank_percentage', COALESCE((v_profile.rank_config->>( 'N' || rm.level_number ))::NUMERIC, 0),
            'max_percentage', COALESCE((SELECT MAX(COALESCE((royalties_config->>( 'N' || rm.level_number ))::NUMERIC, 0)) FROM public.ranks), 0),
            'debug_user_rank', COALESCE(v_profile.current_rank, 'SIN RANGO'),
            'debug_system_rank', COALESCE(v_profile.matched_rank_name, 'NO ENCONTRADO'),
            'debug_config_raw', COALESCE(v_profile.rank_config::text, '{}'),
            'rank_personal_bonus', COALESCE(v_profile.rank_personal_bonus, 0),
            'is_unlocked', (
                v_total_downline >= rm.min_people 
                AND COALESCE(v_profile.monthly_pvg, 0) >= rm.min_pvg
                AND COALESCE(v_profile.monthly_pv, 0) >= COALESCE(rm.min_monthly_pv, 0)
                AND COALESCE((v_profile.rank_config->>( 'N' || rm.level_number ))::NUMERIC, 0) > 0
            )
        ) as item
        FROM public.royalty_milestones rm
        ORDER BY rm.level_number ASC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. OTORGAR PERMISOS (Vital para evitar 403/400 en algunos entornos de Supabase)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_royalty_status(UUID) TO anon, authenticated;

-- 5. VERIFICACIÓN DE METAS (Opcional: Asegurar que existan al menos 10 niveles)
INSERT INTO public.royalty_milestones (level_number, min_people, min_pvg, min_monthly_pv)
SELECT i, (pow(5, i))::int, (pow(5, i) * 100)::numeric, 100
FROM generate_series(1, 10) i
ON CONFLICT (level_number) DO NOTHING;
