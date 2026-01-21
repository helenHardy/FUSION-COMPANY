
-- BONO DE REGALÍAS (RESIDUAL) - LÓGICA DE BASE DE DATOS

-- 1. Actualizar tabla de Rangos con Requisitos de Regalías
ALTER TABLE public.ranks 
ADD COLUMN IF NOT EXISTS min_active_directs INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_pv_monthly NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS royalties_config JSONB DEFAULT '{}'::jsonb; -- { "N1": 5, "N2": 5, ... }

-- 2. Actualizar perfiles para rastreo mensual
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_pv NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_directs_count INTEGER DEFAULT 0;

-- 3. Función para verificar si un usuario califica para su rango este mes
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
        v_user_record.monthly_pv >= v_rank_record.min_pv_monthly AND
        v_user_record.active_directs_count >= v_rank_record.min_active_directs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para distribuir regalías sobre una venta (re-consumo)
CREATE OR REPLACE FUNCTION public.distribute_royalties(
    p_buyer_id UUID,
    p_total_pv NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_upline_record RECORD;
    v_current_upline_id UUID;
    v_level INTEGER := 1;
    v_percentage NUMERIC;
    v_commission_amount NUMERIC;
    v_rank_record RECORD;
BEGIN
    -- Obtenemos el patrocinador directo
    SELECT sponsor_id INTO v_current_upline_id FROM public.profiles WHERE id = p_buyer_id;

    -- Recorremos hacia arriba hasta 10 niveles (según el requerimiento del usuario)
    WHILE v_current_upline_id IS NOT NULL AND v_level <= 10 LOOP
        SELECT * INTO v_upline_record FROM public.profiles WHERE id = v_current_upline_id;
        SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_upline_record.current_rank;

        -- 1. Verificar si el usuario califica para cobrar regalías este mes
        IF public.check_monthly_qualification(v_current_upline_id) THEN
            -- 2. Buscar el porcentaje para el nivel actual en su configuración de rango
            v_percentage := (v_rank_record.royalties_config->>( 'N' || v_level ))::NUMERIC;

            -- 3. Si tiene porcentaje para este nivel, pagar
            IF v_percentage > 0 THEN
                v_commission_amount := (p_total_pv * v_percentage) / 100;

                -- Registrar la comisión
                INSERT INTO public.commissions (
                    beneficiary_id,
                    source_user_id,
                    amount,
                    commission_type,
                    level_depth
                ) VALUES (
                    v_current_upline_id,
                    p_buyer_id,
                    v_commission_amount,
                    'regalia',
                    v_level
                );

                -- Actualizar ganancias totales
                UPDATE public.profiles 
                SET total_earnings = total_earnings + v_commission_amount
                WHERE id = v_current_upline_id;
            END IF;
        END IF;

        -- Pasar al siguiente nivel
        v_current_upline_id := v_upline_record.sponsor_id;
        v_level := v_level + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CONFIGURACIÓN COMPLETA DE RANGOS Y REGALÍAS
-- Basado en la tabla y requisitos proporcionados por el usuario

-- Primero, limpiamos o preparamos los índices para evitar conflictos
UPDATE public.ranks SET order_index = order_index + 100; 

-- Básico
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Básico', 0, 0, 0, 0, 1, '{}')
ON CONFLICT (name) DO UPDATE SET order_index = 1, royalties_config = '{}';

-- Bronce
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Bronce', 50, 500, 3, 50, 2, '{}')
ON CONFLICT (name) DO UPDATE SET order_index = 2, royalties_config = '{}';

-- Plata
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Plata', 100, 3000, 5, 100, 3, '{"N1": 5}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 3, min_pvg = 3000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5}';

-- Oro
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Oro', 100, 8000, 5, 100, 4, '{"N1": 5, "N2": 5}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 4, min_pvg = 8000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5}';

-- Platino
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Platino', 100, 15000, 5, 100, 5, '{"N1": 5, "N2": 5, "N3": 5}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 5, min_pvg = 15000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5, "N3": 5}';

-- Ámbar
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Ámbar', 100, 30000, 5, 100, 6, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 6, min_pvg = 30000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5, "N3": 5, "N4": 3}';

-- Esmeralda
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Esmeralda', 100, 60000, 5, 100, 7, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 7, min_pvg = 60000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1}';

-- Diamante
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Diamante', 100, 120000, 5, 100, 8, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 8, min_pvg = 120000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1}';

-- Diamante Ejecutivo
INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES ('Diamante Ejecutivo', 100, 250000, 5, 100, 9, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1, "N9": 1, "N10": 1}')
ON CONFLICT (name) DO UPDATE SET 
    order_index = 9, min_pvg = 250000, min_active_directs = 5, min_pv_monthly = 100,
    royalties_config = '{"N1": 5, "N2": 5, "N3": 5, "N4": 3, "N5": 2, "N6": 1, "N7": 1, "N8": 1, "N9": 1, "N10": 1}';

-- Eliminar posibles rangos fantasma que quedaron con el desfase de +100
DELETE FROM public.ranks WHERE order_index > 100;
