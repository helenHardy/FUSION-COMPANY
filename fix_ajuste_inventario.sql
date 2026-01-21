
-- SOLUCIÓN DEFINITIVA PARA AJUSTE DE INVENTARIO
-- Asegurar que el rol 'authenticated' tenga permisos físicos en la tabla
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
GRANT ALL ON public.inventory TO postgres;

-- Re-asegurar la función de admin sin recursión
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-configurar RLS para inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_inventory" ON public.inventory;
DROP POLICY IF EXISTS "admin_inventory" ON public.inventory;
DROP POLICY IF EXISTS "permissive_inventory_v1" ON public.inventory;

-- Permitir lectura a todos los logueados
CREATE POLICY "read_inventory" ON public.inventory
FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir TODO a los admins
CREATE POLICY "admin_inventory" ON public.inventory
FOR ALL USING (public.is_admin());

-- Backup: Si falla por RLS, esto permite el paso mientras se debugea
-- CREATE POLICY "permissive_inventory_v1" ON public.inventory FOR ALL USING (true);
