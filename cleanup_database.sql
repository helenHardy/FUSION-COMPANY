-- SCRIPT DE LIMPIEZA PROFUNDA (RESETEO DE DATOS)
-- Este script limpia todas las ventas, comisiones y usuarios, pero conserva la configuración base.
-- REQUISITO: El usuario admin@gmail.com debe existir en auth.users.

BEGIN;

-- 1. DESACTIVAR TRIGGERS TEMPORALMENTE (Opcional, pero TRUNCATE CASCADE lo maneja)
-- SET session_replication_role = 'replica';

-- 2. LIMPIEZA DE TABLAS TRANSACCIONALES (En orden de dependencia)
TRUNCATE TABLE public.sale_items CASCADE;
TRUNCATE TABLE public.commissions CASCADE;
TRUNCATE TABLE public.payouts CASCADE;
TRUNCATE TABLE public.liquidations CASCADE;
TRUNCATE TABLE public.rank_reward_claims CASCADE;
TRUNCATE TABLE public.user_monthly_bonuses CASCADE;
TRUNCATE TABLE public.sales CASCADE;

-- 3. DESVINCULAR RELACIONES DE PERFILES (Para evitar errores de FK)
-- Quitamos los gerentes de las sucursales temporalmente
UPDATE public.sucursales SET manager_id = NULL;

-- Quitamos patrocinadores y raíces de ramas (auto-referencias)
UPDATE public.profiles SET sponsor_id = NULL, branch_root_id = NULL;

-- 4. RESETEO DE INVENTARIO
-- Ponemos el stock en 0 para todos los productos en todas las sucursales
UPDATE public.inventory SET stock = 0, updated_at = NOW();

-- 5. LIMPIEZA DE PERFILES Y USUARIOS
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    -- Obtenemos el ID del administrador principal
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@gmail.com' LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'ERROR: No se encontró al usuario admin@gmail.com. Crea el usuario antes de correr este script.';
    END IF;

    -- Borrar todos los perfiles excepto el admin
    DELETE FROM public.profiles WHERE id != v_admin_id;

    -- Resetear las estadísticas del admin para que empiece de cero
    UPDATE public.profiles SET 
        pv = 0,
        pvg = 0,
        monthly_pv = 0,
        active_directs_count = 0,
        total_earnings = 0,
        pending_liquidation = 0,
        loyalty_balance = 0,
        current_rank = 'Básico',
        current_combo_id = NULL,
        sponsor_id = NULL,
        branch_root_id = NULL
    WHERE id = v_admin_id;

    RAISE NOTICE 'Limpieza completada. Perfil admin conservado con ID: %', v_admin_id;
END $$;

-- 5. RECONSTRUCCIÓN DE CONFIGURACIÓN (Opcional)
-- Si desea borrar también productos, sucursales y combos, descomente las siguientes líneas:
-- TRUNCATE TABLE public.products CASCADE;
-- TRUNCATE TABLE public.sucursales CASCADE;
-- TRUNCATE TABLE public.combos CASCADE;
-- TRUNCATE TABLE public.gain_plans CASCADE;
-- TRUNCATE TABLE public.ranks CASCADE;

COMMIT;

-- NOTA FINAL:
-- Para una limpieza total, debes ir a la consola de Supabase > Authentication
-- y borrar manualmente a todos los usuarios excepto admin@gmail.com.
