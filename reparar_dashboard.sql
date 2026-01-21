
-- REPARACIÓN FINAL DE BASE DE DATOS Y RANGOS

-- 1. Asegurar que la función de proyecciones exista
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
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_user_record.current_rank;

    IF v_rank_record.id IS NULL THEN
        -- Si el rango no existe, buscamos el de menor nivel (posicion 1)
        SELECT * INTO v_rank_record FROM public.ranks ORDER BY order_index ASC LIMIT 1;
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
        SUM(nl.monthly_pv) as total_volume,
        COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) as percentage,
        (SUM(nl.monthly_pv) * COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) / 100) as potential_commission
    FROM network_levels nl
    GROUP BY nl.lvl
    ORDER BY nl.lvl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_potential_royalties(UUID) TO authenticated;

-- 2. Corregir rangos de los usuarios
-- Si un usuario tiene un rango que ya no existe (ej: "Bronce" vs "Bronce Test"),
-- lo reiniciamos al rango base disponible para que no explote la interfaz.

UPDATE public.profiles
SET current_rank = (SELECT name FROM public.ranks ORDER BY order_index ASC LIMIT 1)
WHERE current_rank NOT IN (SELECT name FROM public.ranks);
