
-- SCRIPT PARA GESTIÓN DE TURNOS AUTOMÁTICOS
-- Este script agrega la columna de turno y las funciones de control

-- 1. Agregar columnas necesarias a la tabla de ventas
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shift_number INTEGER DEFAULT 1;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);

-- 2. Crear tabla de control de turnos diarios
CREATE TABLE IF NOT EXISTS public.shift_control (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id UUID REFERENCES public.sucursales(id) NOT NULL,
    control_date DATE DEFAULT CURRENT_DATE NOT NULL,
    active_shift INTEGER DEFAULT 1 CHECK (active_shift IN (1, 2)),
    is_t1_closed BOOLEAN DEFAULT FALSE,
    is_t2_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, control_date)
);

-- 3. Función para obtener el turno activo (crea el registro si no existe para hoy)
CREATE OR REPLACE FUNCTION public.get_active_shift(p_branch_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_shift INTEGER;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::DATE;
BEGIN
    INSERT INTO public.shift_control (branch_id, control_date, active_shift)
    VALUES (p_branch_id, v_today, 1)
    ON CONFLICT (branch_id, control_date) 
    DO UPDATE SET branch_id = EXCLUDED.branch_id -- No hace nada, solo para obtener el retorno
    RETURNING active_shift INTO v_shift;
    
    RETURN v_shift;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para cerrar el turno actual y pasar al siguiente
CREATE OR REPLACE FUNCTION public.close_current_shift(p_branch_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_current INTEGER;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::DATE;
BEGIN
    SELECT active_shift INTO v_current FROM public.shift_control 
    WHERE branch_id = p_branch_id AND control_date = v_today;
    
    IF v_current IS NULL THEN
        -- Si no existe, lo creamos y cerramos el 1
        INSERT INTO public.shift_control (branch_id, control_date, active_shift, is_t1_closed)
        VALUES (p_branch_id, v_today, 2, TRUE)
        RETURNING active_shift INTO v_current;
        RETURN 2;
    END IF;

    IF v_current = 1 THEN
        UPDATE public.shift_control 
        SET active_shift = 2, is_t1_closed = TRUE 
        WHERE branch_id = p_branch_id AND control_date = v_today;
        RETURN 2;
    ELSE
        UPDATE public.shift_control 
        SET is_t2_closed = TRUE 
        WHERE branch_id = p_branch_id AND control_date = v_today;
        RETURN 0; -- 0 significa que el día terminó
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
