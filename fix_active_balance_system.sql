-- ========================================================
-- MASTER BALANCE INTEGRITY: BALANCES REALES Y RETIRABLES (V1)
-- ========================================================
-- Este script implementa un sistema de balance neto (Ingresos - Egresos)
-- Asegurando que los retiros descuenten el dinero del perfil del usuario.

BEGIN;

-- 1. ADICIÓN DE COLUMNA DE BALANCE REAL
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS withdrawable_balance NUMERIC(10, 2) DEFAULT 0;

-- 2. ACTUALIZACIÓN DE MOTORES DE REPARTO (SUMA)

-- Limpiar funciones existentes para evitar errores de nombres de parámetros
DROP FUNCTION IF EXISTS public.distribute_commissions(uuid, uuid);
DROP FUNCTION IF EXISTS public.distribute_royalties(uuid, numeric);
DROP FUNCTION IF EXISTS public.claim_monthly_bonus(uuid);
DROP FUNCTION IF EXISTS public.process_payout(uuid, uuid, numeric, text, text);

-- A. Bono de Inicio Rápido (Afiliación)
CREATE OR REPLACE FUNCTION public.distribute_commissions(
  p_user_id UUID,
  p_combo_id UUID
) RETURNS VOID AS $$
DECLARE
  v_buyer_combo_price NUMERIC;
  v_beneficiary_combo_id UUID;
  v_plan_id UUID;
  v_config JSONB;
  v_level INTEGER := 1;
  v_percentage NUMERIC;
  v_amount NUMERIC;
  v_current_beneficiary UUID;
  v_depth_limit INTEGER := 0;
BEGIN
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;

  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 AND v_depth_limit < 100 LOOP
    SELECT current_combo_id INTO v_beneficiary_combo_id FROM public.profiles WHERE id = v_current_beneficiary;

    IF v_beneficiary_combo_id IS NOT NULL THEN
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      v_percentage := (v_config->>v_level::text)::NUMERIC;

      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        v_amount := v_buyer_combo_price * (v_percentage / 100);
        INSERT INTO public.commissions (beneficiary_id, source_user_id, amount, commission_type, level_depth)
        VALUES (v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level);
        
        -- ACTUALIZAR AMBOS BALANCES
        UPDATE public.profiles SET 
            total_earnings = COALESCE(total_earnings, 0) + v_amount,
            withdrawable_balance = COALESCE(withdrawable_balance, 0) + v_amount
        WHERE id = v_current_beneficiary;
      END IF;
    END IF;

    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
    v_depth_limit := v_depth_limit + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Sistema de Regalías (PV Grupal)
CREATE OR REPLACE FUNCTION public.distribute_royalties(
    p_buyer_id UUID,
    p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_current_upline_id UUID;
    v_upline_record RECORD;
    v_rank_record RECORD;
    v_paid_levels INTEGER := 1;
    v_max_levels INTEGER := 15;
    v_percentage NUMERIC;
    v_commission_amount NUMERIC;
    v_loyalty_percentage NUMERIC := 0.50; 
    v_loyalty_amount NUMERIC;
BEGIN
    SELECT sponsor_id INTO v_current_upline_id FROM public.profiles WHERE id = p_buyer_id;
    WHILE v_current_upline_id IS NOT NULL AND v_paid_levels <= v_max_levels LOOP
        SELECT * INTO v_upline_record FROM public.profiles WHERE id = v_current_upline_id;
        SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_upline_record.current_rank;

        IF public.check_monthly_qualification(v_current_upline_id) THEN
            v_percentage := (v_rank_record.royalties_config->>( 'N' || v_paid_levels ))::NUMERIC;
            IF v_percentage > 0 THEN
                v_commission_amount := (p_points * v_percentage) / 100;
                INSERT INTO public.commissions (beneficiary_id, source_user_id, amount, commission_type, level_depth)
                VALUES (v_current_upline_id, p_buyer_id, v_commission_amount, 'regalia', v_paid_levels);

                -- ACTUALIZAR AMBOS BALANCES
                UPDATE public.profiles SET 
                    total_earnings = COALESCE(total_earnings, 0) + v_commission_amount,
                    withdrawable_balance = COALESCE(withdrawable_balance, 0) + v_commission_amount
                WHERE id = v_current_upline_id;

                -- BONO DE LEALTAD
                v_loyalty_amount := (p_points * v_loyalty_percentage) / 100;
                UPDATE public.profiles SET loyalty_balance = COALESCE(loyalty_balance, 0) + v_loyalty_amount WHERE id = v_current_upline_id;
            END IF;
            v_paid_levels := v_paid_levels + 1;
        END IF;
        v_current_upline_id := v_upline_record.sponsor_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Cobro de Bonos Mensuales (Claim)
CREATE OR REPLACE FUNCTION public.claim_monthly_bonus(p_bonus_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_bonus RECORD;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    SELECT * INTO v_bonus FROM public.user_monthly_bonuses WHERE id = p_bonus_id;

    IF v_bonus IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Bono no encontrado.'); END IF;
    IF v_bonus.user_id != v_user_id AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes permiso para cobrar este bono.');
    END IF;
    IF v_bonus.is_claimed THEN RETURN jsonb_build_object('success', false, 'message', 'Este bono ya ha sido cobrado.'); END IF;

    INSERT INTO public.commissions (beneficiary_id, amount, commission_type, level_depth)
    VALUES (v_bonus.user_id, v_bonus.bonus_amount, 'bono_pv_mensual', 0);

    -- ACTUALIZAR AMBOS BALANCES
    UPDATE public.profiles SET 
        total_earnings = COALESCE(total_earnings, 0) + v_bonus.bonus_amount,
        withdrawable_balance = COALESCE(withdrawable_balance, 0) + v_bonus.bonus_amount
    WHERE id = v_bonus.user_id;

    UPDATE public.user_monthly_bonuses SET is_claimed = TRUE, claimed_at = NOW() WHERE id = p_bonus_id;

    RETURN jsonb_build_object('success', true, 'message', 'Bono cobrado con éxito!', 'amount', v_bonus.bonus_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ACTUALIZACIÓN DE MOTOR DE PAGOS (RESTA)

CREATE OR REPLACE FUNCTION public.process_payout(
    p_user_id UUID,
    p_admin_id UUID,
    p_amount NUMERIC,
    p_method TEXT,
    p_notes TEXT
) RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin(p_admin_id) THEN
        RAISE EXCEPTION 'Solo administradores pueden procesar pagos.';
    END IF;

    -- A. Verificar que tenga saldo suficiente en el nuevo campo
    IF (SELECT withdrawable_balance FROM public.profiles WHERE id = p_user_id) < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente para este pago.';
    END IF;

    -- B. Registrar el pago
    INSERT INTO public.payouts (user_id, admin_id, amount, status, payment_method, notes, paid_at)
    VALUES (p_user_id, p_admin_id, p_amount, 'pagado', p_method, p_notes, NOW());

    -- C. DESCARTAR SALDO REAL
    UPDATE public.profiles 
    SET withdrawable_balance = COALESCE(withdrawable_balance, 0) - p_amount 
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. MIGRACIÓN INICIAL: SINCRONIZACIÓN DE SALDOS EXISTENTES
-- Recalculamos el balance retirable como: (Total Ganado) - (Total Pagado)

DO $$
DECLARE
    v_rec RECORD;
    v_total_paid NUMERIC;
BEGIN
    FOR v_rec IN SELECT id, total_earnings FROM public.profiles LOOP
        -- Sumar todos sus pagos ya realizados (payouts y liquidations)
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid 
        FROM (
            SELECT amount FROM public.payouts WHERE user_id = v_rec.id AND status = 'pagado'
            UNION ALL
            SELECT amount FROM public.liquidations WHERE user_id = v_rec.id
        ) sub;

        -- El balance retirable es lo que ganó menos lo que ya se le dio
        UPDATE public.profiles 
        SET withdrawable_balance = COALESCE(total_earnings, 0) - v_total_paid
        WHERE id = v_rec.id;
    END LOOP;
END $$;

COMMIT;
