
-- SISTEMA DE RANGOS Y CALIFICACIONES AUTOMÁTICAS

-- 1. Crear tabla de Rangos
CREATE TABLE IF NOT EXISTS public.ranks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    min_pv NUMERIC(10, 2) DEFAULT 0,  -- Requisito PV personal
    min_pvg NUMERIC(10, 2) DEFAULT 0, -- Requisito PV de red (grupal)
    order_index INTEGER UNIQUE,       -- Orden de los rangos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insertar Rangos por Defecto (Ejemplo ajustable por admin)
INSERT INTO public.ranks (name, min_pv, min_pvg, order_index) VALUES
('Básico', 0, 0, 1),
('Bronce', 50, 500, 2),
('Plata', 100, 2000, 3),
('Oro', 200, 5000, 4),
('Platino', 400, 15000, 5),
('Diamante', 800, 50000, 6)
ON CONFLICT (name) DO UPDATE SET 
    min_pv = EXCLUDED.min_pv, 
    min_pvg = EXCLUDED.min_pvg,
    order_index = EXCLUDED.order_index;

-- 3. Función para verificar y ascender de rango
CREATE OR REPLACE FUNCTION public.check_rank_promotion()
RETURNS TRIGGER AS $$
DECLARE
    v_new_rank TEXT;
BEGIN
    -- Buscar el rango más alto cuyos requisitos cumpla el usuario
    SELECT name INTO v_new_rank
    FROM public.ranks
    WHERE NEW.pv >= min_pv AND NEW.pvg >= min_pvg
    ORDER BY order_index DESC
    LIMIT 1;

    -- Si el rango calculado es diferente al actual, actualizar
    IF v_new_rank IS NOT NULL AND (OLD.current_rank IS NULL OR OLD.current_rank != v_new_rank) THEN
        NEW.current_rank := v_new_rank;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para disparar el ascenso automático
DROP TRIGGER IF EXISTS trigger_rank_promotion ON public.profiles;
CREATE TRIGGER trigger_rank_promotion
BEFORE UPDATE OF pv, pvg ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_rank_promotion();

-- Asegurar permisos
GRANT ALL ON public.ranks TO authenticated;
GRANT ALL ON public.ranks TO service_role;
