
-- RANGOS DE PRUEBA (META MUY BAJA PARA VERIFICACIÓN RÁPIDA)

-- 1. Limpiar rangos actuales para evitar confusiones en las pruebas
DELETE FROM public.ranks;

-- 2. Insertar rangos con metas mínimas (10-30 PV)
-- Esto permite calificar comprando una sola unidad de producto

INSERT INTO public.ranks (name, min_pv, min_pvg, min_active_directs, min_pv_monthly, order_index, royalties_config)
VALUES 
-- Bronce de Prueba: Solo pide 10 PV (1 producto) y 0 directos
('Bronce Test', 10, 10, 0, 10, 1, '{"N1": 10}'),

-- Plata de Prueba: Pide 20 PV y 1 directo activo
('Plata Test', 20, 50, 1, 20, 2, '{"N1": 10, "N2": 5}'),

-- Oro de Prueba: Pide 30 PV y 2 directos activos
('Oro Test', 30, 100, 2, 30, 3, '{"N1": 10, "N2": 5, "N3": 5}');

-- 3. Mensaje de confirmación interno
-- "Rangos de prueba creados. Ahora puedes calificar comprando poco volumen."
