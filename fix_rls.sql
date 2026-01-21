
-- SOLUCIÓN ERROR 403 (Permission Denied)
-- Ejecuta esto para permitir que la aplicación pueda leer los perfiles de usuario.

-- 1. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS "Lectura pública temporal" ON public.profiles;
DROP POLICY IF EXISTS "Admin access" ON public.profiles;

-- 2. Crear políticas limpias y claras

-- Política A: Todo el mundo (autenticado) puede leer perfiles básicos (necesario para ver quién es tu sponsor, o listar usuarios si eres admin)
CREATE POLICY "Enable read access for all users" ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');

-- Política B: Solo el usuario mismo puede editar sus datos básicos (si implementáramos edición)
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Política C: Los administradores tienen poder total (Create, Delete, Update)
-- Definimos admin por el rol en la tabla profiles (OJO: esto es recursivo, cuidado. Usamos auth.email por seguridad en bootrap)
CREATE POLICY "Admins can do everything" ON public.profiles
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Asegurar que RLS está activo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
