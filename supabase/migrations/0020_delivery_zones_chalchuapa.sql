-- Zonas de delivery reales de Chalchuapa (reemplazan las genéricas "Zona 1 / Zona 2").
--
--   Chalchuapa Centro      $1.50  — direcciones dentro del centro de Chalchuapa
--   Chalchuapa Alrededores $2.00  — colonias aledañas, hasta Ciudad Real y El Refugio
--
-- Se actualizan las filas existentes en vez de insertar nuevas para no romper
-- las órdenes que ya referencian estos UUID. Los pedidos históricos conservan su
-- propio `orders.delivery_fee` (está desnormalizado), así que sus totales no cambian.
--
-- El delivery sigue saliendo únicamente de Sucursal Central; Mercado Chalchuapa
-- es solo retiro (`locations.allows_delivery`).

update delivery_zones
   set name = 'Chalchuapa Centro',
       fee  = 1.50
 where id = 'cccccccc-0000-0000-0000-000000000001';

update delivery_zones
   set name = 'Chalchuapa Alrededores',
       fee  = 2.00
 where id = 'cccccccc-0000-0000-0000-000000000002';
