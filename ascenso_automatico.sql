
-- SISTEMA DE ASCENSO AUTOMÁTICO DE RANGOS

CREATE OR REPLACE FUNCTION public.check_rank_promotion(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_record RECORD;
    v_next_rank RECORD;
    v_structure_met BOOLEAN := TRUE;
    v_branch_count INTEGER := 0;
BEGIN
    -- 1. Obtener info actual del usuario
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;

    -- 2. Buscar el siguiente rango en el orden
    SELECT * INTO v_next_rank 
    FROM public.ranks 
    WHERE order_index > (SELECT order_index FROM public.ranks WHERE name = v_user_record.current_rank)
    ORDER BY order_index ASC 
    LIMIT 1;

    -- Si no hay más rangos, terminar
    IF v_next_rank IS NULL THEN RETURN; END IF;

    -- 3. Verificar Requisitos Numéricos (Puntos)
    IF v_user_record.pv < v_next_rank.min_pv OR v_user_record.pvg < v_next_rank.min_pvg THEN
        RETURN;
    END IF;

    -- 4. Verificar Requisitos Estructurales (Rangos inferiores)
    -- Ejemplo: "Necesitas 2 Platas en ramas distintas"
    IF v_next_rank.required_downline_rank IS NOT NULL AND v_next_rank.required_downline_count > 0 THEN
        
        -- Contamos en cuántas RAMAS distintas hay al menos un socio del rango requerido
        -- Buscamos en toda la red de descendientes directa del usuario
        SELECT COUNT(DISTINCT child.id) INTO v_branch_count
        FROM public.profiles child
        WHERE child.sponsor_id = p_user_id
        AND EXISTS (
            -- Verificamos si en la descendencia de ese hijo existe alguien con el rango requerido
            -- Para simplificar, buscamos si el hijo o alguien abajo de él es del rango
            WITH RECURSIVE downline AS (
                SELECT id, current_rank FROM public.profiles WHERE id = child.id
                UNION ALL
                SELECT p.id, p.current_rank FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
            )
            SELECT 1 FROM downline WHERE current_rank = v_next_rank.required_downline_rank
        );

        IF v_branch_count < v_next_rank.required_downline_count THEN
            v_structure_met := FALSE;
        END IF;
    END IF;

    -- 5. SI CUMPLE TODO -> ASCENDER
    IF v_structure_met THEN
        UPDATE public.profiles 
        SET current_rank = v_next_rank.name 
        WHERE id = p_user_id;
        
        -- Recursivo: Verificar si puede subir al siguiente inmediatamente
        PERFORM public.check_rank_promotion(p_user_id);
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
