-- ========================================================
-- REPARACIÓN DE RANGO PERSONAL Y PORCENTAJES (5% / 2%)
-- ========================================================
-- Este script:
-- 1. Actualiza el rango 'PERSONAL' con los porcentajes correctos (N1: 5%, N2: 2%).
-- 2. Asegura que el usuario tenga asignado el rango 'PERSONAL'.
-- 3. Limpia espacios y discrepancias de nombres.

BEGIN;

-- 1. ACTUALIZAR RANGO PERSONAL
-- Forzamos N1: 5% y N2: 2% según el requerimiento y screenshot del usuario.
INSERT INTO public.ranks (name, royalties_config, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index)
VALUES ('PERSONAL', '{"N1": 5, "N2": 2, "N3": 0, "N4": 0, "N5": 0, "N6": 0, "N7": 0, "N8": 0}'::jsonb, 0, 0, 0, 0, 0)
ON CONFLICT (name) DO UPDATE SET 
    royalties_config = EXCLUDED.royalties_config,
    order_index = 0;

-- 2. NORMALIZAR RANGO EN PERFILES
-- Si el usuario dice que es PERSONAL pero el sistema dice 'básico', lo forzamos.
-- También arreglamos los que están vacíos.
UPDATE public.profiles 
SET current_rank = 'PERSONAL' 
WHERE LOWER(TRIM(current_rank)) = 'básico' 
   OR current_rank IS NULL 
   OR TRIM(current_rank) = '';

-- 3. REPARAR RPC (Asegurar que devuelve los datos correctos)
-- Ya lo hicimos en scripts anteriores, pero lo reafirmamos aquí para que no haya duda.
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    SELECT 
        p.*, 
        r.royalties_config as rank_config,
        r.name as matched_rank
    INTO v_profile 
    FROM public.profiles p
    LEFT JOIN public.ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
    WHERE p.id = p_user_id;

    IF v_profile.id IS NULL THEN RETURN '[]'::jsonb; END IF;

    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    SELECT jsonb_agg(sub.item) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'level_number', rm.level_number,
            'min_people', rm.min_people,
            'min_pvg', rm.min_pvg,
            'min_monthly_pv', rm.min_monthly_pv,
            'current_people', v_total_downline,
            'current_pvg', COALESCE(v_profile.monthly_pvg, 0),
            'current_monthly_pv', COALESCE(v_profile.monthly_pv, 0),
            'rank_percentage', COALESCE((v_profile.rank_config->>( 'N' || rm.level_number ))::NUMERIC, 0),
            'max_percentage', (SELECT MAX(COALESCE((royalties_config->>( 'N' || rm.level_number ))::NUMERIC, 0)) FROM public.ranks),
            'debug_user_rank', v_profile.current_rank,
            'debug_system_rank', v_profile.matched_rank,
            'is_unlocked', (
                v_total_downline >= rm.min_people 
                AND COALESCE(v_profile.monthly_pvg, 0) >= rm.min_pvg
                AND COALESCE(v_profile.monthly_pv, 0) >= rm.min_monthly_pv
                AND COALESCE((v_profile.rank_config->>( 'N' || rm.level_number ))::NUMERIC, 0) > 0
            )
        ) as item
        FROM public.royalty_milestones rm
        ORDER BY rm.level_number ASC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
