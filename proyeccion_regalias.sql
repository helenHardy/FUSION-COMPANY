
-- FUNCIÓN PARA CALCULAR REGALÍAS POTENCIALES (PROYECCIÓN)

CREATE OR REPLACE FUNCTION public.get_potential_royalties(p_user_id UUID)
RETURNS TABLE (
    level_number INTEGER,
    total_volume NUMERIC,
    percentage NUMERIC,
    potential_commission NUMERIC
) AS $$
DECLARE
    v_rank_record RECORD;
    v_user_record RECORD;
BEGIN
    -- 1. Obtener info del usuario y su rango
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_user_record.current_rank;

    IF v_rank_record.id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Calcular volumen por nivel recursivamente (hasta nivel 10)
    RETURN QUERY
    WITH RECURSIVE network_levels AS (
        -- Nivel 1: Hijos directos
        SELECT id, sponsor_id, monthly_pv, 1 as lvl
        FROM public.profiles
        WHERE sponsor_id = p_user_id

        UNION ALL

        -- Niveles 2 al 10: Hijos de los hijos
        SELECT p.id, p.sponsor_id, p.monthly_pv, nl.lvl + 1
        FROM public.profiles p
        JOIN network_levels nl ON p.sponsor_id = nl.id
        WHERE nl.lvl < 10
    )
    SELECT 
        nl.lvl as level_number,
        SUM(nl.monthly_pv) as total_volume,
        COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) as percentage,
        (SUM(nl.monthly_pv) * COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) / 100) as potential_commission
    FROM network_levels nl
    GROUP BY nl.lvl
    ORDER BY nl.lvl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_potential_royalties(UUID) TO authenticated;
