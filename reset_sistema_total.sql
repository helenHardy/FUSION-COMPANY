-- SCRIPT DE LIMPIEZA ADAPTADO (CONSERVA CONFIGURACIÓN BÁSICA)
-- Este script limpia el sistema pero MANTIENE Combos, Rangos y Regalías.
-- PROTEGE LA CUENTA: admin@gmail.com

BEGIN;

-- 1. Eliminar datos de transacciones (Vaciado de historial)
TRUNCATE TABLE public.sale_items CASCADE;
TRUNCATE TABLE public.sales CASCADE;
TRUNCATE TABLE public.commissions CASCADE;
TRUNCATE TABLE public.liquidations CASCADE;
TRUNCATE TABLE public.payouts CASCADE;
TRUNCATE TABLE public.rank_reward_claims CASCADE;
TRUNCATE TABLE public.user_monthly_bonuses CASCADE;

-- 2. Eliminar datos operativos pero NO de configuración estructural
-- Limpiamos productos y sucursales (ya que probablemente cambien)
-- Pero MANTENEMOS combos, ranks y gain_plans.
TRUNCATE TABLE public.inventory CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.sucursales CASCADE;

-- 3. Limpiar Perfiles (Excepto el Administrador)
DO $$
DECLARE
    v_admin_uuid UUID;
BEGIN
    -- Obtener el UUID del admin
    SELECT id INTO v_admin_uuid FROM auth.users WHERE email = 'admin@gmail.com' LIMIT 1;

    IF v_admin_uuid IS NOT NULL THEN
        -- Borrar todos los perfiles excepto el admin
        DELETE FROM public.profiles WHERE id != v_admin_uuid;

        -- Resetear el Admin a ceros
        UPDATE public.profiles SET
            pv = 0,
            pvg = 0,
            monthly_pv = 0,
            active_directs_count = 0,
            total_earnings = 0,
            pending_liquidation = 0,
            gift_balance = 0,
            free_products_count = 0,
            current_rank = 'Básico',
            sponsor_id = NULL,
            current_combo_id = NULL,
            activation_date = NOW(),
            status = 'activo'
        WHERE id = v_admin_uuid;
        
        RAISE NOTICE 'Limpieza selectiva completada. Combos y Rangos intactos.';
    ELSE
        RAISE EXCEPTION 'ERROR: No se encontró admin@gmail.com. Limpieza abortada.';
    END IF;
END $$;

COMMIT;

-- NOTA: Como siempre, borra los de Auth manualmente en el panel de Supabase.
