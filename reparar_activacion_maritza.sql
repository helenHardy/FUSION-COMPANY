-- SCRIPT DE REPARACIÓN DE PUNTOS POR ACTIVACIÓN MANUAL INCORRECTA
-- Este script busca usuarios que están 'activos' pero tienen 0 PV a pesar de tener un combo.
-- Esto sucede cuando se activan desde la lista general en lugar del módulo de Activaciones.

DO $$
DECLARE
    r RECORD;
    v_combo_pv NUMERIC;
    v_free_prods INTEGER;
BEGIN
    FOR r IN 
        SELECT p.id, p.full_name, p.current_combo_id 
        FROM public.profiles p
        WHERE p.status = 'activo' 
          AND (p.pv IS NULL OR p.pv = 0)
          AND p.current_combo_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Reparando puntos para: %', r.full_name;

        -- Obtener beneficios del combo
        SELECT pv_awarded, free_products_count INTO v_combo_pv, v_free_prods
        FROM public.combos WHERE id = r.current_combo_id;

        -- 1. Actualizar Perfil del socio
        UPDATE public.profiles SET
            pv = v_combo_pv,
            free_products_count = v_free_prods,
            activation_date = COALESCE(activation_date, NOW())
        WHERE id = r.id;

        -- 2. Repartir Puntos a la Red (PVG)
        IF v_combo_pv > 0 THEN
            PERFORM public.distribute_pvg(r.id, v_combo_pv);
        END IF;

        -- 3. Repartir Comisiones (Bs)
        -- Nota: Esto podría duplicar comisiones si ya se repartieron, 
        -- pero si el bypass fue por toggle_user_status, NO se repartieron.
        PERFORM public.distribute_commissions(r.id, r.current_combo_id);

    END LOOP;
END $$;
