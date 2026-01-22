
-- 1. FUNCIÓN PARA ELIMINAR USUARIO SIN ROMPER LA RED
-- Reasigna los afiliados directos al patrocinador del usuario eliminado.

CREATE OR REPLACE FUNCTION public.delete_user_safely(p_target_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_upline_id UUID;
BEGIN
    -- 1. Obtener el patrocinador del que vamos a borrar (el "upline")
    SELECT sponsor_id INTO v_upline_id FROM public.profiles WHERE id = p_target_uuid;

    -- 2. Reasignar todos los hijos directos al upline
    UPDATE public.profiles 
    SET sponsor_id = v_upline_id
    WHERE sponsor_id = p_target_uuid;

    -- 3. También reasignar branch_root_id si aplica (para temas de árbol visual)
    UPDATE public.profiles
    SET branch_root_id = v_upline_id
    WHERE branch_root_id = p_target_uuid;

    -- 4. Limpiar referencias en sucursales (si era manager)
    UPDATE public.sucursales
    SET manager_id = NULL
    WHERE manager_id = p_target_uuid;

    -- 5. Manejar registros históricos (Liquidaciones, Pagos, etc.)
    -- Para no romper la integridad, eliminamos sus registros transaccionales
    -- NOTE: En un sistema real serio, quizás querrías anonimizar en lugar de borrar.
    DELETE FROM public.commissions WHERE beneficiary_id = p_target_uuid OR source_user_id = p_target_uuid;
    DELETE FROM public.sales WHERE user_id = p_target_uuid;
    DELETE FROM public.payouts WHERE user_id = p_target_uuid;
    DELETE FROM public.liquidations WHERE user_id = p_target_uuid;
    DELETE FROM public.rank_reward_claims WHERE user_id = p_target_uuid;
    DELETE FROM public.user_monthly_bonuses WHERE user_id = p_target_uuid;

    -- 6. Finalmente borrar el perfil
    DELETE FROM public.profiles WHERE id = p_target_uuid;

    -- NOTA: El usuario seguirá existiendo en auth.users (Supabase Auth). 
    -- Para borrarlo de raíz, el admin debe hacerlo desde el Dashboard de Supabase
    -- o mediante una función que use el Service Role (no recomendado exponer).
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNCIÓN PARA CAMBIAR ESTADO DE USUARIO (INACTIVAR/ACTIVAR)
CREATE OR REPLACE FUNCTION public.toggle_user_status(p_target_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    v_current_status TEXT;
    v_new_status TEXT;
BEGIN
    SELECT status INTO v_current_status FROM public.profiles WHERE id = p_target_uuid;
    
    IF v_current_status = 'activo' THEN
        v_new_status := 'inactivo';
    ELSE
        v_new_status := 'activo';
    END IF;

    UPDATE public.profiles SET status = v_new_status WHERE id = p_target_uuid;
    
    RETURN v_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
