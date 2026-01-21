
-- Intento de reparación total
-- 1. Desactivamos el trigger temporalmente para aislar el problema
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Limpiamos la función
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Volvemos a crear la función simplificada AL MÁXIMO para evitar errores
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status)
  VALUES (
    new.id, 
    -- Si no viene metadata, usar un valor por defecto
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuario Nuevo'), 
    'afiliado',
    'activo'
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Si falla la inserción en el perfil, NO impedir el registro del usuario en auth
  -- Esto nos permitirá ver al usuario en el panel auth aunque no tenga perfil
  RAISE WARNING 'Error creando perfil para el usuario: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reactivamos el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
