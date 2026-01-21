
-- MECANISMO DE CIERRE MENSUAL

-- 1. Función para reiniciar metas mensuales
CREATE OR REPLACE FUNCTION public.reset_monthly_stats()
RETURNS VOID AS $$
BEGIN
    -- Solo reiniciamos los campos temporales del mes
    UPDATE public.profiles
    SET monthly_pv = 0,
        active_directs_count = 0;
    
    -- Nota: El PV total (acumulado para rango) NO se reinicia.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTA PARA EL USUARIO: 
-- Supabase permite programar esto usando 'pg_cron' si está habilitado:
-- SELECT cron.schedule('0 0 1 * *', 'SELECT public.reset_monthly_stats()');
-- Si no tienes pg_cron, puedes ejecutarla manualmente cada 1ro de mes: 
-- SELECT public.reset_monthly_stats();
