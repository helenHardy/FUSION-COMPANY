
-- SOLUCIÓN PERMISOS TABLAS RESTANTES
-- Habilitar lectura para todos los usuarios autenticados y escritura solo para admins
-- en las tablas de negocio: products, sucursales, combos, gain_plans, inventory.

-- Función auxiliar (ya debería existir por el script anterior, pero la aseguramos)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 1. TABLA: PRODUCTS
-- =========================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_products" ON public.products;
DROP POLICY IF EXISTS "admin_products" ON public.products;

CREATE POLICY "read_products" ON public.products
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_products" ON public.products
FOR ALL USING (public.is_admin());

-- =========================================================
-- 2. TABLA: SUCURSALES
-- =========================================================
ALTER TABLE public.sucursales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "admin_sucursales" ON public.sucursales;

CREATE POLICY "read_sucursales" ON public.sucursales
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_sucursales" ON public.sucursales
FOR ALL USING (public.is_admin());

-- =========================================================
-- 3. TABLA: COMBOS
-- =========================================================
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_combos" ON public.combos;
DROP POLICY IF EXISTS "admin_combos" ON public.combos;

CREATE POLICY "read_combos" ON public.combos
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_combos" ON public.combos
FOR ALL USING (public.is_admin());

-- =========================================================
-- 4. TABLA: GAIN_PLANS
-- =========================================================
ALTER TABLE public.gain_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_plans" ON public.gain_plans;
DROP POLICY IF EXISTS "admin_plans" ON public.gain_plans;

CREATE POLICY "read_plans" ON public.gain_plans
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_plans" ON public.gain_plans
FOR ALL USING (public.is_admin());

-- =========================================================
-- 5. TABLA: INVENTORY
-- =========================================================
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_inventory" ON public.inventory;
DROP POLICY IF EXISTS "admin_inventory" ON public.inventory;

CREATE POLICY "read_inventory" ON public.inventory
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_inventory" ON public.inventory
FOR ALL USING (public.is_admin());
