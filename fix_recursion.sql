
-- SOLUCIÓN ERROR 500 (Infinite Recursion)
-- El problema es que la política de Admin consulta la tabla profiles, lo que dispara la política de nuevo en bucle infinito.
-- Solución: Usar una función "SECURITY DEFINER" que se salta las reglas de seguridad para hacer esa comprobación específica.

-- 1. Eliminar la política recursiva
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;

-- 2. Crear una función segura para verificar si es admin (se salta RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Volver a crear la política usando la función
CREATE POLICY "Admins can do everything" ON public.profiles
FOR ALL USING ( public.is_admin() );
