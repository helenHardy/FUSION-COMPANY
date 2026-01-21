
-- Agregar campo para cantidad de productos gratis en Combos
ALTER TABLE public.combos 
ADD COLUMN IF NOT EXISTS free_products_count integer DEFAULT 0;

-- Comentario para documentación
COMMENT ON COLUMN public.combos.free_products_count IS 'Cantidad de productos que el usuario puede elegir gratis con este combo';
