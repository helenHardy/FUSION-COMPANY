
-- FUNCIONES PARA LA APROBACIÓN DE RETIROS

-- 1. Función para aprobar una solicitud de retiro
CREATE OR REPLACE FUNCTION public.approve_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Verificar si el que ejecuta es admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Solo administradores pueden aprobar pagos.';
    END IF;

    -- Actualizar la solicitud
    UPDATE public.payouts
    SET 
        status = 'pagado',
        admin_id = p_admin_id,
        paid_at = NOW(),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_payout_id AND status = 'pendiente';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud no existe o ya no está pendiente.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para rechazar una solicitud de retiro
CREATE OR REPLACE FUNCTION public.reject_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_reason TEXT
) RETURNS VOID AS $$
BEGIN
    -- Verificar si el que ejecuta es admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Solo administradores pueden rechazar pagos.';
    END IF;

    -- Actualizar la solicitud
    UPDATE public.payouts
    SET 
        status = 'rechazado',
        admin_id = p_admin_id,
        notes = notes || E'\nRECHAZADO: ' || p_reason
    WHERE id = p_payout_id AND status = 'pendiente';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud no existe o ya no está pendiente.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
