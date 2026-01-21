
-- SCRIPT DE RESET TOTAL (LIMPIEZA PARA PRUEBAS)
-- Protege específicamente a admin@gmail.com

BEGIN;

-- 1. Borrar Tablas Transaccionales (Casca de hijos a padres)
TRUNCATE TABLE public.liquidations CASCADE;
TRUNCATE TABLE public.payouts CASCADE;
TRUNCATE TABLE public.commissions CASCADE;
TRUNCATE TABLE public.sale_items CASCADE;
TRUNCATE TABLE public.sales CASCADE;
TRUNCATE TABLE public.inventory CASCADE;

-- 2. Borrar Configuración
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.sucursales CASCADE;
TRUNCATE TABLE public.combos CASCADE;
TRUNCATE TABLE public.gain_plans CASCADE;

-- 3. Limpiar Perfiles excepto el ADMIN (admin@gmail.com)
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- Buscamos el ID del admin por su correo en auth.users
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@gmail.com' LIMIT 1;

    -- Si existe, borramos todo excepto él
    IF v_admin_id IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id != v_admin_id;

        -- Asegurar que el admin tenga rol 'admin' y puntos en 0
        INSERT INTO public.profiles (id, full_name, role, status, current_rank, pv, pvg, monthly_pv, active_directs_count, total_earnings, pending_liquidation)
        VALUES (v_admin_id, 'Administrador Principal', 'admin', 'activo', 'Básico', 0, 0, 0, 0, 0, 0)
        ON CONFLICT (id) DO UPDATE SET 
            role = 'admin',
            pv = 0, 
            pvg = 0, 
            monthly_pv = 0, 
            active_directs_count = 0, 
            total_earnings = 0, 
            pending_liquidation = 0,
            current_rank = 'Básico',
            sponsor_id = NULL;
    ELSE
        -- Si no encontramos el ID por email, borramos todos los perfiles por seguridad
        TRUNCATE TABLE public.profiles CASCADE;
    END IF;
END $$;

COMMIT;

-- REQUISITO MANUAL:
-- Ve a Supabase > Authentication y borra todos los usuarios excepto admin@gmail.com.
