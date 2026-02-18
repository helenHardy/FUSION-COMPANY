
-- MASTER SCRIPT: SINCRONIZACIÓN TOTAL DE RANGOS Y REGALÍAS V4
-- Autor: Sistema AI
-- Objetivo: Asegurar que el Dashboard y el Cierre Mensual calculen EXACTAMENTE lo mismo.

-- 1. LIMPIEZA DE DATOS (Standardization)
UPDATE public.ranks SET name = TRIM(name);
UPDATE public.profiles SET current_rank = TRIM(current_rank);

-- 2. TRIGGER DE ASCENSO ROBUSTO (Para el futuro)
CREATE OR REPLACE FUNCTION public.check_rank_promotion()
RETURNS TRIGGER AS $$
DECLARE
    v_new_rank TEXT;
BEGIN
    -- Buscar el rango más alto (ignorando mayúsculas/espacios en la comparación por seguridad)
    SELECT name INTO v_new_rank
    FROM public.ranks
    WHERE NEW.pv >= min_pv AND NEW.pvg >= min_pvg
    ORDER BY order_index DESC
    LIMIT 1;

    -- Actualizar solo si cambia y guardar el nombre EXACTO de la tabla ranks
    IF v_new_rank IS NOT NULL AND (OLD.current_rank IS NULL OR LOWER(TRIM(OLD.current_rank)) != LOWER(TRIM(v_new_rank))) THEN
        NEW.current_rank := v_new_rank;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC VISUALIZACIÓN (Dashboard) - Con Depuración y Robustez
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    SELECT 
        p.id, p.current_rank, p.monthly_pv, p.monthly_pvg,
        r.name as matched_rank_name,
        r.royalties_config as rank_config
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

-- 4. FUNCIÓN DE CIERRE MENSUAL (Dinero Real) - Sincronizada
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
    v_network_size INTEGER;
BEGIN
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    v_percent_personal := COALESCE(v_setting_val::NUMERIC, 15);
    
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    FOR v_user IN 
        SELECT p.*, r.royalties_config 
        FROM profiles p
        LEFT JOIN ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
        WHERE p.monthly_pv > 0 OR p.monthly_pvg > 0
    LOOP
        v_royalties_total := 0;

        WITH RECURSIVE downline AS (
            SELECT id FROM public.profiles WHERE sponsor_id = v_user.id
            UNION ALL
            SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
        )
        SELECT COUNT(*)::INTEGER INTO v_network_size FROM downline;

        IF v_user.monthly_pv > 0 THEN
            v_personal_bonus := (v_user.monthly_pv * v_percent_personal / 100.0);
        ELSE
            v_personal_bonus := 0;
        END IF;

        IF v_user.royalties_config IS NOT NULL AND v_user.royalties_config != '{}'::jsonb THEN
            FOR v_milestone IN SELECT * FROM royalty_milestones ORDER BY level_number ASC LOOP
                IF v_network_size >= v_milestone.min_people AND
                   v_user.monthly_pvg >= v_milestone.min_pvg AND 
                   v_user.monthly_pv >= v_milestone.min_monthly_pv THEN
                   
                    v_percentage := COALESCE((v_user.royalties_config->>( 'N' || v_milestone.level_number ))::NUMERIC, 0);
                   
                    IF v_percentage > 0 THEN
                        v_royalties_total := v_royalties_total + (v_user.monthly_pvg * v_percentage / 100.0);
                    END IF;
                END IF;
            END LOOP;
        END IF;

        v_total_bonus := v_personal_bonus + v_royalties_total;

        IF v_total_bonus > 0 THEN
            INSERT INTO public.user_monthly_bonuses (
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

    UPDATE public.profiles
    SET monthly_pv = 0,
        monthly_pvg = 0,
        active_directs_count = 0;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_users', v_count, 
        'period', v_month::text || '/' || v_year::text
    );
END;
$$;
