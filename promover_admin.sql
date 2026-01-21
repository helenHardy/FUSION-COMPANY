
-- Este script promueve al usuario admin@gmail.com al rol de Administrador.
-- Debe ejecutarse DESPUÉS de haber creado el usuario.

UPDATE public.profiles
SET role = 'admin'
FROM auth.users
WHERE public.profiles.id = auth.users.id
AND auth.users.email = 'admin@gmail.com';
