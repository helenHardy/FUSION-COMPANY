
-- SCRIPT DE EMERGENCIA: RECUPERAR ACCESO ADMIN
-- Ejecuta esto si perdiste el menú de administrador o te sale error al cargar el perfil.

DO $$
DECLARE
    v_target_id UUID;
BEGIN
    -- 1. Buscar a admin@gmail.com en la tabla interna de Supabase Auth
    SELECT id INTO v_target_id 
    FROM auth.users 
    WHERE email = 'admin@gmail.com' 
    LIMIT 1;

    -- 2. Si existe en Auth, asegurar que exista su Perfil en public.profiles
    IF v_target_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, full_name, role, status, current_rank)
        VALUES (v_target_id, 'Administrador Principal', 'admin', 'activo', 'Básico')
        ON CONFLICT (id) DO UPDATE SET 
            role = 'admin',
            status = 'activo';
            
        RAISE NOTICE 'Acceso para admin@gmail.com restaurado con éxito.';
    ELSE
        RAISE EXCEPTION 'No se encontró el correo admin@gmail.com en Authentication. Regístralo primero.';
    END IF;
END $$;
