
-- ==========================================
-- MASTER SCRIPT: MLM PROFESIONAL AUTÓNOMO (V2)
-- ==========================================
-- Este script unifica toda la inteligencia del sistema:
-- 1. Esquema de datos (Bono Lealtad + Rangos)
-- 2. Compresión Dinámica (Regalías inteligentes)
-- 3. Ascenso Automático de Rangos (Estructura de ramas)
-- 4. Activación con Comisiones por Precio (Bs)

-- Limpiamos funciones previas para evitar errores de parámetros
DROP FUNCTION IF EXISTS public.distribute_royalties(uuid,numeric);
DROP FUNCTION IF EXISTS public.check_rank_promotion(uuid);
DROP FUNCTION IF EXISTS public.check_monthly_qualification(uuid);
DROP FUNCTION IF EXISTS public.distribute_commissions(uuid,uuid);

BEGIN;

-- 1. ACTUALIZACIÓN DEL ESQUEMA (TABLAS)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS loyalty_balance NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_liquidation NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pv NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_pv NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pvg NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_directs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_products_count INTEGER DEFAULT 0;

ALTER TABLE public.ranks 
ADD COLUMN IF NOT EXISTS min_active_directs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_pv_monthly NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS royalties_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS required_downline_rank TEXT,
ADD COLUMN IF NOT EXISTS required_downline_count INTEGER DEFAULT 0;


-- 2. FUNCIÓN DE CALIFICACIÓN MENSUAL (¿Compró sus 100 PV?)
CREATE OR REPLACE FUNCTION public.check_monthly_qualification(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_rank_record RECORD;
    v_user_record RECORD;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_user_record.current_rank;
    IF v_rank_record.id IS NULL THEN RETURN FALSE; END IF;
    RETURN (
        COALESCE(v_user_record.monthly_pv, 0) >= v_rank_record.min_pv_monthly AND
        COALESCE(v_user_record.active_directs_count, 0) >= v_rank_record.min_active_directs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. MOTOR DE REGALÍAS CON COMPRESIÓN DINÁMICA Y BONO DE LEALTAD
CREATE OR REPLACE FUNCTION public.distribute_royalties(
    p_buyer_id UUID,
    p_points NUMERIC -- Se usa este nombre para mayor claridad
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

        -- COMPRESIÓN DINÁMICA: Solo pagamos si está calificado
        IF public.check_monthly_qualification(v_current_upline_id) THEN
            v_percentage := (v_rank_record.royalties_config->>( 'N' || v_paid_levels ))::NUMERIC;
            IF v_percentage > 0 THEN
                v_commission_amount := (p_points * v_percentage) / 100;
                INSERT INTO public.commissions (beneficiary_id, source_user_id, amount, commission_type, level_depth)
                VALUES (v_current_upline_id, p_buyer_id, v_commission_amount, 'regalia', v_paid_levels);

                UPDATE public.profiles SET total_earnings = COALESCE(total_earnings, 0) + v_commission_amount WHERE id = v_current_upline_id;

                -- BONO DE LEALTAD (0.5% extra al cochinito)
                v_loyalty_amount := (p_points * v_loyalty_percentage) / 100;
                UPDATE public.profiles SET loyalty_balance = COALESCE(loyalty_balance, 0) + v_loyalty_amount WHERE id = v_current_upline_id;
            END IF;
            v_paid_levels := v_paid_levels + 1;
        END IF;
        -- Siempre subimos al siguiente patrocinador, pero solo aumentamos nivel si pagamos
        v_current_upline_id := v_upline_record.sponsor_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. SISTEMA DE ASCENSO AUTOMÁTICO DE RANGOS (RECURSIVO)
CREATE OR REPLACE FUNCTION public.check_rank_promotion(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_record RECORD;
    v_next_rank RECORD;
    v_structure_met BOOLEAN := TRUE;
    v_branch_count INTEGER := 0;
BEGIN
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    SELECT * INTO v_next_rank FROM public.ranks 
    WHERE order_index > (SELECT order_index FROM public.ranks WHERE name = v_user_record.current_rank)
    ORDER BY order_index ASC LIMIT 1;

    IF v_next_rank IS NULL THEN RETURN; END IF;

    -- Requisitos de puntos
    IF v_user_record.pv < v_next_rank.min_pv OR v_user_record.pvg < v_next_rank.min_pvg THEN
        RETURN;
    END IF;

    -- Requisitos de ramas (Estructura)
    IF v_next_rank.required_downline_rank IS NOT NULL AND v_next_rank.required_downline_count > 0 THEN
        SELECT COUNT(DISTINCT child.id) INTO v_branch_count
        FROM public.profiles child
        WHERE child.sponsor_id = p_user_id
        AND EXISTS (
            WITH RECURSIVE downline AS (
                SELECT id, current_rank FROM public.profiles WHERE id = child.id
                UNION ALL
                SELECT p.id, p.current_rank FROM public.profiles p JOIN downline d ON p.sponsor_id = d.id
            )
            SELECT 1 FROM downline WHERE current_rank = v_next_rank.required_downline_rank
        );
        IF v_branch_count < v_next_rank.required_downline_count THEN v_structure_met := FALSE; END IF;
    END IF;

    IF v_structure_met THEN
        UPDATE public.profiles SET current_rank = v_next_rank.name WHERE id = p_user_id;
        PERFORM public.check_rank_promotion(p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. REPARTO DE COMISIONES POR VENTA DE COMBOS (Afiliación)
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
BEGIN
  SELECT price INTO v_buyer_combo_price FROM public.combos WHERE id = p_combo_id;
  SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = p_user_id;
  
  WHILE v_current_beneficiary IS NOT NULL AND v_level <= 20 LOOP
    SELECT current_combo_id INTO v_beneficiary_combo_id FROM public.profiles WHERE id = v_current_beneficiary;
    IF v_beneficiary_combo_id IS NOT NULL THEN
      SELECT plan_id INTO v_plan_id FROM public.combos WHERE id = v_beneficiary_combo_id;
      SELECT config INTO v_config FROM public.gain_plans WHERE id = v_plan_id;
      v_percentage := (v_config->>v_level::text)::NUMERIC;
      IF v_percentage IS NOT NULL AND v_percentage > 0 THEN
        v_amount := v_buyer_combo_price * (v_percentage / 100);
        INSERT INTO public.commissions (beneficiary_id, source_user_id, amount, commission_type, level_depth)
        VALUES (v_current_beneficiary, p_user_id, v_amount, 'bono_inicio_rapido', v_level);
        UPDATE public.profiles SET total_earnings = COALESCE(total_earnings, 0) + v_amount WHERE id = v_current_beneficiary;
      END IF;
    END IF;
    SELECT sponsor_id INTO v_current_beneficiary FROM public.profiles WHERE id = v_current_beneficiary;
    v_level := v_level + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
