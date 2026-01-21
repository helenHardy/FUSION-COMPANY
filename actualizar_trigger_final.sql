
-- Versión Final del Trigger de Usuario
-- Captura: Nombre, CI, Patrocinador y Combo de Activación
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    document_id, 
    role, 
    sponsor_id, 
    current_combo_id,
    status,
    activation_date
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id', 
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    (new.raw_user_meta_data->>'sponsor_id')::uuid,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    'activo',
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
