-- ========================================================
-- HARD REVERSAL & USER DELETION: GONZALO NINA QUISPE
-- ========================================================
-- Este script realiza una reversión total de puntos y dinero generados
-- por el usuario GONZALO NINA QUISPE antes de eliminarlo.

BEGIN;

DO $$
DECLARE
    v_gonzalo_id UUID;
    v_sponsor_id UUID;
    v_points_to_revert NUMERIC;
    v_comm RECORD;
    v_upline_id UUID;
    v_target_name TEXT := '%GONZALO NINA QUISPE%';
BEGIN
    -- 1. IDENTIFICAR AL USUARIO
    SELECT id, sponsor_id, COALESCE(pv, 0) 
    INTO v_gonzalo_id, v_sponsor_id, v_points_to_revert
    FROM public.profiles 
    WHERE full_name ILIKE v_target_name;

    IF v_gonzalo_id IS NULL THEN
        RAISE NOTICE 'No se encontró al usuario GONZALO NINA QUISPE.';
        RETURN;
    END IF;

    RAISE NOTICE 'Iniciando reversión para Gonzalo (ID: %), Patrocinador ID: %', v_gonzalo_id, v_sponsor_id;

    -- 2. REVERSIÓN DE DINERO (COMISIONES)
    -- Buscamos todas las comisiones donde Gonzalo fue la fuente (el origen del dinero)
    FOR v_comm IN SELECT * FROM public.commissions WHERE source_user_id = v_gonzalo_id LOOP
        RAISE NOTICE 'Revirtiendo comisión de Bs % para Beneficiario %', v_comm.amount, v_comm.beneficiary_id;
        
        UPDATE public.profiles SET 
            total_earnings = COALESCE(total_earnings, 0) - v_comm.amount,
            withdrawable_balance = COALESCE(withdrawable_balance, 0) - v_comm.amount
        WHERE id = v_comm.beneficiary_id;
    END LOOP;

    -- 3. REVERSIÓN DE PUNTOS (PVG)
    -- Subimos por toda la red desde el patrocinador restando los puntos que Gonzalo dio
    v_upline_id := v_sponsor_id;
    WHILE v_upline_id IS NOT NULL LOOP
        RAISE NOTICE 'Restando % PVG de Upline %', v_points_to_revert, v_upline_id;
        
        UPDATE public.profiles SET 
            pvg = COALESCE(pvg, 0) - v_points_to_revert,
            monthly_pvg = COALESCE(monthly_pvg, 0) - v_points_to_revert
        WHERE id = v_upline_id;

        SELECT sponsor_id INTO v_upline_id FROM public.profiles WHERE id = v_upline_id;
    END LOOP;

    -- 4. REVERSIÓN DE MÉTRICAS DEL PATROCINADOR
    -- Si Gonzalo tenía 100 PV o más, contaba como directo activo para Raymundo
    IF v_points_to_revert >= 100 AND v_sponsor_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET active_directs_count = GREATEST(COALESCE(active_directs_count, 1) - 1, 0)
        WHERE id = v_sponsor_id;
    END IF;

    -- 5. REASIGNACIÓN DE RED (SI TENÍA HIJOS)
    -- Los hijos de Gonzalo pasan a ser de Raymundo
    UPDATE public.profiles 
    SET sponsor_id = v_sponsor_id 
    WHERE sponsor_id = v_gonzalo_id;

    -- 6. LIMPIEZA DE TRANSACCIONES
    DELETE FROM public.commissions WHERE source_user_id = v_gonzalo_id OR beneficiary_id = v_gonzalo_id;
    DELETE FROM public.sales WHERE user_id = v_gonzalo_id;
    DELETE FROM public.payouts WHERE user_id = v_gonzalo_id;
    DELETE FROM public.liquidations WHERE user_id = v_gonzalo_id;

    -- 7. ELIMINACIÓN DEL PERFIL
    DELETE FROM public.profiles WHERE id = v_gonzalo_id;

    RAISE NOTICE 'Reversión y eliminación completada exitosamente.';
END $$;

COMMIT;
