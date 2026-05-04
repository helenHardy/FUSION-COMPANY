
-- SCRIPT PARA AGREGAR NÚMERO DE TICKET SECUENCIAL
-- Este script agrega una columna auto-incremental a la tabla de ventas

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='ticket_number') THEN
        ALTER TABLE public.sales ADD COLUMN ticket_number INTEGER GENERATED ALWAYS AS IDENTITY;
    END IF;
END $$;

-- Comentario: La columna IDENTITY manejará automáticamente la secuencia
-- tanto para registros nuevos como para los existentes.
