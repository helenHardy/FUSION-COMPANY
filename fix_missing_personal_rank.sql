
-- SCRIPT DE CORRECCIÓN INMEDIATA: ASIGNACIÓN DE RANGO PERSONAL
-- Autor: Sistema AI
-- Objetivo: Forzar que el usuario tenga rango 'PERSONAL' y que este exista en la configuración.

-- 1. INSERTAR O ACTUALIZAR EL RANGO 'PERSONAL' (Asegura que el sistema lo conozca)
INSERT INTO public.ranks (name, royalties_config, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index)
VALUES ('PERSONAL', '{"N1": 5, "N2": 0}'::jsonb, 0, 0, 0, 0, 0)
ON CONFLICT (name) DO UPDATE SET 
    royalties_config = '{"N1": 5, "N2": 0}'::jsonb;

-- 2. PEGAMENTO: ASIGNAR 'PERSONAL' A TODOS LOS USUARIOS SIN RANGO
-- Este paso es CRÍTICO. Si tu usuario tiene el campo vacío, esto lo arregla.
UPDATE public.profiles 
SET current_rank = 'PERSONAL' 
WHERE current_rank IS NULL OR TRIM(current_rank) = '';

-- 3. LIMPIEZA ADICIONAL (Prevenir espacios invisibles)
UPDATE public.profiles 
SET current_rank = 'PERSONAL' 
WHERE LOWER(TRIM(current_rank)) = 'personal' AND current_rank != 'PERSONAL';
