
-- PERMISOS PARA LA TABLA DE RANGOS
-- Sin esto, el Dashboard no puede mostrar las metas

ALTER TABLE public.ranks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_lectura_publica_rangos" ON public.ranks;
CREATE POLICY "permitir_lectura_publica_rangos" 
ON public.ranks FOR SELECT 
TO authenticated 
USING (true);

-- Notificar éxito
COMMENT ON TABLE public.ranks IS 'Tabla de rangos con lectura habilitada para todos los usuarios autenticados.';
