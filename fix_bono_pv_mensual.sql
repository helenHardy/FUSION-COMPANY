
-- 1. TABLA PARA CONFIGURACIÓN GLOBAL DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar porcentaje inicial (15%)
INSERT INTO public.system_settings (key, value, description)
VALUES ('monthly_pv_bonus_percent', '15', 'Porcentaje para el Bono de PV Mensual')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. REGISTRO DE BONOS POR PV MENSUAL (HISTÓRICO)
CREATE TABLE IF NOT EXISTS public.user_monthly_bonuses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- 3. FUNCIÓNRPC: OBTENER LISTA DE BONOS MENSUALES DISPONIBLES
CREATE OR REPLACE FUNCTION public.get_user_monthly_bonuses(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Validación defensiva
    IF p_user_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT jsonb_agg(sub.item) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', b.id,
            'period', concat(b.period_month, '/', b.period_year),
            'month', b.period_month,
            'year', b.period_year,
            'pv_amount', b.pv_amount,
            'percentage', b.percentage,
            'bonus_amount', b.bonus_amount,
            'is_claimed', b.is_claimed,
            'claimed_at', b.claimed_at
        ) as item
        FROM public.user_monthly_bonuses b
        WHERE b.user_id = p_user_id
        ORDER BY b.period_year DESC, b.period_month DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNCIÓN RPC: COBRAR BONO DE UN MES ESPECÍFICO
CREATE OR REPLACE FUNCTION public.claim_monthly_bonus(p_bonus_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_bonus RECORD;
    v_user_id UUID;
BEGIN
    -- 1. Obtener el bono y verificar pertenencia (Security Check)
    v_user_id := auth.uid();
    SELECT * INTO v_bonus FROM public.user_monthly_bonuses WHERE id = p_bonus_id;

    IF v_bonus IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Bono no encontrado.');
    END IF;

    IF v_bonus.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permiso para cobrar este bono.');
    END IF;

    IF v_bonus.is_claimed THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este bono ya ha sido cobrado.');
    END IF;

    -- 2. Registrar en commissions
    INSERT INTO public.commissions (
        beneficiary_id,
        amount,
        commission_type,
        level_depth,
        created_at
    ) VALUES (
        v_bonus.user_id,
        v_bonus.bonus_amount,
        'bono_pv_mensual',
        0,
        NOW()
    );

    -- 3. Actualizar balance de ganancias
    UPDATE public.profiles
    SET total_earnings = total_earnings + v_bonus.bonus_amount
    WHERE id = v_bonus.user_id;

    -- 4. Marcar bono como cobrado
    UPDATE public.user_monthly_bonuses
    SET is_claimed = TRUE,
        claimed_at = NOW()
    WHERE id = p_bonus_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', '¡Bono mensual cobrado con éxito!', 
        'amount', v_bonus.bonus_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCIÓN DE CIERRE MENSUAL CONSOLIDADO (SNAPSHOT Y RESET)
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
BEGIN
    -- A. Obtener configuración del bono personal
    SELECT value INTO v_setting_val FROM system_settings WHERE key = 'monthly_pv_bonus_percent';
    v_percent_personal := COALESCE(v_setting_val::NUMERIC, 15);
    
    -- B. Determinar periodo
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- C. Procesar cada usuario que tuvo actividad este mes
    -- Recorremos perfiles que sumaron puntos o volumen grupal este mes
    FOR v_user IN 
        SELECT p.*, r.royalties_config 
        FROM profiles p
        LEFT JOIN ranks r ON LOWER(TRIM(p.current_rank)) = LOWER(TRIM(r.name))
        WHERE p.monthly_pv > 0 OR p.monthly_pvg > 0
    LOOP
        v_royalties_total := 0;

        -- 1. Calcular tamaño de la red para requisitos de metas
        WITH RECURSIVE downline AS (
            SELECT id FROM public.profiles WHERE sponsor_id = v_user.id
            UNION ALL
            SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
        )
        SELECT COUNT(*)::INTEGER INTO v_count FROM downline; -- Reutilizamos v_count temporalmente para red

        -- 2. Calcular Bono PV Personal (Personal %)
        IF v_user.monthly_pv > 0 THEN
            v_personal_bonus := (v_user.monthly_pv * v_percent_personal / 100.0);
        END IF;

        -- 3. Calcular Regalías por Metas alcanzadas (Niveles) usando PVG MENSUAL
        IF v_user.royalties_config IS NOT NULL AND v_user.royalties_config != '{}'::jsonb THEN
            FOR v_milestone IN SELECT * FROM royalty_milestones ORDER BY level_number ASC LOOP
                -- ¿Cumple requisitos de la meta? (Gente + PVG + PV)
                IF v_count >= v_milestone.min_people AND
                   v_user.monthly_pvg >= v_milestone.min_pvg AND 
                   v_user.monthly_pv >= v_milestone.min_monthly_pv THEN
                   
                    -- Buscar porcentaje para este nivel en su rango
                    v_percentage := COALESCE((v_user.royalties_config->>( 'N' || v_milestone.level_number ))::NUMERIC, 0);
                   
                    IF v_percentage > 0 THEN
                        v_royalties_total := v_royalties_total + (v_user.monthly_pvg * v_percentage / 100.0);
                    END IF;
                END IF;
            END LOOP;
        END IF;

        v_total_bonus := v_personal_bonus + v_royalties_total;

        -- 3. Si hay bono, registrarlo en la tabla histórica
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

    -- D. REINICIO DE CONTADORES MENSUALES (Vital para el siguiente mes)
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

-- 6. SEGURIDAD RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura para todos" ON public.system_settings;
CREATE POLICY "Lectura para todos" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo admins editan settings" ON public.system_settings;
CREATE POLICY "Solo admins editan settings" ON public.system_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Usuarios ven sus propios bonos" ON public.user_monthly_bonuses;
CREATE POLICY "Usuarios ven sus propios bonos" ON public.user_monthly_bonuses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins ven todos los bonos" ON public.user_monthly_bonuses;
CREATE POLICY "Admins ven todos los bonos" ON public.user_monthly_bonuses FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7. GRANTS
GRANT SELECT ON public.system_settings TO authenticated, anon;
GRANT INSERT, UPDATE ON public.system_settings TO authenticated; -- RLS filtrará por admin

GRANT SELECT ON public.user_monthly_bonuses TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_monthly_bonuses(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_monthly_bonus(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_monthly_closing() TO authenticated;
