
-- 1. DETECTAR DUPLICADOS
-- Ejecuta esto para ver qué usuarios comparten el mismo documento
SELECT document_id, COUNT(*), array_agg(full_name) as nombres
FROM public.profiles
GROUP BY document_id
HAVING COUNT(*) > 1;

-- 2. RESOLUCIÓN DE DUPLICADOS (OPCIÓN A: Borrar los más antiguos manteniendo el más reciente)
-- ¡PRECAUCIÓN!: Asegúrate de que no tengan ventas o red asociada si vas a borrar.
-- DELETE FROM public.profiles 
-- WHERE id IN (
--     SELECT id 
--     FROM (
--         SELECT id, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at DESC) as rn
--         FROM public.profiles
--     ) t
--     WHERE rn > 1
-- );

-- 3. RESOLUCIÓN DE DUPLICADOS (OPCIÓN B: Renombrar temporalmente para permitir el parche)
-- Esto añade un sufijo '-DUP' a los duplicados para que puedas aplicar el UNIQUE.
UPDATE public.profiles
SET document_id = document_id || '-DUP'
WHERE id IN (
    SELECT id 
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY created_at DESC) as rn
        FROM public.profiles
        WHERE document_id != '' AND document_id IS NOT NULL
    ) t
    WHERE rn > 1
);
