
-- ACTUALIZACIÓN DE RANGOS PROFESIONALES (CORRECCIÓN)
-- Ejecuta esto para asegurar que los nombres coincidan exactamente con el Dashboard

UPDATE public.ranks SET name = 'Básico' WHERE name ILIKE 'básico';
UPDATE public.ranks SET name = 'Bronce' WHERE name ILIKE 'bronce';
UPDATE public.ranks SET name = 'Plata' WHERE name ILIKE 'plata';
UPDATE public.ranks SET name = 'Oro' WHERE name ILIKE 'oro';
UPDATE public.ranks SET name = 'Platino' WHERE name ILIKE 'platino';
UPDATE public.ranks SET name = 'Diamante' WHERE name ILIKE 'diamante';

-- Asegurar que los perfiles tengan el nombre capitalizado
UPDATE public.profiles SET current_rank = 'Básico' WHERE current_rank ILIKE 'básico';

-- Verificar/Insertar el orden correcto si faltara
INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, royalties_config)
SELECT 'Básico', 1, 0, 0, 0, 100, '{"N1": 5}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.ranks WHERE name = 'Básico');

INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, royalties_config, required_downline_rank, required_downline_count)
SELECT 'Bronce', 2, 0, 1000, 2, 100, '{"N1": 5, "N2": 3}'::jsonb, NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM public.ranks WHERE name = 'Bronce');

INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, royalties_config, required_downline_rank, required_downline_count)
SELECT 'Plata', 3, 0, 3000, 3, 100, '{"N1": 5, "N2": 5, "N3": 3}'::jsonb, 'Bronce', 2
WHERE NOT EXISTS (SELECT 1 FROM public.ranks WHERE name = 'Plata');

INSERT INTO public.ranks (name, order_index, min_pv, min_pvg, min_active_directs, min_pv_monthly, royalties_config, required_downline_rank, required_downline_count)
SELECT 'Oro', 4, 0, 10000, 4, 100, '{"N1": 5, "N2": 5, "N3": 5, "N4": 3}'::jsonb, 'Plata', 2
WHERE NOT EXISTS (SELECT 1 FROM public.ranks WHERE name = 'Oro');
