-- ============================================================
-- Los Pollos Primos — 0033 Fecha de corte de la emision
--
-- `procesar_pendientes` busca ventas pagadas que nunca generaron DTE. Sin
-- limite de fecha eso incluye TODA la historia del POS: al pasar a produccion
-- habria emitido 49 documentos fiscales reales, con fecha de hoy, por ventas
-- de hace semanas que nunca se facturaron por este medio.
--
-- El corte no se deduce de nada que ya este en la base: ni el ambiente ni el
-- primer correlativo dicen desde cuando este POS es el emisor oficial. Es un
-- dato del negocio y vive como tal.
--
-- null = sin corte (comportamiento anterior, util en el ambiente de pruebas).
-- ============================================================

alter table fiscal_settings
  add column if not exists emision_desde timestamptz;

comment on column fiscal_settings.emision_desde is
  'Ventas anteriores a esta fecha no se facturan automaticamente. Se pone al '
  'pasar a produccion para no emitir DTE reales por la historia del POS.';
