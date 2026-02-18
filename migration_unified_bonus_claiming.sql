
-- MIGRACIÓN: RECLAMACIÓN UNIFICADA DE BONOS PENDIENTES
-- Añade una función para cobrar todos los bonos mensuales acumulados en un solo click.

CREATE OR REPLACE FUNCTION public.claim_all_pending_bonuses(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total NUMERIC := 0;
    v_count INTEGER := 0;
    v_bonus RECORD;
    v_auth_user_id UUID;
BEGIN
    -- Security Check: Only own bonuses or admin
    v_auth_user_id := auth.uid();
    
    IF p_user_id != v_auth_user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_auth_user_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permiso para realizar esta acción.');
    END IF;

    -- Procesar cada bono no cobrado
    FOR v_bonus IN 
        SELECT id, bonus_amount FROM public.user_monthly_bonuses 
        WHERE user_id = p_user_id AND is_claimed = FALSE 
    LOOP
        -- Ejecutamos la lógica de cobro individual (ya existe en claim_monthly_bonus)
        PERFORM public.claim_monthly_bonus(v_bonus.id);
        
        v_total := v_total + v_bonus.bonus_amount;
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'processed_count', v_count, 
        'total_claimed', v_total,
        'message', 'Se han cobrado ' || v_count || ' bonos por un total de ' || v_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.claim_all_pending_bonuses(UUID) TO authenticated;
