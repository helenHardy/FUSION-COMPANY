
-- 1. CONFIGURACIÓN-- 1. ESTRUCTURA DE METAS DE REGALÍAS
CREATE TABLE IF NOT EXISTS public.royalty_milestones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level_number INTEGER UNIQUE NOT NULL,
    min_people INTEGER NOT NULL DEFAULT 0,
    min_pvg NUMERIC(15, 2) NOT NULL DEFAULT 0,
    min_monthly_pv NUMERIC(15, 2) NOT NULL DEFAULT 100, -- Nuevo requisito
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que la columna existe si la tabla ya fue creada
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='royalty_milestones' AND column_name='min_monthly_pv') THEN
        ALTER TABLE public.royalty_milestones ADD COLUMN min_monthly_pv NUMERIC(15, 2) NOT NULL DEFAULT 100;
    END IF;
END $$;

-- 2. REGISTRO DE COBROS REALIZADOS (PARA EVITAR DOBLE COBRO)
CREATE TABLE IF NOT EXISTS public.user_royalty_claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    level_number INTEGER NOT NULL,
    amount_paid NUMERIC(15, 2) NOT NULL,
    pvg_at_claim NUMERIC(15, 2) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, level_number)
);

-- 3. INSERTAR CONFIGURACIÓN INICIAL (10 NIVELES)
INSERT INTO public.royalty_milestones (level_number, min_people, min_pvg) VALUES
(1, 5, 500),
(2, 25, 2500),
(3, 125, 12500),
(4, 625, 62500),
(5, 3125, 312500),
(6, 15625, 1562500),
(7, 78125, 7812500),
(8, 390625, 39062500),
(9, 1953125, 195312500),
(10, 9765625, 976562500)
ON CONFLICT (level_number) DO UPDATE SET 
    min_people = EXCLUDED.min_people,
    min_pvg = EXCLUDED.min_pvg;

-- 4. FUNCIÓN PARA OBTENER EL ESTADO DE REGALÍAS DE UN USUARIO (USADA POR EL FRONTEND)
CREATE OR REPLACE FUNCTION public.get_user_royalty_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_total_downline INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 1. Obtener datos del perfil (con manejo de nulos)
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- 2. Calcular total de personas en la red (recursivo)
    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    -- 3. Construir JSON con el estado de cada nivel (Ordenado correctamente)
    SELECT jsonb_agg(sub.item) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'level_number', rm.level_number,
            'min_people', rm.min_people,
            'min_pvg', rm.min_pvg,
            'min_monthly_pv', rm.min_monthly_pv,
            'current_people', v_total_downline,
            'current_pvg', COALESCE(v_profile.pvg, 0),
            'current_monthly_pv', COALESCE(v_profile.monthly_pv, 0),
            'is_unlocked', (
                v_total_downline >= rm.min_people 
                AND COALESCE(v_profile.pvg, 0) >= rm.min_pvg
                AND COALESCE(v_profile.monthly_pv, 0) >= rm.min_monthly_pv
            ),
            'is_claimed', EXISTS (SELECT 1 FROM public.user_royalty_claims urc WHERE urc.user_id = p_user_id AND urc.level_number = rm.level_number),
            'claimed_at', (SELECT claimed_at FROM public.user_royalty_claims urc WHERE urc.user_id = p_user_id AND urc.level_number = rm.level_number)
        ) as item
        FROM public.royalty_milestones rm
        ORDER BY rm.level_number ASC
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCIÓN PARA COBRAR UN NIVEL DE REGALÍA
CREATE OR REPLACE FUNCTION public.claim_royalty_level(
    p_user_id UUID,
    p_level INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_rank RECORD;
    v_milestone RECORD;
    v_total_downline INTEGER;
    v_percentage NUMERIC;
    v_payout NUMERIC;
    v_claim_id UUID;
BEGIN
    -- 1. Validaciones básicas
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank FROM public.ranks WHERE name ILIKE v_profile.current_rank;
    SELECT * INTO v_milestone FROM public.royalty_milestones WHERE level_number = p_level;

    IF v_milestone IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'El nivel especificado no existe.');
    END IF;

    -- 2. Verificar si ya se cobró
    IF EXISTS (SELECT 1 FROM public.user_royalty_claims WHERE user_id = p_user_id AND level_number = p_level) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este nivel ya ha sido cobrado.');
    END IF;

    -- 3. Verificar requisitos
    WITH RECURSIVE downline AS (
        SELECT id FROM public.profiles WHERE sponsor_id = p_user_id
        UNION ALL
        SELECT p.id FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
    )
    SELECT COUNT(*) INTO v_total_downline FROM downline;

    IF v_total_downline < v_milestone.min_people OR v_profile.pvg < v_milestone.min_pvg OR v_profile.monthly_pv < v_milestone.min_monthly_pv THEN
        RETURN jsonb_build_object('success', false, 'message', 'No cumples con los requisitos de personas, PVG o PV Mensual para este nivel.');
    END IF;

    -- 4. Calcular porcentaje según Rango y Nivel
    -- El porcentaje se saca de royalties_config del rango actual {"N1": 5, "N2": 5...}
    v_percentage := (v_rank.royalties_config->>( 'N' || p_level ))::NUMERIC;

    IF v_percentage IS NULL OR v_percentage <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Tu rango actual no tiene beneficios configurados para este nivel.');
    END IF;

    -- 5. Calcular Pago y Registrar
    v_payout := (v_profile.pvg * v_percentage) / 100;

    -- Insertar en tabla de cobros
    INSERT INTO public.user_royalty_claims (user_id, level_number, amount_paid, pvg_at_claim)
    VALUES (p_user_id, p_level, v_payout, v_profile.pvg)
    RETURNING id INTO v_claim_id;

    -- Registrar como comisión
    INSERT INTO public.commissions (
        beneficiary_id, amount, commission_type, level_depth, created_at
    ) VALUES (
        p_user_id, v_payout, 'regalia', p_level, NOW()
    );

    -- Actualizar balance del usuario
    UPDATE public.profiles 
    SET total_earnings = total_earnings + v_payout
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', '¡Bono cobrado con éxito!', 
        'amount', v_payout,
        'claim_id', v_claim_id
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. POLÍTICAS RLS (Seguridad)
ALTER TABLE public.royalty_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_royalty_claims ENABLE ROW LEVEL SECURITY;

-- Permisos para hilos de metas
DROP POLICY IF EXISTS "Lectura pública de metas" ON public.royalty_milestones;
CREATE POLICY "Lectura pública de metas" ON public.royalty_milestones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins gestionan metas" ON public.royalty_milestones;
CREATE POLICY "Admins gestionan metas" ON public.royalty_milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Permisos para cobros
DROP POLICY IF EXISTS "Usuarios ven sus propios cobros" ON public.user_royalty_claims;
CREATE POLICY "Usuarios ven sus propios cobros" ON public.user_royalty_claims FOR SELECT USING (auth.uid() = user_id);

-- 7. GRANTS (Permisos de acceso API - CRÍTICO para evitar 403)
GRANT SELECT ON public.royalty_milestones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.royalty_milestones TO authenticated;
GRANT ALL ON public.royalty_milestones TO service_role;

GRANT SELECT ON public.user_royalty_claims TO authenticated;
GRANT ALL ON public.user_royalty_claims TO service_role;

-- Dar permisos a las funciones RPC
GRANT EXECUTE ON FUNCTION public.get_user_royalty_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_royalty_level(UUID, INTEGER) TO authenticated;

-- 8. Asegurar políticas RLS para escritura administrativa
DROP POLICY IF EXISTS "Admins gestionan metas" ON public.royalty_milestones;
CREATE POLICY "Admins gestionan metas" ON public.royalty_milestones 
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
