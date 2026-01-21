
-- Actualizar el trigger para capturar Documento y Patrocinador del metadato
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, document_id, role, sponsor_id, status)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    (new.raw_user_meta_data->>'sponsor_id')::uuid,
    'activo'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
