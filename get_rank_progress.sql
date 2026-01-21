
-- RPC PARA CONSULTAR PROGRESO ESTRUCTURAL DE RANGO
-- Devuelve cuántas ramas del usuario tienen al menos un socio con el rango buscado

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
        SELECT 1 FROM downline WHERE current_rank = p_target_rank
    );
    
    RETURN v_branch_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
