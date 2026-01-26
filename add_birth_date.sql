
-- ACTUALIZACIÓN PARA AGREGAR FECHA DE NACIMIENTO
-- 1. Agregar columna a la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. Actualizar la función del trigger para capturar la fecha desde metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    document_id,
    role, 
    status,
    sponsor_id,
    current_combo_id,
    bank_name,
    account_number,
    birth_date
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'document_id',
    COALESCE(new.raw_user_meta_data->>'role', 'afiliado'),
    'pendiente', -- Usuarios creados por registro de afiliados empiezan como pendientes
    (new.raw_user_meta_data->>'sponsor_id')::uuid,
    (new.raw_user_meta_data->>'current_combo_id')::uuid,
    new.raw_user_meta_data->>'bank_name',
    new.raw_user_meta_data->>'account_number',
    (new.raw_user_meta_data->>'birth_date')::date
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
