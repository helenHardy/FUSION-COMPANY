
-- FIX DEFINITIVO PARA RESTRICCIÓN DE ROLES
-- Este script unifica los roles permitidos en el sistema: admin, afiliado, sucursal, cajero.

-- 1. Eliminar cualquier restricción de rol existente
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;

-- 2. Asegurar que no haya nulos o valores extraños temporalmente (opcional pero recomendado)
UPDATE public.profiles SET role = 'afiliado' WHERE role IS NULL OR role NOT IN ('admin', 'afiliado', 'sucursal', 'cajero');

-- 3. Aplicar la nueva restricción con todos los roles necesarios
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'afiliado', 'sucursal', 'cajero'));

-- 4. Notificar éxito
DO $$ 
BEGIN 
    RAISE NOTICE 'Restricción de roles actualizada correctamente a: admin, afiliado, sucursal, cajero'; 
END $$;
