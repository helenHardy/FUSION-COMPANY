-- 1. RPC PARA CONSULTAR PROGRESO ESTRUCTURAL DE RANGO (USADO POR DASHBOARD)
CREATE OR REPLACE FUNCTION public.get_structure_count(
    p_user_id UUID,
    p_target_rank TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_branch_count INTEGER := 0;
BEGIN
    SELECT COUNT(DISTINCT child.id) INTO v_branch_count
    FROM public.profiles child
    WHERE child.sponsor_id = p_user_id
    AND EXISTS (
        WITH RECURSIVE downline AS (
            SELECT id, current_rank FROM public.profiles WHERE id = child.id
            UNION ALL
            SELECT p.id, p.current_rank FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
        )
        SELECT 1 FROM downline WHERE current_rank ILIKE p_target_rank
    );
    
    RETURN v_branch_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ACTUALIZAR SCHEMA DE RANGOS PARA SOPORTAR MÚLTIPLES REQUISITOS
ALTER TABLE public.ranks ADD COLUMN IF NOT EXISTS structure_requirements JSONB DEFAULT '[]';

-- 2. REFACTORIZAR FUNCIÓN PARA REVISAR MÚLTIPLES RAMAS INDEPENDIENTES
CREATE OR REPLACE FUNCTION public.verify_multiple_structures(
    p_user_id UUID,
    p_requirements JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_req RECORD;
    v_current_count INTEGER;
    v_met BOOLEAN := TRUE;
BEGIN
    IF p_requirements IS NULL OR jsonb_array_length(p_requirements) = 0 THEN
        RETURN TRUE;
    END IF;

    FOR v_req IN SELECT * FROM jsonb_to_recordset(p_requirements) AS x(rank TEXT, count INTEGER) LOOP
        SELECT COUNT(DISTINCT child.id) INTO v_current_count
        FROM public.profiles child
        WHERE child.sponsor_id = p_user_id
        AND EXISTS (
            WITH RECURSIVE downline AS (
                SELECT id, current_rank FROM public.profiles WHERE id = child.id
                UNION ALL
                SELECT p.id, p.current_rank FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
            )
            SELECT 1 FROM downline WHERE current_rank ILIKE v_req.rank
        );

        IF v_current_count < v_req.count THEN
            v_met := FALSE;
            EXIT;
        END IF;
    END LOOP;

    RETURN v_met;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFACTORIZAR ASCENSO DE RANGO
CREATE OR REPLACE FUNCTION public.check_rank_promotion(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_record RECORD;
    v_next_rank RECORD;
    v_structure_met BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    
    SELECT * INTO v_next_rank FROM public.ranks 
    WHERE order_index > (SELECT order_index FROM public.ranks WHERE name ILIKE v_user_record.current_rank)
    ORDER BY order_index ASC LIMIT 1;

    IF v_next_rank IS NULL THEN RETURN; END IF;

    IF v_user_record.pv < v_next_rank.min_pv OR v_user_record.pvg < v_next_rank.min_pvg THEN
        RETURN;
    END IF;

    IF v_user_record.active_directs_count < v_next_rank.min_active_directs THEN
        RETURN;
    END IF;

    v_structure_met := public.verify_multiple_structures(p_user_id, v_next_rank.structure_requirements);

    IF v_structure_met THEN
        UPDATE public.profiles
        SET current_rank = v_next_rank.name
        WHERE id = p_user_id;
        
        PERFORM public.check_rank_promotion(p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CONFIGURAR RANGOS SEGÚN ÚLTIMOS REQUERIMIENTOS
TRUNCATE public.ranks RESTART IDENTITY CASCADE;

INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, structure_requirements, royalties_config) VALUES
('Básico', 1, 0, 0, 0, 100, '[]', '{}'),
('Bronce', 2, 0, 1000, 2, 100, '[]', '{"N1": 5}'),
('Plata', 3, 0, 3000, 3, 100, '[{"rank": "Bronce", "count": 2}]', '{"N1": 5}'),
('Oro', 4, 0, 10000, 4, 100, '[{"rank": "Plata", "count": 1}]', '{"N1": 5, "N2": 5}'),
('Platino', 5, 100, 20500, 5, 100, '[{"rank": "Oro", "count": 2}, {"rank": "Plata", "count": 1}]', '{"N1": 5, "N2": 5, "N3": 5}'),
('Ambar', 6, 100, 43000, 5, 100, '[{"rank": "Platino", "count": 1}, {"rank": "Oro", "count": 2}, {"rank": "Plata", "count": 2}]', '{"N1": 5, "N2": 5, "N3": 5, "N4": 3}'),
('Esmeralda', 7, 100, 150000, 6, 100, '[]', '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1}'),
('Diamante', 8, 100, 500000, 6, 100, '[]', '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1}'),
('Diamante Ejecutivo', 9, 100, 1500000, 8, 100, '[]', '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1, "N9": 1, "N10": 1}');
