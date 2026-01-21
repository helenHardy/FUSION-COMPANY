
-- 1. MEJORA DE FUNCIÓN DE PROYECCIONES (Más robusta)

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
    -- Obtener info del usuario
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    
    -- Intentar obtener su rango actual
    SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_user_record.current_rank;

    -- Si el rango no existe o no tiene config, usamos Diamante Ejecutivo para la "proyección máxima" 
    -- o simplemente mostramos el volumen con 0% si no existe config.
    -- Pero para la "Ganancia Estimada" real, usaremos su rango actual.
    
    RETURN QUERY
    WITH RECURSIVE network_levels AS (
        -- Nivel 1
        SELECT id, sponsor_id, COALESCE(monthly_pv, 0) as mpv, 1 as lvl
        FROM public.profiles
        WHERE sponsor_id = p_user_id

        UNION ALL

        -- Niveles 2-10
        SELECT p.id, p.sponsor_id, COALESCE(p.monthly_pv, 0) as mpv, nl.lvl + 1
        FROM public.profiles p
        JOIN network_levels nl ON p.sponsor_id = nl.id
        WHERE nl.lvl < 10
    )
    SELECT 
        nl.lvl as level_number,
        SUM(nl.mpv)::NUMERIC as total_volume,
        COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) as percentage,
        (SUM(nl.mpv) * COALESCE((v_rank_record.royalties_config->>( 'N' || nl.lvl ))::NUMERIC, 0) / 100)::NUMERIC as potential_commission
    FROM network_levels nl
    GROUP BY nl.lvl
    ORDER BY nl.lvl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_potential_royalties(UUID) TO authenticated;


-- 2. SCRIPT DE SIMULACIÓN DE VOLUMEN (PARA PRUEBAS)
-- Ejecuta esto para ver datos en tu Dashboard si no tienes ventas reales aún.

DO $$
DECLARE
    v_admin_id UUID;
    v_child1_id UUID;
    v_child2_id UUID;
    v_grandchild_id UUID;
BEGIN
    -- 1. Obtener el ID del Admin (tú)
    SELECT id INTO v_admin_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;

    -- 2. Crear 2 hijos directos si no existen
    INSERT INTO public.profiles (full_name, email, sponsor_id, monthly_pv, current_rank)
    VALUES 
    ('Hijo Prueba 1', 'hijo1@test.com', v_admin_id, 200, 'Bronce Test'),
    ('Hijo Prueba 2', 'hijo2@test.com', v_admin_id, 150, 'Bronce Test')
    ON CONFLICT (email) DO UPDATE SET monthly_pv = EXCLUDED.monthly_pv
    RETURNING id INTO v_child1_id;

    -- 3. Crear 1 nieto (Nivel 2)
    INSERT INTO public.profiles (full_name, email, sponsor_id, monthly_pv, current_rank)
    VALUES ('Nieto Prueba 1', 'nieto1@test.com', v_child1_id, 500, 'Bronce Test')
    ON CONFLICT (email) DO UPDATE SET monthly_pv = EXCLUDED.monthly_pv;

    -- 4. Asegurar que el Admin tenga un rango que cobre (ej: Plata Test o Diamante)
    UPDATE public.profiles SET current_rank = 'Diamante' WHERE id = v_admin_id;
END $$;
