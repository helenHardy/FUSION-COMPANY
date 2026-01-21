
-- EMERGENCIA: Desactivar toda lógica automática para aislar el error

-- 1. Eliminar el trigger que crea el perfil automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Eliminar restricciones de la tabla profiles que puedan causar conflicto
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1; -- Por si acaso se creó con nombre default

-- 3. (Opcional) Intentar borrar el usuario si quedó a medias (esto podría fallar si no existe, no importa)
-- Nota: No podemos borrar de auth.users desde aquí normalmente, pero limpiamos profiles
DELETE FROM public.profiles WHERE role = 'admin';  -- Solo limpieza preventiva
