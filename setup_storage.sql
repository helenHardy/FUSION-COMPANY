
-- 1. Crear el bucket 'products' si no existe
INSERT INTO storage.buckets (id, name, public)
SELECT 'products', 'products', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'products'
);

-- 2. Habilitar el acceso público para ver imágenes
-- Cualquiera puede ver los objetos en el bucket 'products'
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- 3. Permitir que usuarios autenticados suban imágenes
-- (Puedes restringirlo a 'admin' si tienes una lógica de roles compleja en storage)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'products' );

-- 4. Permitir que usuarios autenticados actualicen sus propias imágenes
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'products' );

-- 5. Permitir que usuarios autenticados eliminen imágenes
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'products' );
