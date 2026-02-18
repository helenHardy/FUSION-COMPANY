
-- 1. Asegurar que los rangos están bien configurados
INSERT INTO public.ranks (name, royalties_config, order_index)
VALUES ('FUSION 1', '{"N1": 5, "N2": 2}'::jsonb, 1)
ON CONFLICT (name) DO UPDATE SET 
    royalties_config = EXCLUDED.royalties_config,
    order_index = 1;

-- 2. Redefinir la función RPC con depuración extrema
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    -- Obtenemos perfil y rango con join robusto (LOWER + TRIM)
    SELECT 
        p.id, 
        p.current_rank, 
        p.monthly_pv, 
        p.monthly_pvg,
        r.name as matched_rank_name,
        r.royalties_config as rank_config
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

    -- Generar JSON con metas y campos de depuración claros
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
            'max_percentage', COALESCE((SELECT MAX(COALESCE((royalties_config->>( 'N' || rm.level_number ))::NUMERIC, 0)) FROM public.ranks), 0),
            'debug_user_rank', COALESCE(v_profile.current_rank, 'SIN RANGO'),
            'debug_system_rank', COALESCE(v_profile.matched_rank_name, 'NO ENCONTRADO'),
            'debug_config_raw', COALESCE(v_profile.rank_config::text, '{}'),
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
