
-- SCRIPT PARA SINCRONIZAR CONTADORES DE DIRECTOS ACTIVOS

-- Este script corrige los contadores si una persona se registró antes de que el sistema estuviera listo.

DO $$
DECLARE
    v_sponsor RECORD;
    v_count INTEGER;
BEGIN
    -- Recorremos todos los perfiles que son patrocinadores
    FOR v_sponsor IN SELECT id FROM public.profiles LOOP
        
        -- Contamos cuántos de sus hijos directos tienen 100 PV o más este mes
        SELECT COUNT(*) INTO v_count
        FROM public.profiles
        WHERE sponsor_id = v_sponsor.id 
          AND monthly_pv >= 100;

        -- Actualizamos el contador real
        UPDATE public.profiles
        SET active_directs_count = v_count
        WHERE id = v_sponsor.id;
        
    END LOOP;
END $$;
