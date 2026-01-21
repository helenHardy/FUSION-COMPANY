
-- Script de Reparación de Restricciones
-- Ejecuta esto en el SQL Editor de Supabase para arreglar el error 422

-- 1. Eliminar restricciones antiguas si existen
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Asegurar que los datos existentes sean compatibles (convertir active -> activo)
UPDATE public.profiles SET status = 'activo' WHERE status = 'active';
UPDATE public.profiles SET status = 'inactivo' WHERE status = 'inactive';

-- 3. Añadir las nuevas restricciones en Español
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('activo', 'inactivo'));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'afiliado', 'cajero'));

-- 4. Actualizar la función del trigger para asegurar que inserta el estado correcto
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    'activo' -- Asegura que insertamos 'activo', compatible con la restricción
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
