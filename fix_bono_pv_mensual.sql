
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

-- 5. FUNCIÓN DE CIERRE MENSUAL (SNAPSHOT Y RESET)
CREATE OR REPLACE FUNCTION public.execute_monthly_closing()
RETURNS JSONB AS $$
DECLARE
    v_percent NUMERIC;
    v_month INTEGER;
    v_year INTEGER;
    v_count INTEGER := 0;
BEGIN
    -- Obtener porcentaje configurado (default 15 si no existe)
    SELECT COALESCE(value::NUMERIC, 15) INTO v_percent FROM public.system_settings WHERE key = 'monthly_pv_bonus_percent';
    
    -- Determinar el periodo (Mes actual)
    v_month := EXTRACT(MONTH FROM NOW())::INTEGER;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- 1. Snapshot de bonos para usuarios con PV > 0
    INSERT INTO public.user_monthly_bonuses (user_id, period_month, period_year, pv_amount, percentage, bonus_amount)
    SELECT 
        id, 
        v_month, 
        v_year, 
        monthly_pv, 
        v_percent, 
        (monthly_pv * v_percent / 100)
    FROM public.profiles
    WHERE monthly_pv > 0
    ON CONFLICT (user_id, period_month, period_year) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 2. Reiniciar contadores del mes
    UPDATE public.profiles
    SET monthly_pv = 0,
        active_directs_count = 0;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_users', v_count, 
        'period', v_month || '/' || v_year,
        'closing_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
