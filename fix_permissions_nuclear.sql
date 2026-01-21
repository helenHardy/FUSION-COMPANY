
-- SOLUCIÓN DEFINITIVA DE PERMISOS (NUCLEAR)
-- Este script garantiza que no haya "Permission Denied" por falta de GRANTs

-- 1. Garantizar acceso al esquema y tablas para roles de Supabase
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.sucursales TO authenticated;
GRANT ALL ON TABLE public.combos TO authenticated;
GRANT ALL ON TABLE public.gain_plans TO authenticated;
GRANT ALL ON TABLE public.inventory TO authenticated;
GRANT ALL ON TABLE public.sales TO authenticated;
GRANT ALL ON TABLE public.sale_items TO authenticated;
GRANT ALL ON TABLE public.commissions TO authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.products TO service_role;
GRANT ALL ON TABLE public.sucursales TO service_role;
GRANT ALL ON TABLE public.combos TO service_role;
GRANT ALL ON TABLE public.gain_plans TO service_role;
GRANT ALL ON TABLE public.inventory TO service_role;
GRANT ALL ON TABLE public.sales TO service_role;
GRANT ALL ON TABLE public.sale_items TO service_role;
GRANT ALL ON TABLE public.commissions TO service_role;

-- 2. Asegurar función de admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Regenerar RLS para tablas clave (ejemplo PRODUCTS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_products" ON public.products;
DROP POLICY IF EXISTS "admin_products" ON public.products;
DROP POLICY IF EXISTS "admin_total_products" ON public.products;

-- Lectura para todos
CREATE POLICY "read_products" ON public.products FOR SELECT USING (true);
-- Escritura total para admin
CREATE POLICY "admin_products" ON public.products FOR ALL USING (public.is_admin());


-- 4. Repetir para SUCURSALES
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "admin_sucursales" ON public.sucursales;

CREATE POLICY "read_sucursales" ON public.sucursales FOR SELECT USING (true);
CREATE POLICY "admin_sucursales" ON public.sucursales FOR ALL USING (public.is_admin());


-- 5. Repetir para COMBOS
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_combos" ON public.combos;
DROP POLICY IF EXISTS "admin_combos" ON public.combos;

CREATE POLICY "read_combos" ON public.combos FOR SELECT USING (true);
CREATE POLICY "admin_combos" ON public.combos FOR ALL USING (public.is_admin());


-- 6. Repetir para GAIN_PLANS
ALTER TABLE public.gain_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_plans" ON public.gain_plans;
DROP POLICY IF EXISTS "admin_plans" ON public.gain_plans;

CREATE POLICY "read_plans" ON public.gain_plans FOR SELECT USING (true);
CREATE POLICY "admin_plans" ON public.gain_plans FOR ALL USING (public.is_admin());
