
-- PERMISOS TOTALES PARA LA TABLA DE RANGOS
-- Permite a los administradores CREAR, EDITAR y ELIMINAR rangos

ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

-- 1. Permiso de Lectura (Cualquier usuario autenticado)
DROP POLICY IF EXISTS "permitir_lectura_publica_rangos" ON public.ranks;
CREATE POLICY "permitir_lectura_publica_rangos" 
ON public.ranks FOR SELECT 
TO authenticated 
USING (true);

-- 2. Permiso de Inserción (Solo Admins)
DROP POLICY IF EXISTS "permitir_admin_crear_rangos" ON public.ranks;
CREATE POLICY "permitir_admin_crear_rangos" 
ON public.ranks FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 3. Permiso de Actualización (Solo Admins)
DROP POLICY IF EXISTS "permitir_admin_editar_rangos" ON public.ranks;
CREATE POLICY "permitir_admin_editar_rangos" 
ON public.ranks FOR UPDATE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Permiso de Eliminación (Solo Admins)
DROP POLICY IF EXISTS "permitir_admin_borrar_rangos" ON public.ranks;
CREATE POLICY "permitir_admin_borrar_rangos" 
ON public.ranks FOR DELETE
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

COMMENT ON TABLE public.ranks IS 'Tabla de rangos con gestión restringida a administradores.';
