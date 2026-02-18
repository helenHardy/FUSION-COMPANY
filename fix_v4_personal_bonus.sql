-- 1. Redefinir la función get_user_royalty_status con depuración extrema y soporte para bono personal por rango
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
        r.royalties_config as rank_config,
        r.personal_bonus_percentage as rank_personal_bonus
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
            'rank_personal_bonus', COALESCE(v_profile.rank_personal_bonus, 0),
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


-- 2. FUNCIÓN DE CIERRE MENSUAL CONSOLIDADO (SNAPSHOT Y RESET)
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_percent_global NUMERIC;
    v_percent_to_use NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
    v_user RECORD;
    v_total_bonus NUMERIC;
    v_personal_bonus NUMERIC;
    v_royalties_total NUMERIC;
    v_milestone RECORD;
    v_percentage_level NUMERIC;
    v_setting_val TEXT;
BEGIN
    -- A. Obtener configuración global por si un rango tiene 0
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    v_percent_global := COALESCE(v_setting_val::NUMERIC, 15);
    
    -- B. Determinar periodo
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- C. Procesar cada usuario que tuvo actividad este mes
    FOR v_user IN 
        SELECT p.*, r.royalties_config, r.personal_bonus_percentage 
        FROM profiles p
        LEFT JOIN ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
        WHERE p.monthly_pv > 0 OR p.monthly_pvg > 0
    LOOP
        v_royalties_total := 0;
        v_personal_bonus := 0;

        -- 1. Calcular tamaño de la red para requisitos de metas
        WITH RECURSIVE downline AS (
            SELECT id FROM public.profiles WHERE sponsor_id = v_user.id
            UNION ALL
            SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
        )
        SELECT COUNT(*)::INTEGER INTO v_count FROM downline; -- Reutilizamos v_count temporalmente para red

        -- 2. Calcular Bono PV Personal (Usar rango si existe y es > 0, si no, usar global)
        v_percent_to_use := COALESCE(v_user.personal_bonus_percentage, 0);
        IF v_percent_to_use <= 0 THEN
            v_percent_to_use := v_percent_global;
        END IF;

        IF v_user.monthly_pv > 0 THEN
            v_personal_bonus := (v_user.monthly_pv * v_percent_to_use / 100.0);
        END IF;

        -- 3. Calcular Regalías por Metas alcanzadas (Niveles) usando PVG MENSUAL
        IF v_user.royalties_config IS NOT NULL AND v_user.royalties_config != '{}'::jsonb THEN
            FOR v_milestone IN SELECT * FROM royalty_milestones ORDER BY level_number ASC LOOP
                -- ¿Cumple requisitos de la meta? (Gente + PVG + PV)
                IF v_count >= v_milestone.min_people AND
                   v_user.monthly_pvg >= v_milestone.min_pvg AND 
                   v_user.monthly_pv >= v_milestone.min_monthly_pv THEN
                   
                    -- Buscar porcentaje para este nivel en su rango
                    v_percentage_level := COALESCE((v_user.royalties_config->>( 'N' || v_milestone.level_number ))::NUMERIC, 0);
                   
                    IF v_percentage_level > 0 THEN
                        v_royalties_total := v_royalties_total + (v_user.monthly_pvg * v_percentage_level / 100.0);
                    END IF;
                END IF;
            END LOOP;
        END IF;

        v_total_bonus := v_personal_bonus + v_royalties_total;

        -- 4. Si hay bono, registrarlo en la tabla histórica
        IF v_total_bonus > 0 THEN
            INSERT INTO public.user_monthly_bonuses (
                user_id, period_month, period_year, pv_amount, 
                percentage, bonus_amount, created_at
            ) VALUES (
                v_user.id, v_month, v_year, v_user.monthly_pv, 
                v_percent_to_use, v_total_bonus, NOW()
            )
            ON CONFLICT (user_id, period_month, period_year) 
            DO UPDATE SET bonus_amount = EXCLUDED.bonus_amount, percentage = EXCLUDED.percentage;
        END IF;
    END LOOP;

    -- D. REINICIO DE CONTADORES MENSUALES
    -- Nota: Aquí podrías querer contar los procesados reales antes del reset
    SELECT COUNT(*) INTO v_count FROM profiles WHERE monthly_pv > 0 OR monthly_pvg > 0;

    UPDATE public.profiles
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
