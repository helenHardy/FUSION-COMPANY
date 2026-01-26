-- SCRIPT DE LIMPIEZA DE BASE DE DATOS (CONSERVANDO ADMIN)
-- PRECAUCIÓN: ESTO BORRARÁ TODOS LOS DATOS MENOS EL USUARIO ADMIN

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

    RAISE NOTICE 'Conservando usuario Admin ID: %', v_admin_id;

    -- 2. Limpiar Tablas Transaccionales (Hijas primero)
    DELETE FROM public.commissions;     -- Borrar comisiones
    DELETE FROM public.sale_items;      -- Borrar items de venta
    DELETE FROM public.sales;           -- Borrar ventas
    DELETE FROM public.payouts;         -- Borrar pagos/retiros
    DELETE FROM public.inventory;       -- Reiniciar inventario (si productos quedan, stock será 0)
    
    -- Si existen otras tablas como wallet_movements, añadir aquí
    -- DELETE FROM public.wallet_movements;

    -- 3. Desvincular dependencias en tablas maestras antes de borrar usuarios
    
    -- Desvincular Sucursales de sus gerentes (excepto si es admin)
    UPDATE public.sucursales 
    SET manager_id = NULL 
    WHERE manager_id != v_admin_id;

    -- Desvincular Referidos/Patrocinadores en Profiles para evitar errores de FK al borrar
    -- También limpiar la raíz de rama
    UPDATE public.profiles 
    SET sponsor_id = NULL, branch_root_id = NULL
    WHERE id != v_admin_id;

    -- 4. Borrar Usuarios (Profiles y Auth)
    
    -- Borrar perfiles (se borrará primero de profiles)
    DELETE FROM public.profiles 
    WHERE id != v_admin_id;

    -- Intentar borrar de auth.users.
    -- Nota: Esto requiere que el usuario que ejecuta el script tenga permisos sobre auth.users.
    -- En Supabase SQL Editor generalmente se tiene permiso postgres/service_role.
    DELETE FROM auth.users 
    WHERE id != v_admin_id;

    RAISE NOTICE 'Base de datos limpiada exitosamente. Se conservó el admin y la configuración (Productos/Rangos/Planes).';
END $$;
