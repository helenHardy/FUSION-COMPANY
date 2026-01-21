
-- FUNCIÓN PARA OBTENER ESTADÍSTICAS GLOBALES DEL SISTEMA (ADMIN)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_start_date DATE, p_end_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_revenue NUMERIC;
    v_pv_total NUMERIC;
    v_commissions_total NUMERIC;
    v_commissions_breakdown JSONB;
    v_new_affiliates INTEGER;
    v_total_paid_earnings NUMERIC;
    v_pending_liquidations_total NUMERIC;
    v_active_users_count INTEGER;
BEGIN
    -- 1. Ventas e Ingresos
    SELECT 
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(total_pv), 0)
    INTO v_revenue, v_pv_total
    FROM public.sales
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- 2. Comisiones Repartidas (Breakdown)
    SELECT 
        COALESCE(SUM(amount), 0)
    INTO v_commissions_total
    FROM public.commissions
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    SELECT jsonb_object_agg(sub.type, sub.total) INTO v_commissions_breakdown
    FROM (
        SELECT 
            commission_type as type, 
            COALESCE(SUM(amount), 0) as total
        FROM public.commissions
        WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY commission_type
    ) sub;

    -- 3. Crecimiento de Red
    SELECT COUNT(*) INTO v_new_affiliates
    FROM public.profiles
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- 4. Usuarios con actividad (PV mensual > 0)
    SELECT COUNT(*) INTO v_active_users_count
    FROM public.profiles
    WHERE monthly_pv > 0;

    -- 5. Pagos realizados (Caja)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_earnings
    FROM public.payouts
    WHERE status = 'pagado' AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- 6. Deudas de Patrocinadores (Pendientes de Liquidar)
    SELECT COALESCE(SUM(pending_liquidation), 0) INTO v_pending_liquidations_total
    FROM public.profiles;

    RETURN jsonb_build_object(
        'revenue', v_revenue,
        'pv_total', v_pv_total,
        'commissions_total', v_commissions_total,
        'commissions_breakdown', COALESCE(v_commissions_breakdown, '{}'::jsonb),
        'new_affiliates', v_new_affiliates,
        'active_users_count', v_active_users_count,
        'total_paid_payouts', v_total_paid_earnings,
        'pending_liquidations', v_pending_liquidations_total,
        'period', jsonb_build_object('start', p_start_date, 'end', p_end_date)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(DATE, DATE) TO authenticated;
