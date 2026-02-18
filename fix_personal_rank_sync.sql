
-- 1. Asegurar que los nombres de los rangos están limpios
UPDATE public.ranks SET name = TRIM(name);
UPDATE public.profiles SET current_rank = TRIM(current_rank);

-- 2. Darle prioridad al rango PERSONAL si existe (asumiendo que es el rango inicial del usuario)
UPDATE public.ranks SET order_index = 0 WHERE name = 'PERSONAL';
UPDATE public.ranks SET order_index = 1 WHERE name = 'Básico';

-- 3. Asegurar que PERSONAL tiene los porcentajes correctos según el screenshot
UPDATE public.ranks 
SET royalties_config = '{"N1": 5, "N2": 0, "N3": 0, "N4": 0, "N5": 0, "N6": 0, "N7": 0, "N8": 0}'::jsonb
WHERE name = 'PERSONAL';

-- 4. Re-sincronizar el RPC de estado para ser aún más permisivo
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    -- Obtenemos perfil y rango con join robusto
    SELECT 
        p.*, 
        r.royalties_config as rank_config,
        r.name as matched_rank
    INTO v_profile 
    FROM public.profiles p
    LEFT JOIN public.ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
    WHERE p.id = p_user_id;

    IF v_profile.id IS NULL THEN RETURN '[]'::jsonb; END IF;

    -- Downline total
    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    -- Generar JSON con metas
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
            'debug_rank', v_profile.current_rank,
            'debug_matched', v_profile.matched_rank,
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
