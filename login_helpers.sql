
-- Función para obtener el correo electrónico asociado a un documento de identidad (Carnet)
-- Esta función es 'security definer' para poder acceder a la tabla auth.users que está protegida.
CREATE OR REPLACE FUNCTION public.get_user_email_by_document(p_document_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT au.email INTO v_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.document_id = p_document_id
    LIMIT 1;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario para PostgREST
COMMENT ON FUNCTION public.get_user_email_by_document IS 'Busca el correo electrónico de un usuario basado en su Document ID (Carnet).';
