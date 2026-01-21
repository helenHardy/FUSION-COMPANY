
-- MOTOR DE REGALÍAS CON COMPRESIÓN DINÁMICA Y BONO DE LEALTAD

CREATE OR REPLACE FUNCTION public.distribute_royalties(
    p_buyer_id UUID,
    p_points NUMERIC
) RETURNS VOID AS $$
DECLARE
    v_current_upline_id UUID;
    v_upline_record RECORD;
    v_rank_record RECORD;
    v_paid_levels INTEGER := 1;
    v_max_levels INTEGER := 10; -- Capacidad máxima de niveles a pagar
    v_percentage NUMERIC;
    v_commission_amount NUMERIC;
    v_loyalty_percentage NUMERIC := 0.50; -- Porcentaje base para el bono de lealtad
    v_loyalty_amount NUMERIC;
BEGIN
    -- Empezamos con el patrocinador directo
    SELECT sponsor_id INTO v_current_upline_id FROM public.profiles WHERE id = p_buyer_id;

    -- Recorremos hacia arriba hasta agotar niveles pagados o el árbol
    WHILE v_current_upline_id IS NOT NULL AND v_paid_levels <= v_max_levels LOOP
        SELECT * INTO v_upline_record FROM public.profiles WHERE id = v_current_upline_id;
        SELECT * INTO v_rank_record FROM public.ranks WHERE name = v_upline_record.current_rank;

        -- 1. ¿EL USUARIO CALIFICA ESTE MES? (Mínimo 100 PV o lo que pida su rango)
        -- Usamos la función check_monthly_qualification que ya creamos
        IF public.check_monthly_qualification(v_current_upline_id) THEN
            
            -- COMPRESIÓN DINÁMICA: Solo contamos el nivel si el usuario califica
            v_percentage := (v_rank_record.royalties_config->>( 'N' || v_paid_levels ))::NUMERIC;

            IF v_percentage > 0 THEN
                v_commission_amount := (p_points * v_percentage) / 100;

                -- A. PAGAR REGALÍA (Al balance disponible)
                INSERT INTO public.commissions (
                    beneficiary_id, source_user_id, amount, commission_type, level_depth
                ) VALUES (
                    v_current_upline_id, p_buyer_id, v_commission_amount, 'regalia', v_paid_levels
                );

                UPDATE public.profiles 
                SET total_earnings = COALESCE(total_earnings, 0) + v_commission_amount
                WHERE id = v_current_upline_id;

                -- B. BONO DE LEALTAD (Al fondo acumulado)
                -- Separamos un 0.5% adicional para el "aguinaldo" anual
                v_loyalty_amount := (p_points * v_loyalty_percentage) / 100;
                
                UPDATE public.profiles 
                SET loyalty_balance = COALESCE(loyalty_balance, 0) + v_loyalty_amount
                WHERE id = v_current_upline_id;
            END IF;

            -- Avanzamos el contador de niveles pagados solo porque este usuario calificó
            v_paid_levels := v_paid_levels + 1;
        
        ELSE
            -- Si NO califica, el sistema "salta" a esta persona.
            -- No sumamos a v_paid_levels, lo que significa que el siguiente calificado
            -- ocupará la posición de pago de este nivel. Eso es COMPRESIÓN DINÁMICA.
            NULL; 
        END IF;

        -- Pasar al siguiente patrocinador
        v_current_upline_id := v_upline_record.sponsor_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
