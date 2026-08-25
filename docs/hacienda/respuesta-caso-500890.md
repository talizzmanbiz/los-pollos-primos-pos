Para: soporte.dtes@mh.gob.sv
Asunto: Seguimiento caso #500890 - Informacion solicitada / Los Pollos Primos - NIT 0019805858

Estimados,

En seguimiento al caso #500890, remito la informacion solicitada.

DATOS DEL CONTRIBUYENTE
Nombre:  Gerson Obed Moran Melgar
Negocio: Los Pollos Primos
NIT:     0019805858
NRC:     3771710
Correo:  admin@los-pollosprimos.com

---

1. MOTIVOS DEL CAMBIO DE PLATAFORMA

Actualmente emitimos nuestros DTE mediante el sistema gratuito de emision
proporcionado por el Ministerio de Hacienda. Solicitamos el cambio por las
siguientes razones operativas:

a) Volumen y velocidad de atencion. Somos un restaurante de comida rapida con
   atencion en mostrador y a domicilio. La emision manual documento por documento
   en el portal no es compatible con el ritmo de atencion en caja, generando
   demoras al cliente y riesgo de ventas sin documentar en las horas pico.

b) Integracion con el control de inventario y costos. Necesitamos que el
   documento tributario se genere desde la misma operacion de venta que descarga
   inventario y registra el costo, evitando la doble digitacion y las
   diferencias entre lo declarado y lo registrado contablemente.

c) Cumplimiento del Anexo F-07 y del Libro de Compras. Nuestro sistema ya genera
   el registro de compras y los anexos del F-07 en el formato requerido. Integrar
   la emision permite que ventas y compras salgan de una unica fuente de datos.

d) Continuidad ante fallas de conectividad. Requerimos manejar contingencia
   automatica, de modo que una interrupcion de internet no detenga la venta y el
   documento se transmita al restablecerse el servicio.

2. FORMA DE ADQUISICION DEL SISTEMA DE FACTURACION

El sistema es INTERNO Y PROPIO. Es desarrollado directamente por el
contribuyente para uso exclusivo de su propio negocio. No se trata de un
sistema adquirido a un proveedor externo, por lo que no existe proveedor de
software del cual reportar nombre comercial, razon social ni NIT.

Caracteristicas tecnicas:
- Nombre interno del sistema: Los Pollos Primos POS
- Uso: exclusivo del contribuyente, no comercializado a terceros
- Construccion del DTE conforme a los esquemas JSON oficiales del MH
  (fe-fc-v1 para Factura y fe-ccf-v3 para Comprobante de Credito Fiscal)
- Firma mediante el firmador oficial del MH (svfe-api-firmador)
- Transmision a los servicios de recepcion del MH, con manejo de contingencia
  y reintento automatico
- Control correlativo del numero de control a nivel transaccional, sin huecos
  en la numeracion

3. PLAN DE TRABAJO Y CRONOGRAMA

Fase 1 - Habilitacion del ambiente de pruebas
  [FECHA_INICIO] a [FECHA_FIN]
  - Presentacion de la solicitud de adicion de DTE en factura.gob.sv
  - Espera de habilitacion del ambiente de pruebas
  - Generacion de credenciales del API en ambiente de pruebas

Fase 2 - Pruebas de Factura (tipo 01)
  [FECHA_INICIO] a [FECHA_FIN]
  - Transmision de los casos minimos requeridos para Factura de consumidor final
  - Validacion de totales, totalLetras y estructura del resumen
  - Correccion de observaciones que resulten del ambiente de pruebas

Fase 3 - Pruebas de Comprobante de Credito Fiscal (tipo 03)
  [FECHA_INICIO] a [FECHA_FIN]
  - Transmision de los casos minimos requeridos para CCF
  - Validacion del tributo 20 (IVA 13%) en el resumen y del calculo de la base

Fase 4 - Pruebas de Nota de Credito (tipo 05) e invalidacion
  [FECHA_INICIO] a [FECHA_FIN]
  - Transmision de los casos minimos de Nota de Credito
  - Pruebas del evento de invalidacion de documentos

Fase 5 - Solicitud de autorizacion como emisor
  [FECHA_INICIO] a [FECHA_FIN]
  - Presentacion de resultados de pruebas
  - Solicitud de autorizacion para emitir en ambiente de produccion
  - Periodo de operacion en paralelo antes del corte definitivo

Durante todo el proceso continuaremos emitiendo nuestros documentos fiscales por
la plataforma actualmente habilitada, sin interrumpir las operaciones del
negocio, conforme a lo indicado en su respuesta.

4. SOLICITUD DE ADICION DE DTE

Procederemos a presentar la solicitud de adicion en factura.gob.sv conforme al
procedimiento indicado. Los documentos que solicitaremos, acordes a nuestro
modelo de negocio de venta de alimentos al consumidor final, son:

  01  Factura
  03  Comprobante de Credito Fiscal
  05  Nota de Credito

Conforme a su indicacion, NO seleccionaremos Comprobante de Donacion, Documento
Contable de Liquidacion ni Comprobante de Retencion, por no corresponder a
nuestro modelo de negocio.

CONSULTA: Su respuesta sugiere seleccionar tambien Factura de Exportacion y Nota
de Remision. Como nuestro negocio es venta de alimentos preparados para consumo
local, no preveemos emitir esos documentos. Agradecemos nos confirmen si su
inclusion es recomendable de todas formas, y si al incluirlos quedariamos
obligados a transmitir las pruebas minimas correspondientes a esos tipos, lo
cual consideraremos para el cronograma.

Quedo atento a sus indicaciones.

Atentamente,

Gerson Obed Moran Melgar
Los Pollos Primos
NIT: 0019805858 / NRC: 3771710
