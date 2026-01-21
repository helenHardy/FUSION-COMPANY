
-- 1. ACTUALIZACIÓN DE TABLAS PARA MLM PROFESIONAL

-- A. Perfiles: Añadir balance de lealtad
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS loyalty_balance NUMERIC(10, 2) DEFAULT 0;

-- B. Rangos: Añadir requisitos de estructura
-- required_downline_rank: El nombre del rango que debe haber debajo (ej: 'Plata')
-- required_downline_count: Cuántos socios de ese rango se necesitan
ALTER TABLE public.ranks 
ADD COLUMN IF NOT EXISTS required_downline_rank TEXT,
ADD COLUMN IF NOT EXISTS required_downline_count INTEGER DEFAULT 0;


-- 2. ACTUALIZAR CONFIGURACIÓN DE RANGOS PROFESIONALES
-- Ejemplo de requisitos estructurales:

UPDATE public.ranks 
SET required_downline_rank = 'Básico', required_downline_count = 3
WHERE name = 'Bronce';

UPDATE public.ranks 
SET required_downline_rank = 'Bronce', required_downline_count = 2
WHERE name = 'Plata';

UPDATE public.ranks 
SET required_downline_rank = 'Plata', required_downline_count = 2
WHERE name = 'Oro';

UPDATE public.ranks 
SET required_downline_rank = 'Oro', required_downline_count = 2
WHERE name = 'Platino';
