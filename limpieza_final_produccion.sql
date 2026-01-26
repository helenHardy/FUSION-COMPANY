
-- ========================================================
-- LIMPIEZA TOTAL DE BASE DE DATOS (FRESH START)
-- CONSERVANDO USUARIO: admin@gmail.com
-- ========================================================
-- Este script borra todos los datos transaccionales, usuarios
-- y movimientos, dejando solo la configuración base y el admin.
-- ========================================================

DO $$
DECLARE
    v_admin_email text := 'admin@gmail.com';
    v_admin_id uuid;
BEGIN
    -- 1. Obtener ID del Admin
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_admin_email;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'El usuario admin@gmail.com no existe. No se puede proceder con seguridad.';
    END IF;

    RAISE NOTICE 'Iniciando limpieza profunda. Conservando Admin ID: %', v_admin_id;

    -- 2. Limpiar Tablas Transaccionales y de Movimientos (Hijas primero)
    DELETE FROM public.commissions;
    DELETE FROM public.sale_items;
    DELETE FROM public.sales;
    DELETE FROM public.payouts;
    DELETE FROM public.liquidations;
    DELETE FROM public.rank_reward_claims;
    DELETE FROM public.user_monthly_bonuses;
    DELETE FROM public.inventory; -- Reiniciar stock (Productos maestros se conservan)
    
    -- 3. Romper vínculos de red y gestión
    
    -- Desvincular gerentes de sucursales (excepto admin)
    UPDATE public.sucursales 
    SET manager_id = NULL 
    WHERE manager_id != v_admin_id;

    -- Desvincular patrocinadores en profiles
    UPDATE public.profiles 
    SET sponsor_id = NULL, branch_root_id = NULL
    WHERE id != v_admin_id;

    -- 4. Borrar Usuarios Secundarios
    
    -- Borrar de profiles (excepto admin)
    DELETE FROM public.profiles 
    WHERE id != v_admin_id;

    -- Borrar de auth.users (excepto admin)
    -- NOTA: Esto limpia el sistema de autenticación de Supabase
    DELETE FROM auth.users 
    WHERE id != v_admin_id;

    -- 5. Reiniciar contadores del admin
    UPDATE public.profiles 
    SET pv = 0, 
        pvg = 0, 
        total_earnings = 0, 
        free_products_count = 0,
        monthly_pv = 0,
        active_directs_count = 0,
        pending_liquidation = 0,
        current_rank = 'Básico'
    WHERE id = v_admin_id;

    RAISE NOTICE 'LIMPIEZA COMPLETADA. El sistema está en blanco para producción.';
END $$;
