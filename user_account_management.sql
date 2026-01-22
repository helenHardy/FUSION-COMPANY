
-- 1. HABILITAR EXTENSIÓN PARA CRIPTOGRAFÍA SI NO EXISTE
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. FUNCIÓN PARA QUE EL ADMIN RESETEE CONTRASEÑAS
-- Solo los admins pueden ejecutar esto.
-- Recibe el ID del usuario objetivo y la nueva contraseña en texto plano.

CREATE OR REPLACE FUNCTION public.admin_reset_password(
    p_target_user_id UUID,
    p_admin_id UUID,
    p_new_password TEXT
) RETURNS VOID AS $$
BEGIN
    -- Verificar que quien ejecuta es admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = p_admin_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Solo los administradores pueden resetear contraseñas.';
    END IF;

    -- Actualizar la contraseña en auth.users
    -- NOTA: Supabase usa crypt para hashear.
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_target_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. FUNCIÓN PARA ACTUALIZAR DATOS DEL PERFIL (FULL NAME)
-- Aunque se puede hacer con RLS, una función centralizada es más limpia.

CREATE OR REPLACE FUNCTION public.update_profile_data(
    p_user_id UUID,
    p_full_name TEXT
) RETURNS VOID AS $$
BEGIN
    -- El usuario solo puede actualizar su propio perfil
    -- (O un admin podría hacerlo si extendemos la lógica)
    IF auth.uid() <> p_user_id AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'No tienes permiso para actualizar este perfil.';
    END IF;

    UPDATE public.profiles
    SET full_name = p_full_name
    WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
