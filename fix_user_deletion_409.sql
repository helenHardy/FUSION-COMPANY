-- ========================================================
-- FIX: ERROR 409 EN ELIMINACIÓN DE USUARIOS
-- ========================================================
-- Este script soluciona el error 409 (Conflicto de integridad)
-- limpiando TODAS las referencias antes de borrar al usuario.

CREATE OR REPLACE FUNCTION public.delete_user_safely(p_target_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_upline_id UUID;
BEGIN
    -- 1. Obtener el patrocinador del que vamos a borrar (upline)
    SELECT sponsor_id INTO v_upline_id FROM public.profiles WHERE id = p_target_uuid;

    -- 2. REASIGNAR RED: Hijos directos al patrocinador superior
    UPDATE public.profiles 
    SET sponsor_id = v_upline_id
    WHERE sponsor_id = p_target_uuid;

    -- 3. REASIGNAR RAÍZ: rama visual al patrocinador superior
    UPDATE public.profiles
    SET branch_root_id = v_upline_id
    WHERE branch_root_id = p_target_uuid;

    -- 4. LIMPIAR INTEGRIDAD EN SUCURSALES (Manager)
    UPDATE public.sucursales
    SET manager_id = NULL
    WHERE manager_id = p_target_uuid;

    -- 5. LIMPIAR INTEGRIDAD EN VENTAS COMO VENDEDOR
    -- El error 409 suele ocurrir porque este campo no se limpiaba
    UPDATE public.sales
    SET seller_id = NULL
    WHERE seller_id = p_target_uuid;

    -- 6. ELIMINAR ITEMS DE VENTA (Dependencias de Sales)
    -- Primero quitamos los items para poder borrar las cabeceras de venta
    DELETE FROM public.sale_items 
    WHERE sale_id IN (SELECT id FROM public.sales WHERE user_id = p_target_uuid);

    -- 7. ELIMINAR REGISTROS TRANSACCIONALES
    DELETE FROM public.commissions WHERE beneficiary_id = p_target_uuid OR source_user_id = p_target_uuid;
    DELETE FROM public.sales WHERE user_id = p_target_uuid;
    DELETE FROM public.payouts WHERE user_id = p_target_uuid;
    DELETE FROM public.liquidations WHERE user_id = p_target_uuid;
    DELETE FROM public.rank_reward_claims WHERE user_id = p_target_uuid;
    DELETE FROM public.user_monthly_bonuses WHERE user_id = p_target_uuid;

    -- 8. ELIMINAR EL PERFIL PÚBLICO
    DELETE FROM public.profiles WHERE id = p_target_uuid;

    -- 9. ELIMINAR CUENTA DE AUTENTICACIÓN (Libera el email)
    -- Requiere que todas las FKs en schemas externos estén limpias (como las de arriba)
    DELETE FROM auth.users WHERE id = p_target_uuid;
    
    RAISE NOTICE 'Usuario eliminado con éxito y dependencias limpias.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
