-- FIX: Eliminación Completa de Usuario (Profiles + Auth)
-- Este script actualiza la función de borrado para eliminar también la cuenta de autenticación.
-- Esto libera el correo electrónico para poder volver a registrarlo.

CREATE OR REPLACE FUNCTION public.delete_user_safely(p_target_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_upline_id UUID;
BEGIN
    -- 1. Obtener el patrocinador del que vamos a borrar (el "upline")
    SELECT sponsor_id INTO v_upline_id FROM public.profiles WHERE id = p_target_uuid;

    -- 2. Reasignar todos los hijos directos al upline (para no dejar huérfanos)
    UPDATE public.profiles 
    SET sponsor_id = v_upline_id
    WHERE sponsor_id = p_target_uuid;

    -- 3. También reasignar branch_root_id si aplica
    UPDATE public.profiles
    SET branch_root_id = v_upline_id
    WHERE branch_root_id = p_target_uuid;

    -- 4. Limpiar referencias en sucursales
    UPDATE public.sucursales
    SET manager_id = NULL
    WHERE manager_id = p_target_uuid;

    -- 5. Eliminar datos transaccionales (Liquidaciones, Pagos, etc.)
    DELETE FROM public.commissions WHERE beneficiary_id = p_target_uuid OR source_user_id = p_target_uuid;
    DELETE FROM public.sales WHERE user_id = p_target_uuid;
    DELETE FROM public.payouts WHERE user_id = p_target_uuid;
    DELETE FROM public.liquidations WHERE user_id = p_target_uuid;
    DELETE FROM public.rank_reward_claims WHERE user_id = p_target_uuid;
    DELETE FROM public.user_monthly_bonuses WHERE user_id = p_target_uuid;

    -- 6. Eliminar el perfil público
    DELETE FROM public.profiles WHERE id = p_target_uuid;

    -- 7. IMPORTANTE: Eliminar de auth.users para liberar el correo
    DELETE FROM auth.users WHERE id = p_target_uuid;
    
    RAISE NOTICE 'Usuario eliminado completamente (Perfil + Auth) y red reasignada.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
