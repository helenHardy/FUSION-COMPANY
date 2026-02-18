-- FIX V6: REPARACIÓN DEFINITIVA DE NOMBRES Y PERMISOS (get_user_royalty_status)
-- Corrige el error de campo inexistente (rank_config vs rank_royalty_config)

-- 1. ASEGURAR ESTRUCTURA
ALTER TABLE public.ranks ADD COLUMN IF NOT EXISTS personal_bonus_percentage NUMERIC(5, 2) DEFAULT 0;

-- 2. FUNCIÓN DE ESTADO DE REGALÍAS (REPARADA)
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 1. Obtener perfil y rango con join robusto
    SELECT 
        p.id, p.current_rank, p.monthly_pv, p.monthly_pvg,
        r.name as matched_rank_name,
        r.royalties_config as rank_config, -- Alias: rank_config
        r.personal_bonus_percentage as rank_personal_bonus
    INTO v_profile 
    FROM public.profiles p
    LEFT JOIN public.ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
    WHERE p.id = p_user_id;

    IF v_profile.id IS NULL THEN RETURN '[]'::jsonb; END IF;

    -- 2. People count (Recursivo)
    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    -- 3. Construir lista de niveles con metas y porcentajes
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
            'rank_percentage', COALESCE((v_profile.rank_config->>( 'N' || rm.level_number ))::NUMERIC, 0), -- USAR rank_config
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. MOTOR DE CIERRE MENSUAL (REPARADO COHERENTE)
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_percent_global NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_user RECORD;
    v_milestone RECORD;
    v_personal_bonus NUMERIC;
    v_royalties_total NUMERIC;
    v_current_percentage NUMERIC;
    v_total_to_pay NUMERIC;
    v_setting_val TEXT;
BEGIN
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    v_percent_global := COALESCE(v_setting_val::NUMERIC, 15);
    
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    FOR v_user IN 
        SELECT p.id, p.current_rank, p.monthly_pv, p.monthly_pvg,
               r.royalties_config, r.personal_bonus_percentage
        FROM profiles p
        LEFT JOIN ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
        WHERE p.monthly_pv > 0 OR p.monthly_pvg > 0
    LOOP
        v_personal_bonus := 0;
        v_royalties_total := 0;

        v_current_percentage := COALESCE(v_user.personal_bonus_percentage, 0);
        IF v_current_percentage <= 0 THEN v_current_percentage := v_percent_global; END IF;
        v_personal_bonus := (v_user.monthly_pv * v_current_percentage / 100.0);

        IF v_user.royalties_config IS NOT NULL THEN
            FOR v_milestone IN SELECT * FROM royalty_milestones ORDER BY level_number ASC LOOP
                IF v_user.monthly_pvg >= v_milestone.min_pvg AND v_user.monthly_pv >= COALESCE(v_milestone.min_monthly_pv, 0) THEN
                    v_current_percentage := COALESCE((v_user.royalties_config->>( 'N' || v_milestone.level_number ))::NUMERIC, 0);
                    IF v_current_percentage > 0 THEN
                        v_royalties_total := v_royalties_total + (v_user.monthly_pvg * v_current_percentage / 100.0);
                    END IF;
                END IF;
            END LOOP;
        END IF;

        v_total_to_pay := v_personal_bonus + v_royalties_total;

        IF v_total_to_pay > 0 THEN
            INSERT INTO user_monthly_bonuses (user_id, period_month, period_year, pv_amount, percentage, bonus_amount)
            VALUES (v_user.id, v_month, v_year, v_user.monthly_pv, 0, v_total_to_pay)
            ON CONFLICT (user_id, period_month, period_year) DO UPDATE 
            SET bonus_amount = EXCLUDED.bonus_amount;
            v_count := v_count + 1;
        END IF;
    END LOOP;

    UPDATE profiles SET monthly_pv = 0, monthly_pvg = 0, active_directs_count = 0;

    RETURN jsonb_build_object('success', true, 'processed_users', v_count, 'period', v_month::text || '/' || v_year::text, 'at', NOW());
END;
$$;

-- 4. PERMISOS EXPLÍCITOS
GRANT EXECUTE ON FUNCTION public.get_user_royalty_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_royalty_status(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO authenticated;
