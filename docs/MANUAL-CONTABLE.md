# Manual de Usuario — Sistema Contable
### Los Pollos Primos · Conformidad Ministerio de Hacienda (El Salvador)

> **Aviso importante:** este sistema es una **herramienta de conformidad fiscal**, no reemplaza a un
> contador público autorizado. Conservá siempre los documentos originales (CCF, facturas, recibos) y
> validá los reportes con tu contador antes de presentarlos a la DGII.

---

## Índice

1. [¿Qué es y para quién?](#1-qué-es-y-para-quién)
2. [Cómo entrar y los roles](#2-cómo-entrar-y-los-roles)
3. [Conceptos clave (leé esto primero)](#3-conceptos-clave-leé-esto-primero)
4. [Recorrido por las pestañas](#4-recorrido-por-las-pestañas)
   - [4.1 Dashboard](#41-dashboard)
   - [4.2 Ingresos](#42-ingresos)
   - [4.3 Gastos](#43-gastos)
   - [4.4 Libro Diario](#44-libro-diario)
   - [4.5 Libro Mayor](#45-libro-mayor)
   - [4.6 Reportes DGII](#46-reportes-dgii)
   - [4.7 ISR anual](#47-isr-anual)
5. [Flujos de trabajo (rutina diaria, mensual y anual)](#5-flujos-de-trabajo)
6. [Cómo cerrar el mes (paso a paso)](#6-cómo-cerrar-el-mes-paso-a-paso)
7. [Preguntas frecuentes y solución de problemas](#7-preguntas-frecuentes-y-solución-de-problemas)
8. [Catálogo de cuentas contables](#8-catálogo-de-cuentas-contables)
9. [Glosario](#9-glosario)

---

## 1. ¿Qué es y para quién?

El **Sistema Contable** es una sección dentro del mismo sistema del POS (punto de venta). Sirve para:

- Registrar **ingresos** (ventas) y **gastos** con su IVA.
- Generar automáticamente el **Libro Diario** y el **Libro Mayor** (partida doble).
- Calcular el **IVA mensual (F-07)** y preparar los **Registros de Ventas y Compras** para la DGII.
- Estimar el **ISR anual**.
- Cerrar cada mes para proteger la información una vez revisada.

**Está pensado para:**
- **El dueño (administrador):** hace todo — registra, sincroniza, cierra el mes.
- **El contador:** revisa reportes y marca el mes como "revisado".
- **El auditor:** solo lectura, incluyendo el registro de auditoría.

Para llegar: iniciá sesión en el sistema y hacé clic en **Contabilidad** en el menú superior.

---

## 2. Cómo entrar y los roles

El sistema reutiliza los mismos usuarios del POS. La sección de Contabilidad solo es visible para tres roles:

| Rol | Qué puede hacer |
|-----|-----------------|
| **Admin / Dueño** | Todo: registrar ingresos y gastos, sincronizar del POS, cerrar y reabrir meses. |
| **Contador** | Ver todos los reportes y libros; **marcar un mes como "revisado"**. No registra ni cierra. |
| **Auditor** | Solo lectura de todo, incluido el historial de cambios (auditoría). No modifica nada. |

> Los roles **Cajero, Cocina y Repartidor** no ven la sección de Contabilidad.

**Crear un usuario contador o auditor:** el dueño va a **Administración → Personal → + Nuevo**, elige el rol
**Contador** o **Auditor**, y entrega la contraseña generada a la persona (que debe cambiarla al ingresar).

---

## 3. Conceptos clave (leé esto primero)

### El precio YA incluye el IVA
En El Salvador, el precio que paga el cliente **ya trae el IVA adentro**. Por eso el sistema separa cada venta así:

```
Base (sin IVA) = Total ÷ 1.13
IVA (13%)      = Total − Base
```

**Ejemplo:** un combo de **$11.30** → Base **$10.00** + IVA **$1.30**.
No hay que "sumar" el 13%: ya está incluido en el precio de venta.

### IVA Débito vs. IVA Crédito
- **IVA Débito** = el IVA que **cobrás** a tus clientes en las ventas.
- **IVA Crédito** = el IVA que **pagás** en tus compras (recuperable si tenés CCF).
- **IVA a pagar (F-07)** = IVA Débito − IVA Crédito.
  - Si es **positivo** → le pagás esa diferencia a Hacienda.
  - Si es **negativo** → tenés un **remanente a favor** que se arrastra al mes siguiente.

### Partida doble (por qué todo "cuadra")
Cada operación genera un **asiento** contable donde **la suma de débitos = la suma de créditos**.
El sistema arma estos asientos **automáticamente**; vos no tenés que hacer contabilidad manual.

**Ejemplo — venta de $11.30 en efectivo:**

| Cuenta | Débito | Crédito |
|--------|-------:|--------:|
| Caja y Efectivo | 11.30 | |
| Ventas de Productos | | 10.00 |
| IVA Débito Fiscal | | 1.30 |
| **Totales** | **11.30** | **11.30** |

---

## 4. Recorrido por las pestañas

La sección Contabilidad tiene **7 pestañas**:
**Dashboard · Ingresos · Gastos · Libro Diario · Libro Mayor · Reportes DGII · ISR anual.**
Casi todas tienen un **selector de mes** arriba a la izquierda.

### 4.1 Dashboard

Es la pantalla de resumen fiscal del mes elegido. Muestra:

- **IVA neto a pagar / a favor** (el número grande) — lo que declararás en el F-07.
- Tarjetas con: **Ventas base**, **IVA Débito**, **Compras base**, **IVA Crédito**.
- Un **resumen del mes** con las ventas totales con IVA.
- El **estado del período** (Abierto / Revisado / Cerrado) y los botones para cambiarlo.

**Estados del mes:**
- 🟢 **Abierto** — se pueden registrar y editar ingresos y gastos.
- 🟡 **Revisado** — el contador ya lo revisó (sigue editable hasta que se cierre).
- 🔴 **Cerrado** — **bloqueado**: no se puede registrar ni editar nada de ese mes.

### 4.2 Ingresos

Aquí están las ventas. Dos formas de cargarlas:

**A) Sincronizar desde POS (recomendado).**
Hacé clic en **↻ Sincronizar desde POS**. El sistema toma automáticamente todas las ventas **pagadas o
completadas** del punto de venta (de los últimos 90 días) que aún no estén registradas, y las separa en
base + IVA. Es **seguro repetirlo**: no duplica ventas ya importadas.

- Efectivo → entra como cobro en **Caja**.
- Wompi / tarjeta → entra como cobro en **Bancos**.
- Las ventas importadas del POS llevan la etiqueta **POS** y **no se pueden editar** (inmutabilidad fiscal).

**B) Registrar ingreso manual.**
Para ventas que no pasaron por el POS. Hacé clic en **+ Registrar ingreso**, escribí el **total cobrado
(con IVA incluido)** y el sistema calcula la base y el IVA automáticamente. Podés indicar cliente y número
de documento (opcional).

La tabla muestra fecha, tipo, base, IVA, total, forma de pago y origen (POS o Manual), con totales abajo.

### 4.3 Gastos

Aquí se registran las compras y gastos operativos. Hacé clic en **+ Registrar gasto** y completá:

- **Fecha** y **Categoría** (Ingredientes, Gas, Energía, Agua, Mano de obra, Alquiler, Empaques, Servicios, Otros).
- **Monto base (sin IVA)** — el sistema calcula el IVA y el total.
- **Proveedor** y **NIT del proveedor**.
- **Documento**: tipo (CCF, DTE, Factura, Recibo, Ticket) y número.
- Casillas:
  - **Tiene IVA 13%** — si la compra lleva IVA.
  - **Deducible (ISR)** — si el gasto se puede deducir en la renta.
  - **Crédito fiscal recuperable** — si el IVA de esa compra se puede recuperar.
  - **Retención IVA 1% (Gran Contribuyente)** — ver más abajo.

**⚠️ Regla importante del CCF:** para que el IVA sea **crédito fiscal recuperable**, el documento debe ser
**CCF o DTE**. Si marcás "crédito fiscal" pero elegís otro tipo de documento, el sistema te muestra una
**advertencia** — sin CCF, Hacienda no reconoce el crédito.

**Retención del 1% (solo si sos Gran Contribuyente):**
Si tu negocio es Gran Contribuyente, en compras gravadas **mayores a $100** con CCF podés retener el **1%
del IVA** al proveedor. Al marcar la casilla, el sistema:
- Calcula la retención (1% de la base).
- Le paga al proveedor el **neto** (total − retención).
- Registra la retención como un **pasivo** que debés enterar a Hacienda (aparece en el anexo **F-14**).

> Si **no** sos Gran Contribuyente, dejá esta casilla sin marcar.

### 4.4 Libro Diario

Muestra todos los **asientos** del mes, en orden, cada uno con sus líneas de débito y crédito. Cada asiento
lleva un indicador de que **cuadra** (débitos = créditos). Arriba a la derecha:

- Una insignia general **✓ Débitos = Créditos**.
- Botón **Imprimir / PDF** — genera un documento con formato legal y **espacio para firma** del
  contribuyente y del contador (usá "Guardar como PDF" en el diálogo de impresión).

### 4.5 Libro Mayor

Resume el saldo de **cada cuenta** en el mes: **saldo inicial**, **débitos**, **créditos** y **saldo final**.
El saldo final se marca con **D** (deudor: activos y gastos) o **A** (acreedor: pasivos, capital, ingresos).

Abajo aparece el **Balance de Comprobación**, que suma todos los saldos deudores y acreedores y confirma
que **cuadran** (✓ Cuadrado). Botones para **Imprimir / PDF** y **Descargar CSV**.

### 4.6 Reportes DGII

La pestaña para lo que se presenta a Hacienda. Todo se puede **descargar en CSV** (abre directo en Excel):

- **Declaración F-07 (IVA mensual):** ventas gravadas, débito fiscal, compras gravadas, crédito fiscal y el
  **IVA a pagar** (o remanente a favor). Botón **Descargar F-07 (CSV)**.
- **Anexo F-14** — aparece solo si registraste retenciones: total del 1% de IVA retenido a proveedores.
- **Registro de Ventas:** las ventas a contribuyentes (con NIT) se detallan una por una como **CCF**; las
  ventas a consumidor final se **resumen por día** (así lo pide la ley). Botón **Descargar CSV**.
- **Registro de Compras:** las compras con **crédito fiscal** (CCF/DTE), una por una. Botón **Descargar CSV**.

> **Fecha límite F-07:** antes del **día 20** del mes siguiente. Validá el formato exacto de columnas con tu
> contador según la versión vigente de la DGII antes de presentar.

### 4.7 ISR anual

Estima el **Impuesto sobre la Renta** del año elegido. Determina la renta así:

```
Ingresos gravables (base)
(−) Costo de ventas (COGS: Ingredientes + Empaques)
(=) Utilidad bruta
(−) Gastos operativos deducibles
(=) Utilidad imponible
     → ISR estimado
```

Podés cambiar entre **Persona natural** (tramos progresivos, con exención hasta ~$4,064) y **Persona
jurídica** (25% hasta $150,000 de renta gravada; 30% arriba). Muestra la **tasa efectiva**, el desglose de
gastos deducibles por categoría, y botones **Imprimir / PDF** y **Descargar CSV**.

> El ISR solo toma gastos **marcados como deducibles** y registrados en Contabilidad. El **pollo crudo**
> comprado en el POS debe registrarse también como gasto (categoría **Ingredientes**) para que se refleje aquí.
> La tarifa y las deducciones definitivas se confirman con el contador. **Fecha límite ISR:** 30 de abril.

---

## 5. Flujos de trabajo

### Rutina diaria (dueño)
1. Las ventas se registran solas en el POS durante el día.
2. Registrá los **gastos** del día (gas, ingredientes, etc.) en la pestaña **Gastos**.

### Rutina semanal (dueño)
1. Entrá al **Dashboard** y revisá que no haya alertas ni descuadres.
2. Verificá que los gastos tengan su documento de soporte (CCF).

### Rutina mensual (dueño + contador)
1. **Sincronizá las ventas** del mes desde el POS (pestaña Ingresos).
2. Verificá que todos los **gastos** del mes estén cargados con su documento.
3. Revisá el **Dashboard** (IVA neto) y el **Libro Mayor** (que cuadre).
4. Descargá el **F-07** y los **Registros de Ventas y Compras** (pestaña Reportes DGII).
5. El **contador** marca el mes como **Revisado**.
6. El **dueño** **cierra el mes** (ver sección 6).
7. Presentá el **F-07** en el portal de la DGII **antes del día 20**.

### Rutina anual (contador)
1. En enero–abril, revisá el año completo en la pestaña **ISR anual**.
2. Descargá el cálculo del ISR y presentá la declaración **antes del 30 de abril**.

---

## 6. Cómo cerrar el mes (paso a paso)

Cerrar el mes **bloquea** los ingresos y gastos de ese período para que nadie los altere después de
declarados. Hacelo **solo cuando el mes esté completo y revisado**.

1. En el **Dashboard**, elegí el mes en el selector.
2. Confirmá que las ventas estén sincronizadas y los gastos cargados.
3. (Contador) Clic en **Marcar revisado**.
4. (Dueño) Clic en **Cerrar mes** y confirmá.
5. Verás el candado 🔒 **"Período cerrado"**. A partir de ahí, cualquier intento de registrar o editar un
   ingreso/gasto de ese mes será rechazado.

**¿Te equivocaste?** El dueño puede **Reabrir mes** desde el mismo Dashboard, corregir, y volver a cerrar.
Todos estos cambios quedan registrados en la auditoría.

---

## 7. Preguntas frecuentes y solución de problemas

**No veo la pestaña "Contabilidad".**
Tu usuario no tiene rol Admin, Contador o Auditor. Pedile al dueño que ajuste tu rol.

**Sincronicé del POS pero no aparecen ventas.**
Solo entran ventas **pagadas o completadas** y **no canceladas**. Las ventas en efectivo del POS entran al
completarse; las de tarjeta (Wompi), al confirmarse el pago. Ventas de hace más de 90 días no se sincronizan
automáticamente.

**Sincronicé dos veces, ¿se duplicaron las ventas?**
No. Cada venta del POS se importa una sola vez. Podés sincronizar cuantas veces quieras.

**No puedo registrar un gasto: dice que el período está cerrado.**
Ese mes ya fue cerrado. Pedile al dueño que lo **reabra** (Dashboard → Reabrir mes), o registrá el gasto en
el mes correcto.

**Marqué "crédito fiscal" pero salió una advertencia.**
El crédito fiscal exige **CCF o DTE**. Con factura o recibo común el IVA **no** es recuperable. Cambiá el tipo
de documento o desmarcá "crédito fiscal recuperable".

**El IVA me da "a favor" (negativo). ¿Está mal?**
No necesariamente. Si compraste más de lo que vendiste (con IVA), tenés un **remanente a favor** que se
arrastra al mes siguiente. Es normal en meses de mucha compra.

**No puedo editar una venta que vino del POS.**
Es a propósito (inmutabilidad fiscal). Las ventas del POS son la fuente de la verdad. Si hay un error, se
corrige con un ingreso/ajuste manual, no editando la venta importada.

**¿Cómo obtengo un PDF?**
En Libro Diario, Libro Mayor o ISR, usá **Imprimir / PDF** y en el diálogo del navegador elegí
**"Guardar como PDF"**. Si no se abre la ventana, permití las **ventanas emergentes** para el sitio.

**Los acentos se ven mal en Excel.**
Los CSV ya traen la codificación correcta (UTF-8). Si abrís con doble clic y se ven raros, importalos desde
Excel con codificación **UTF-8**.

---

## 8. Catálogo de cuentas contables

| Código | Cuenta | Tipo |
|--------|--------|------|
| 1101 | Caja y Efectivo | Activo |
| 1102 | Bancos | Activo |
| 1201 | IVA Crédito Fiscal | Activo |
| 2101 | IVA Débito Fiscal | Pasivo |
| 2103 | IVA Retenido por Pagar | Pasivo |
| 3101 | Capital | Capital |
| 4101 | Ventas de Productos | Ingreso |
| 4102 | Ventas de Chimichurri | Ingreso |
| 5101 | Costo de Ingredientes | Gasto (COGS) |
| 5102 | Costo de Pollo Crudo | Gasto (COGS) |
| 5103 | Costo de Empaques | Gasto (COGS) |
| 6101 | Gasto Gas | Gasto operativo |
| 6102 | Gasto Energía Eléctrica | Gasto operativo |
| 6103 | Gasto Agua | Gasto operativo |
| 6104 | Gasto Mano de Obra | Gasto operativo |
| 6105 | Gasto Alquiler | Gasto operativo |
| 6106 | Gasto Servicios | Gasto operativo |
| 6199 | Otros Gastos | Gasto operativo |

Cada categoría de gasto se contabiliza automáticamente en su cuenta. Los gastos de Ingredientes y Empaques
cuentan como **costo de ventas (COGS)** para el cálculo del ISR.

---

## 9. Glosario

- **Base / Base gravable:** el monto de la venta o compra **sin** IVA.
- **IVA Débito:** IVA que cobrás en tus ventas (lo debés a Hacienda).
- **IVA Crédito:** IVA que pagás en tus compras (lo podés recuperar con CCF).
- **CCF (Comprobante de Crédito Fiscal):** documento que respalda el crédito fiscal ante la DGII.
- **DTE:** Documento Tributario Electrónico (equivalente electrónico del CCF).
- **F-07:** declaración mensual de IVA ante la DGII (antes del día 20 del mes siguiente).
- **F-14:** anexo de retenciones y percepciones.
- **ISR:** Impuesto sobre la Renta (declaración anual, antes del 30 de abril).
- **Asiento:** registro contable de una operación, con débitos y créditos que cuadran.
- **Libro Diario:** lista cronológica de todos los asientos.
- **Libro Mayor:** resumen de saldos por cuenta.
- **Balance de Comprobación:** verificación de que la suma de saldos deudores = acreedores.
- **COGS:** costo de los bienes vendidos (ingredientes, pollo, empaques).
- **Gran Contribuyente (GC):** categoría de contribuyente obligado a retener el 1% de IVA a ciertos proveedores.
- **Remanente a favor:** crédito de IVA que sobra un mes y se usa el siguiente.
- **Inmutabilidad fiscal:** las ventas importadas del POS y los meses cerrados no se pueden alterar.

---

*Documento preparado conforme a la normativa vigente del Ministerio de Hacienda de El Salvador (2024–2025).
Sujeto a cambios en la normativa fiscal. Ante cualquier duda, consultá con tu contador.*
