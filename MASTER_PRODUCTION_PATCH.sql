-- ========================================================
-- MASTER PRODUCTION PATCH - FUSION MLM
-- ========================================================
-- Este script consolida TODAS las mejoras y correcciones 
-- esenciales para producción.
-- 1. PVG Total (Incluye PV propio)
-- 2. Registro Maestro (Trigger handle_new_user)
-- 3. Rangos y Porcentajes (PERSONAL 5% N1, 2% N2)
-- 4. Eliminación Segura (Usuarios y Pedidos)
-- 5. Sincronización Mensual Automática

BEGIN;

-----------------------------------------------------------
-- 1. LÓGICA DE PUNTOS (PVG)
-----------------------------------------------------------
-- Asegura que el PVG sume el PV del propio usuario y toda su red upline
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_node UUID;
BEGIN
  v_current_node := p_start_user_id;
  WHILE v_current_node IS NOT NULL LOOP
    UPDATE public.profiles SET 
        pvg = COALESCE(pvg, 0) + p_points,
        monthly_pvg = COALESCE(monthly_pvg, 0) + p_points
    WHERE id = v_current_node;
    SELECT sponsor_id INTO v_current_node FROM public.profiles WHERE id = v_current_node;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------
-- 2. REGISTRO Y ACTIVACIÓN DE USUARIOS
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_combo_price NUMERIC := 0;
  v_free_prods INTEGER := 0;
  v_sponsor_id UUID;
BEGIN
  v_sponsor_id := (new.raw_user_meta_data->>'sponsor_id')::uuid;

  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, price, free_products_count 
    INTO v_combo_pv, v_combo_price, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, document_id, role, sponsor_id, 
    current_combo_id, status, activation_date, 
    pv, monthly_pv, free_products_count
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    v_sponsor_id,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    'activo',
    NOW(),
    v_combo_pv,
    v_combo_pv,
    v_free_prods
  );

  IF v_combo_price > 0 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET pending_liquidation = COALESCE(pending_liquidation, 0) + v_combo_price WHERE id = v_sponsor_id;
  END IF;

  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET active_directs_count = COALESCE(active_directs_count, 0) + 1 WHERE id = v_sponsor_id;
  END IF;

  IF v_combo_pv > 0 THEN PERFORM public.distribute_pvg(new.id, v_combo_pv); END IF;

  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    PERFORM public.distribute_commissions(new.id, (new.raw_user_meta_data->>'current_combo_id')::uuid);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------
-- 3. RANGOS Y PORCENTAJES (PERSONAL: 5% N1 / 2% N2)
-----------------------------------------------------------
INSERT INTO public.ranks (name, royalties_config, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index)
VALUES ('PERSONAL', '{"N1": 5, "N2": 2, "N3": 0, "N4": 0, "N5": 0, "N6": 0, "N7": 0, "N8": 0}'::jsonb, 0, 0, 0, 0, 0)
ON CONFLICT (name) DO UPDATE SET 
    royalties_config = EXCLUDED.royalties_config;

-- Sincronizar perfiles sin rango o en rango básico
UPDATE public.profiles 
SET current_rank = 'PERSONAL' 
WHERE current_rank IS NULL OR TRIM(current_rank) = '' OR LOWER(TRIM(current_rank)) = 'básico';

-----------------------------------------------------------
-- 4. ELIMINACIÓN SEGURA DE USUARIOS (Soluciona Error 409)
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_safely(p_target_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_upline_id UUID;
BEGIN
    SELECT sponsor_id INTO v_upline_id FROM public.profiles WHERE id = p_target_uuid;

    UPDATE public.profiles SET sponsor_id = v_upline_id WHERE sponsor_id = p_target_uuid;
    UPDATE public.profiles SET branch_root_id = v_upline_id WHERE branch_root_id = p_target_uuid;
    
    UPDATE public.sucursales SET manager_id = NULL WHERE manager_id = p_target_uuid;
    UPDATE public.sales SET seller_id = NULL WHERE seller_id = p_target_uuid;

    DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE user_id = p_target_uuid);
    DELETE FROM public.commissions WHERE beneficiary_id = p_target_uuid OR source_user_id = p_target_uuid;
    DELETE FROM public.sales WHERE user_id = p_target_uuid;
    DELETE FROM public.payouts WHERE user_id = p_target_uuid;
    DELETE FROM public.liquidations WHERE user_id = p_target_uuid;
    DELETE FROM public.rank_reward_claims WHERE user_id = p_target_uuid;
    DELETE FROM public.user_monthly_bonuses WHERE user_id = p_target_uuid;

    DELETE FROM public.profiles WHERE id = p_target_uuid;
    DELETE FROM auth.users WHERE id = p_target_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------
-- 5. ELIMINACIÓN SEGURA DE PEDIDOS
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_order_safely(p_sale_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.sale_items WHERE sale_id = p_sale_id;
    DELETE FROM public.commissions WHERE source_sale_id = p_sale_id;
    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-----------------------------------------------------------
-- 6. REPARACIÓN DE DATOS MENSUALES (PV/PVG ACTUALES)
-----------------------------------------------------------
DO $$
DECLARE
    v_rec RECORD;
BEGIN
    UPDATE public.profiles SET monthly_pv = 0, monthly_pvg = 0, active_directs_count = 0;

    FOR v_rec IN SELECT id, sponsor_id, (SELECT pv_awarded FROM combos WHERE id = current_combo_id) as combo_pv 
                 FROM profiles WHERE status = 'activo' LOOP
        IF v_rec.combo_pv > 0 THEN
            UPDATE profiles SET monthly_pv = monthly_pv + v_rec.combo_pv WHERE id = v_rec.id;
            PERFORM public.distribute_pvg(v_rec.id, v_rec.combo_pv);
            IF v_rec.combo_pv >= 100 AND v_rec.sponsor_id IS NOT NULL THEN
                UPDATE profiles SET active_directs_count = active_directs_count + 1 WHERE id = v_rec.sponsor_id;
            END IF;
        END IF;
    END LOOP;

    FOR v_rec IN SELECT user_id, total_pv FROM public.sales WHERE status = 'completado' AND created_at >= date_trunc('month', now()) LOOP
        IF v_rec.total_pv > 0 THEN
            UPDATE profiles SET monthly_pv = monthly_pv + v_rec.total_pv WHERE id = v_rec.user_id;
            PERFORM public.distribute_pvg(v_rec.user_id, v_rec.total_pv);
        END IF;
    END LOOP;
END $$;

COMMIT;
