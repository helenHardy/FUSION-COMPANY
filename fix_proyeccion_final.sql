
-- 1. ACTUALIZAR RANGOS SEGÚN IMÁGENES DEL USUARIO
-- Borrar y reinsertar para asegurar orden y limpieza
TRUNCATE public.ranks RESTART IDENTITY CASCADE;

INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, royalties_config) VALUES
('Básico', 1, 0, 0, 0, 100, '{}'),
('Bronce', 2, 0, 1000, 2, 100, '{"N1": 5}'),
('Plata', 3, 0, 3000, 3, 100, '{"N1": 5}'),
('Oro', 4, 0, 10000, 4, 100, '{"N1": 5, "N2": 5}'),
('Platino', 5, 0, 25000, 5, 100, '{"N1": 5, "N2": 5, "N3": 5}'),
('Ambar', 6, 0, 50000, 5, 100, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3}'),
('Esmeralda', 7, 0, 150000, 6, 100, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1}'),
('Diamante', 8, 0, 500000, 6, 100, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1}'),
('Diamante Ejecutivo', 9, 0, 1500000, 8, 100, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1, "N9": 1, "N10": 1}');

-- 2. ASEGURAR QUE LOS PERFILES COINCIDAN (Case Insensitive Fix)
UPDATE public.profiles SET current_rank = 'Básico' WHERE current_rank ILIKE 'básico';
UPDATE public.profiles SET current_rank = 'Bronce' WHERE current_rank ILIKE 'bronce';
UPDATE public.profiles SET current_rank = 'Plata' WHERE current_rank ILIKE 'plata';
UPDATE public.profiles SET current_rank = 'Oro' WHERE current_rank ILIKE 'oro';
UPDATE public.profiles SET current_rank = 'Platino' WHERE current_rank ILIKE 'platino';
UPDATE public.profiles SET current_rank = 'Ambar' WHERE current_rank ILIKE 'ambar';
UPDATE public.profiles SET current_rank = 'Esmeralda' WHERE current_rank ILIKE 'esmeralda';
UPDATE public.profiles SET current_rank = 'Diamante' WHERE current_rank ILIKE 'diamante';
UPDATE public.profiles SET current_rank = 'Diamante Ejecutivo' WHERE current_rank ILIKE 'diamante ejecutivo';

-- 3. REFACTORIZAR RPC DE PROYECCIÓN PARA INCLUIR CONTEO DE PERSONAS
DROP FUNCTION IF EXISTS public.get_potential_royalties(UUID);

CREATE OR REPLACE FUNCTION public.get_potential_royalties(p_user_id UUID)
RETURNS TABLE (
    level_number INTEGER,
    total_volume NUMERIC,
    percentage NUMERIC,
    potential_commission NUMERIC,
    user_count BIGINT
) AS $$
DECLARE
    v_rank_record RECORD;
    v_user_record RECORD;
BEGIN
    -- Obtener info del usuario y su rango (usando ILIKE para evitar fallos por mayúsculas)
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank_record FROM public.ranks WHERE name ILIKE v_user_record.current_rank;

    IF v_rank_record.id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH RECURSIVE network_levels AS (
        SELECT id, sponsor_id, monthly_pv, 1 as lvl
        FROM public.profiles
        WHERE sponsor_id = p_user_id

        UNION ALL

        SELECT p.id, p.sponsor_id, p.monthly_pv, nl.lvl + 1
        FROM public.profiles p
        JOIN network_levels nl ON p.sponsor_id = nl.id
        WHERE nl.lvl < 10
    )
    SELECT 
        nl.lvl as level_number,
        COALESCE(SUM(nl.monthly_pv), 0) as total_volume,
        COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) as percentage,
        (COALESCE(SUM(nl.monthly_pv), 0) * COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) / 100) as potential_commission,
        COUNT(nl.id) as user_count
    FROM network_levels nl
    GROUP BY nl.lvl
    ORDER BY nl.lvl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. REFACTORIZAR ASCENSO DE RANGO PARA SER ROBUSTO
CREATE OR REPLACE FUNCTION public.check_rank_promotion(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_record RECORD;
    v_next_rank RECORD;
    v_structure_met BOOLEAN := TRUE;
    v_branch_count INTEGER := 0;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    
    -- Buscar el siguiente rango (Case Insensitive)
    SELECT * INTO v_next_rank FROM public.ranks 
    WHERE order_index > (SELECT order_index FROM public.ranks WHERE name ILIKE v_user_record.current_rank)
    ORDER BY order_index ASC LIMIT 1;

    IF v_next_rank IS NULL THEN RETURN; END IF;

    -- Requisitos de puntos
    IF v_user_record.pv < v_next_rank.min_pv OR v_user_record.pvg < v_next_rank.min_pvg THEN
        RETURN;
    END IF;

    -- Requisitos de ramas (Estructura)
    IF v_next_rank.required_downline_rank IS NOT NULL AND v_next_rank.required_downline_count > 0 THEN
        v_branch_count := public.get_structure_count(p_user_id, v_next_rank.required_downline_rank);
        IF v_branch_count < v_next_rank.required_downline_count THEN
            v_structure_met := FALSE;
        END IF;
    END IF;

    IF v_structure_met THEN
        UPDATE public.profiles
        SET current_rank = v_next_rank.name
        WHERE id = p_user_id;
        
        PERFORM public.check_rank_promotion(p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
