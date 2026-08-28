# Facturación electrónica y anexos F-07 — Ministerio de Hacienda (El Salvador)

Cubre tres cosas:

1. **Registro detallado de compras** con todas las columnas que pide el anexo 3.
2. **Anexos del F-07** en el formato exacto que acepta el portal del MH.
3. **Emisión de DTE** de cada venta y envío por correo al cliente.

---

## 1. Formato de los anexos

Los tres anexos **no son CSV estándar**. El formato se sacó de las macros de la
plantilla oficial `PLANTILLAS IVA F-07 v11.7.4` (ContaPortable), que es la que
usan los contadores hoy:

| Regla | Valor |
|---|---|
| Separador | `;` (punto y coma) |
| Fila de encabezados | **no lleva** |
| Fin de línea | CRLF |
| Extensión | `.csv` |
| Codificación | latin1, **sin BOM** (el BOM se pega a la fecha e invalida el registro) |
| Columnas de lista | sólo el **código**: `03`, no `03. COMPROBANTE DE CRÉDITO FISCAL` |
| Números | siempre 2 decimales; una celda vacía se manda como `0.00`, nunca en blanco |
| Fechas | `DD/MM/YYYY` |
| NIT, NRC, DUI, N° de documento | **sin guiones** |
| Nombres | MAYÚSCULAS, sin `;` `'` `"`, máximo 100 caracteres |

Implementado en [`src/lib/hacienda.ts`](../src/lib/hacienda.ts). El formato está
verificado renglón por renglón contra los ejemplos que trae la plantilla oficial:

```bash
node --experimental-strip-types src/lib/hacienda.check.ts
```

### Columnas por anexo

| Anexo | N° | Columnas | Origen de los datos |
|---|---|---|---|
| Contribuyentes | 1 | 20 | `dte_documents` con `tipo_dte = '03'` (un renglón por CCF) |
| Consumidor final | 2 | 23 | `dte_documents` con `tipo_dte = '01'`, resumido por día con rango de documentos |
| Compras | 3 | 21 | `accounting_transactions_expense` |

Se descargan en **Contabilidad → Reportes → Anexos del F-07**.

> En la **factura de consumidor final** el IVA va incluido en el precio: el anexo
> reporta la venta gravada **con** IVA (por eso en la plantilla oficial la columna
> de gravadas y la de total coinciden). En el **CCF** van separados.

---

## 2. Registro de compras

**Lotes → Compras (F-07)**. Una compra guarda, además del monto:

- clase y tipo de documento (códigos del MH)
- desglose entre compras internas / internaciones / importaciones, exentas y gravadas
- NIT/NRC o DUI del proveedor
- los cuatro códigos de renta vigentes desde febrero 2024: tipo de operación,
  clasificación, sector y tipo de costo/gasto

Se extendió `accounting_transactions_expense` en vez de crear una tabla aparte:
el F-07 tiene que salir de una sola fuente o las cifras se desincronizan con el
libro de compras y con el ISR.

La tabla `accounting_suppliers` recuerda el NIT y los códigos de cada proveedor,
así que a partir de la segunda compra sólo se teclea el monto.

### Importación automática desde el correo

`docs/n8n/escaneo-compras-dte.workflow.json` — todos los días a las 7:00:

1. Lee los correos no leídos de `admin@los-pollosprimos.com` por IMAP.
2. Saca el adjunto `.json` (el DTE que los emisores están obligados a enviar).
3. Lo manda a la Edge Function `import-purchase-dte`.
4. Si algún documento falla, avisa por correo; el resto se importa igual.

El `codigoGeneracion` del DTE es único ante Hacienda y tiene índice único en la
base, así que **reprocesar el mismo correo no duplica la compra**.

Si un proveedor manda sólo PDF, no se importa (queda para captura manual). Añadir
OCR sólo si resulta que pasa seguido.

---

## 3. Emisión de DTE

Todas las ventas emiten documento: **con NIT → CCF (03)**, **sin NIT → factura de
consumidor final (01)**.

```
Caja cobra
   ↓  (la venta ya está cerrada; el MH no la bloquea)
emit-dte  →  reserva correlativo  →  arma JSON  →  firmador  →  api.dtes.mh.gob.sv
   ↓
dte_documents.estado = procesado + sello_recibido
   ↓
n8n manda el correo al cliente (si dejó correo)
```

### Contingencia

Si el firmador o el MH no responden, el documento queda en `contingencia` y el
ticket sale con **número de control + código de generación** pero sin sello, que
es justo lo que Hacienda contempla. El workflow de n8n reintenta cada 10 minutos.

Un `RECHAZADO` **no** se reintenta solo: el JSON tiene un dato malo y hay que
corregirlo. Se ve en `dte_documents.ultimo_error`.

El drenado de cola también busca **ventas pagadas sin ningún DTE** — el caso que
de verdad importa, porque una venta cobrada sin documento es una venta sin
documentar ante Hacienda.

### Puesta en marcha

**a) Migraciones**

> ⚠️ **No usar `supabase db push` en este proyecto.** El historial remoto se
> escribió con nombres de timestamp (`20260712143122_core_schema`) y los archivos
> locales usan `00NN_*.sql`, así que la CLI no los reconoce como aplicados e
> intentaría reejecutar el esquema completo desde cero.

Aplicá `0022_compras_anexo.sql` y `0023_dte.sql` pegándolas en el **SQL Editor**
del dashboard, o con `apply_migration` del MCP de Supabase. Después regenerá los
tipos:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

(los tipos ya están extendidos a mano para que compile; regenerar los deja limpios).

**b) Firmador del MH**

El firmador es un servicio que da el propio Ministerio y corre junto a n8n en el
VPS. Necesita el `.crt` que se descarga del portal de DTE:

```bash
docker run -d --name firmador -p 127.0.0.1:8113:8080 \
  -v /opt/dte/certificados:/uploads \
  svfe/svfe-api-firmador:v20260316
```

Verificá que responde antes de seguir:

```bash
curl -s http://localhost:8113/firmardocumento/ -X POST -H 'content-type: application/json' -d '{}'
```

**c) Secretos de las Edge Functions** (Dashboard → Edge Functions → Secrets)

| Secreto | Valor |
|---|---|
| `MH_API_URL` | `https://apitest.dtes.mh.gob.sv` en pruebas · `https://api.dtes.mh.gob.sv` en producción |
| `MH_USER` | usuario del portal DTE (normalmente el NIT del emisor) |
| `MH_PASSWORD` | clave del **API** (no la del portal web) |
| `FIRMADOR_URL` | `https://tu-vps:8113/firmardocumento/` |
| `FIRMADOR_PASSWORD` | clave privada del certificado |
| `DTE_WEBHOOK_SECRET` | cadena aleatoria compartida con n8n |

```bash
supabase functions deploy emit-dte
supabase functions deploy import-purchase-dte
```

**d) Identidad fiscal**

**Administración → Datos fiscales**. Todo tiene que coincidir con el registro del
contribuyente o el MH rechaza el documento. Los códigos de departamento,
municipio y actividad económica salen de los catálogos CAT-012, CAT-013 y CAT-019.

Dejar `ambiente = 00` (pruebas) hasta que un documento salga `PROCESADO` con sello.
Recién ahí pasar a `01`.

**e) n8n**

Importar los dos workflows de `docs/n8n/`, poner las credenciales IMAP y SMTP de
`admin@los-pollosprimos.com` y definir las variables de entorno
`DTE_WEBHOOK_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`.

---

## Qué NO cubre esto

- **Anulación e invalidación de DTE** (evento de invalidación al MH). Hoy se hace
  desde el portal del MH.
- **Notas de crédito/débito** (tipos 05 y 06).
- **PDF de representación gráfica**: al cliente se le manda el JSON sellado; el PDF
  se saca del portal del MH con el código de generación.
- **Anexo de retenciones (F-930)** y el detalle de documentos anulados.
- Los montos y códigos los llena el sistema, pero **la declaración la revisa y la
  firma el contador**. Esto no reemplaza a un contador público.
