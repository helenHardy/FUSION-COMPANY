-- ========================================================
-- REPARACIÓN INTEGRAL DE PVG Y REGISTRO (V2)
-- ========================================================
-- Este script soluciona:
-- 1. PVG que no incluye el PV propio (Corregido: PVG = PV + Red).
-- 2. Trigger de registro "handle_new_user" silenciado o incompleto.
-- 3. Carga automática de PV mensual al registrarse.
-- 4. Reposición de datos (Repair) para el mes actual.

BEGIN;

-- 1. ACTUALIZAR FUNCIÓN DE REPARTO DE PUNTOS (PVG)
-- Ahora incluye al propio usuario que genera los puntos en su acumulado PVG
CREATE OR REPLACE FUNCTION public.distribute_pvg(
  p_start_user_id UUID,
  p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_current_node UUID;
BEGIN
  v_current_node := p_start_user_id; -- Empezamos por el propio usuario
  WHILE v_current_node IS NOT NULL LOOP
    UPDATE public.profiles SET 
        pvg = COALESCE(pvg, 0) + p_points,
        monthly_pvg = COALESCE(monthly_pvg, 0) + p_points
    WHERE id = v_current_node;
    
    SELECT sponsor_id INTO v_current_node FROM public.profiles WHERE id = v_current_node;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RESTAURAR TRIGGER MAESTRO DE REGISTRO
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_combo_pv NUMERIC := 0;
  v_combo_price NUMERIC := 0;
  v_free_prods INTEGER := 0;
  v_sponsor_id UUID;
BEGIN
  v_sponsor_id := (new.raw_user_meta_data->>'sponsor_id')::uuid;

  -- A. Obtener info del combo (Puntos y Precio)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    SELECT pv_awarded, price, free_products_count 
    INTO v_combo_pv, v_combo_price, v_free_prods 
    FROM public.combos 
    WHERE id = (new.raw_user_meta_data->>'current_combo_id')::uuid;
  END IF;

  -- B. Insertar Nuevo Perfil con PV y Monthly PV iniciales
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
    v_combo_pv, -- Importante para calificar el primer mes
    v_free_prods
  );

  -- C. Cargar deuda de activación al patrocinador
  IF v_combo_price > 0 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET pending_liquidation = COALESCE(pending_liquidation, 0) + v_combo_price WHERE id = v_sponsor_id;
  END IF;

  -- D. Contabilizar directo activo si aplica (+100 PV)
  IF v_combo_pv >= 100 AND v_sponsor_id IS NOT NULL THEN
    UPDATE public.profiles SET active_directs_count = COALESCE(active_directs_count, 0) + 1 WHERE id = v_sponsor_id;
  END IF;

  -- E. DISTRIBUIR PUNTOS A LA RED (PVG incluye al nuevo usuario)
  IF v_combo_pv > 0 THEN 
    PERFORM public.distribute_pvg(new.id, v_combo_pv); 
  END IF;

  -- F. REPARTIR COMISIONES (Residuales de inicio rápido)
  IF (new.raw_user_meta_data->>'current_combo_id') IS NOT NULL THEN
    PERFORM public.distribute_commissions(new.id, (new.raw_user_meta_data->>'current_combo_id')::uuid);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. SCRIPT DE REPARACIÓN (RECALCULAR TODO EL MES ACTUAL)
-- Esta parte arregla los datos de los usuarios que ya están en el sistema
DO $$
DECLARE
    v_sale RECORD;
BEGIN
    -- A. Resetear contadores mensuales (Solo para recalcular)
    UPDATE public.profiles SET monthly_pv = 0, monthly_pvg = 0, active_directs_count = 0;

    -- B. Recargar PV de Activaciones (Usuarios que ya están activos con combo)
    FOR v_sale IN 
        SELECT id, sponsor_id, (SELECT pv_awarded FROM combos WHERE id = current_combo_id) as combo_pv 
        FROM profiles 
        WHERE current_combo_id IS NOT NULL AND status = 'activo'
    LOOP
        IF v_sale.combo_pv > 0 THEN
            UPDATE profiles SET monthly_pv = monthly_pv + v_sale.combo_pv WHERE id = v_sale.id;
            PERFORM public.distribute_pvg(v_sale.id, v_sale.combo_pv);
            
            IF v_sale.combo_pv >= 100 AND v_sale.sponsor_id IS NOT NULL THEN
                UPDATE profiles SET active_directs_count = active_directs_count + 1 WHERE id = v_sale.sponsor_id;
            END IF;
        END IF;
    END LOOP;

    -- C. Recargar PV de Ventas Mensuales (Consumos del mes actual)
    FOR v_sale IN 
        SELECT user_id, total_pv, sponsor_id 
        FROM public.sales s
        JOIN profiles p ON s.user_id = p.id
        WHERE s.status = 'completado' 
        AND s.created_at >= date_trunc('month', now())
    LOOP
        IF v_sale.total_pv > 0 THEN
            -- Un pequeño truco: Para evitar duplicar el PV que ya viene del combo si la venta
            -- fuera la de activación, pero aquí solo procesamos 'sales' (re-consumos)
            UPDATE profiles SET monthly_pv = monthly_pv + v_sale.total_pv WHERE id = v_sale.user_id;
            PERFORM public.distribute_pvg(v_sale.user_id, v_sale.total_pv);
        END IF;
    END LOOP;
END $$;

COMMIT;
