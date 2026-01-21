
-- RESET TOTAL DE PERMISOS (SOLUCIÓN DEFINITIVA)
-- Ejecuta esto para limpiar y regenerar todos los permisos de la tabla profiles correctamente.

-- Asegurar que RLS está activo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Borrar todas las políticas existentes para empezar de cero
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS "Lectura pública temporal" ON public.profiles;
DROP POLICY IF EXISTS "Admin access" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;
DROP POLICY IF EXISTS "Permitir lectura a autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir editar propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir insertar propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admin total" ON public.profiles;

-- 2. Función de seguridad para ADMIN (evita recursión infinita)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica si el usuario actual es admin consultando la tabla directamente
  -- SECURITY DEFINER permite que esta función lea la tabla ignorando RLS
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear Políticas Claras

-- A. LECTURA: Cualquier usuario autenticado puede ver perfiles (necesario para cargar el dashboard)
CREATE POLICY "lectura_general" ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- B. EDICIÓN PROPIA: Usuario edita su propio perfil
CREATE POLICY "edicion_propia" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- C. INSERCIÓN PROPIA: Usuario crea su propio perfil (al registrarse)
CREATE POLICY "insercion_propia" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- D. ADMIN TOTAL: El admin puede hacer TODO (incluso borrar o editar otros)
CREATE POLICY "admin_total" ON public.profiles
FOR ALL USING (public.is_admin());

-- 4. Permisos de GRANT (Capa extra de seguridad)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
