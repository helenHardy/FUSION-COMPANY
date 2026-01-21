
-- SISTEMA DE PAGOS Y RETIROS

-- 1. Tabla de Pagos (Payouts)
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    admin_id UUID REFERENCES public.profiles(id),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado', 'rechazado')),
    payment_method TEXT, -- 'efectivo', 'transferencia', etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 2. Permisos
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven sus propios pagos" ON public.payouts;
CREATE POLICY "Usuarios ven sus propios pagos" 
ON public.payouts FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins gestionan todos los pagos" ON public.payouts;
CREATE POLICY "Admins gestionan todos los pagos" 
ON public.payouts FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Usuarios crean sus propios retiros" ON public.payouts;
CREATE POLICY "Usuarios crean sus propios retiros" 
ON public.payouts FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid() AND status = 'pendiente');

-- 3. Función para validar y solicitar un retiro (Usuario)
CREATE OR REPLACE FUNCTION public.request_payout(
    p_amount NUMERIC,
    p_method TEXT,
    p_notes TEXT
) RETURNS VOID AS $$
DECLARE
    v_total_earned NUMERIC;
    v_total_paid NUMERIC;
    v_available NUMERIC;
BEGIN
    -- 1. Calcular disponible
    SELECT COALESCE(total_earnings, 0) INTO v_total_earned FROM public.profiles WHERE id = auth.uid();
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
    FROM public.payouts 
    WHERE user_id = auth.uid() AND status IN ('pendiente', 'pagado');

    v_available := v_total_earned - v_total_paid;

    -- 2. Validar monto
    IF p_amount > v_available THEN
        RAISE EXCEPTION 'Saldo insuficiente. Máximo disponible: %', v_available;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0.';
    END IF;

    -- 3. Registrar solicitud
    INSERT INTO public.payouts (user_id, amount, status, payment_method, notes)
    VALUES (auth.uid(), p_amount, 'pendiente', p_method, p_notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para procesar un pago (Admin)
CREATE OR REPLACE FUNCTION public.process_payout(
    p_user_id UUID,
    p_admin_id UUID,
    p_amount NUMERIC,
    p_method TEXT,
    p_notes TEXT
) RETURNS VOID AS $$
BEGIN
    -- Verificar admin
    IF NOT public.is_admin(p_admin_id) THEN
        RAISE EXCEPTION 'Solo administradores pueden procesar pagos.';
    END IF;

    -- Registrar el pago
    INSERT INTO public.payouts (user_id, admin_id, amount, status, payment_method, notes, paid_at)
    VALUES (p_user_id, p_admin_id, p_amount, 'pagado', p_method, p_notes, NOW());

    -- OPCIONAL: Podríamos restar de un campo 'balance' si lo tuviéramos separado,
    -- pero por ahora consultaremos el balance neto (Earnings - Payouts).
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT ALL ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
