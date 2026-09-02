# Cron del DTE — cola de contingencia y correo al cliente

Workflow en n8n (`n8n.vanguardaiautomations.com`), id `9mbulCZhAVNLY8wr`.
La instancia es la fuente de verdad; esto documenta su forma y por qué.

Se guardaba como JSON importable, pero se desincronizó apenas cambió el diseño.
Un JSON viejo que se puede importar de un clic es peor que no tenerlo.

## Qué hace, cada 10 minutos

```
Cada 10 minutos
  → Drenar cola de emisión      POST emit-dte    {"procesar_pendientes": 50}
  → DTE sellados sin enviar     POST dte-correos {"pendientes": 50}
  → Uno por documento           split de `documentos`
  → Armar adjunto JSON          code, prepareBinaryData
  → Enviar al cliente           Gmail, con el .json adjunto
  → Marcar como enviado         POST dte-correos {"enviados": [id]}
```

## Por qué no habla con la base directamente

La versión anterior leía `dte_documents` por PostgREST, y para saltarse RLS
necesitaba el **service role key** — la llave maestra de toda la base. Darla
para que un cron lea una columna es desproporcionado.

`dte-correos` expone sólo esas dos operaciones y se autentica con
`DTE_WEBHOOK_SECRET`. Si ese secreto se filtra, lo que se pierde es la lista de
documentos por enviar, no la base entera.

## Credencial

Una sola, tipo **Custom Auth**: `Los Pollos Primos — DTE webhook secret`
(`wHZdGmjhmD2r4ptY`). Manda tres cabeceras:

| cabecera | valor | por qué |
|---|---|---|
| `x-webhook-secret` | `DTE_WEBHOOK_SECRET` | lo que autentica de verdad |
| `apikey` | anon key | `emit-dte` corre con `verify_jwt`, el gateway exige un JWT |
| `authorization` | `Bearer` + anon key | idem |

La anon key no es secreta: viaja en el bundle del navegador. Está restringida
por dominio a `xuhrenrsrmktfewfejkm.supabase.co`.

**No se usan Variables de n8n.** `$env` lee variables de entorno del proceso,
no las de Settings → Variables (esas son `$vars`), y el acceso a `$env` viene
bloqueado por defecto. Una credencial funciona en cualquier instancia.

## Correo

Sale por la credencial de Gmail conectada, no por SMTP del dominio, porque no
hay credencial SMTP en la instancia. Para que el remitente sea
`admin@los-pollosprimos.com` hay que crear una credencial SMTP y cambiar el
nodo **Enviar al cliente**.

## Detalles que no son accidentes

- Se marca como enviado **después** de mandar el correo y **uno por uno**: si
  un envío falla, ese documento sigue en cola y se reintenta en 10 minutos sin
  arrastrar a los demás.
- Sólo se manda lo que ya tiene sello. Un DTE sin sello no existe ante Hacienda
  todavía.
- `Drenar cola de emisión` usa `neverError`: que el MH esté caído no debe
  cortar el envío de los correos que sí se pueden mandar.
