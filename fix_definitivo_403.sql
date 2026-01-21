
-- REPARACIÓN DEFINITIVA DE PERMISOS (OPCIÓN DE EMERGENCIA)
-- Si después de esto sigue fallando, el problema es la conexión o la API Key.

-- 1. DESACTIVAR RLS TEMPORALMENTE (Para probar si el error es la política o el permiso)
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sucursales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gain_plans DISABLE ROW LEVEL SECURITY;

-- 2. RE-GARANTIZAR PERMISOS TOTALES AL ROL 'authenticated'
-- Esto asegura que Postgres permita al usuario usar las tablas.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 3. PERMISOS EXTRA PARA EL ROL 'service_role' (Por si acaso)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. VERIFICACIÓN DE LA FUNCIÓN IS_ADMIN
-- Aseguramos que la función no dependa de RLS de otras tablas.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. RE-ACTIVAR RLS CON POLÍTICA "OPEN" (Solo si quieres volver a protegerlas)
-- Si prefieres probar primero, deja el paso 1 tal cual.
-- Descomenta las siguientes líneas SOLO si el error 403 desaparece:

/*
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permitir_todo_autenticado" ON public.products FOR ALL TO authenticated USING (true);
*/
