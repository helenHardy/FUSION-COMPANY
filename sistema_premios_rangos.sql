-- SISTEMA DE PREMIOS POR RANGO

BEGIN;

-- 1. Agregar descripción del premio a la tabla de rangos
ALTER TABLE public.ranks 
ADD COLUMN IF NOT EXISTS reward_description TEXT;

-- 2. Crear tabla de solicitudes de premios
CREATE TABLE IF NOT EXISTS public.rank_reward_claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    rank_id UUID REFERENCES public.ranks(id) NOT NULL,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'entregado', 'rechazado')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE public.rank_reward_claims ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad
DROP POLICY IF EXISTS "Usuarios ven sus propios reclamos" ON public.rank_reward_claims;
CREATE POLICY "Usuarios ven sus propios reclamos" 
ON public.rank_reward_claims FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios crean sus propios reclamos" ON public.rank_reward_claims;
CREATE POLICY "Usuarios crean sus propios reclamos" 
ON public.rank_reward_claims FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins gestionan todos los reclamos" ON public.rank_reward_claims;
CREATE POLICY "Admins gestionan todos los reclamos" 
ON public.rank_reward_claims FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Función de ayuda para solicitar premio
CREATE OR REPLACE FUNCTION public.request_rank_reward(
    p_rank_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_rank_order INTEGER;
    v_target_rank_order INTEGER;
BEGIN
    -- Verificar que el usuario tenga el rango o superior
    SELECT order_index INTO v_user_rank_order 
    FROM public.ranks 
    WHERE name = (SELECT current_rank FROM public.profiles WHERE id = auth.uid());

    SELECT order_index INTO v_target_rank_order 
    FROM public.ranks 
    WHERE id = p_rank_id;

    IF v_user_rank_order < v_target_rank_order THEN
        RAISE EXCEPTION 'Aún no has alcanzado este rango para reclamar el premio.';
    END IF;

    -- Verificar si ya existe una solicitud para este rango
    IF EXISTS (SELECT 1 FROM public.rank_reward_claims WHERE user_id = auth.uid() AND rank_id = p_rank_id) THEN
        RAISE EXCEPTION 'Ya has solicitado el premio para este rango.';
    END IF;

    INSERT INTO public.rank_reward_claims (user_id, rank_id)
    VALUES (auth.uid(), p_rank_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grants
GRANT ALL ON public.rank_reward_claims TO authenticated;
GRANT ALL ON public.rank_reward_claims TO service_role;

COMMIT;
