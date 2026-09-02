import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { money } from '../../lib/format';

interface Props {
  orderNumber: string;
  total: number;
  url: string;
  onClose: () => void;
}

/**
 * El enlace de pago como QR.
 *
 * Se dibuja en SVG y no como imagen: se ve nítido a cualquier tamaño y en la
 * tablet del mostrador eso importa — un QR borroso se escanea mal justo cuando
 * hay alguien esperando.
 *
 * Corrección de errores M: aguanta que el código se ensucie o se raye la
 * pantalla sin dejar de leerse, y no crece tanto como para achicar los módulos.
 */
function Qr({ valor, lado }: { valor: string; lado: number }) {
  const { d, modulos } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(valor);
    q.make();
    const n = q.getModuleCount();
    let path = '';
    for (let fila = 0; fila < n; fila++) {
      for (let col = 0; col < n; col++) {
        if (q.isDark(fila, col)) path += `M${col} ${fila}h1v1h-1z`;
      }
    }
    return { d: path, modulos: n };
  }, [valor]);

  // El margen de 4 módulos es parte del estándar: sin esa zona en blanco
  // alrededor, muchos lectores no encuentran el código.
  const margen = 4;
  const lienzo = modulos + margen * 2;

  return (
    <svg
      viewBox={`0 0 ${lienzo} ${lienzo}`}
      width={lado}
      height={lado}
      // En un teléfono angosto el QR no cabe a 230px: que se encoja en vez de
      // desbordar el modal, sin perder nitidez porque es vectorial.
      style={{ maxWidth: '100%', height: 'auto' }}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Código QR para pagar con tarjeta"
    >
      <rect width={lienzo} height={lienzo} fill="#ffffff" />
      <g transform={`translate(${margen} ${margen})`} fill="#1a1a1a">
        <path d={d} />
      </g>
    </svg>
  );
}

/**
 * Cobro con tarjeta en el mostrador.
 *
 * La orden ya existe y está PENDIENTE. No se marca pagada acá por mucho que el
 * cliente diga que pagó: el único que lo sabe es el webhook de Wompi, y hasta
 * que llegue, el pedido no aparece en cocina.
 */
export default function CardModal({ orderNumber, total, url, onClose }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [verEnlace, setVerEnlace] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado (http, permisos): se abre el enlace a la vista
      // para poder seleccionarlo a mano.
      setVerEnlace(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center glass-overlay p-0 lg:items-center lg:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl glass-lg p-4 lg:max-w-md lg:rounded-2xl lg:p-8">
        <h3 className="text-2xl font-semibold text-brand-700 lg:text-3xl">💳 Cobro con tarjeta</h3>
        <p className="mt-1 font-mono text-3xl font-bold text-brand-700 lg:text-4xl">{money(total)}</p>
        <p className="text-sm text-charcoal-800">Pedido {orderNumber}</p>

        {/* El QR va sobre blanco siempre: los lectores necesitan el contraste
            y la zona clara, sin importar el fondo de la pantalla. */}
        <div className="mt-4 flex flex-col items-center rounded-2xl bg-white p-4 shadow-inner">
          <Qr valor={url} lado={230} />
          <p className="mt-3 text-center text-sm font-semibold text-charcoal-800">
            Que el cliente lo escanee con la cámara de su teléfono
          </p>
          <p className="mt-0.5 text-center text-xs text-charcoal-300">
            Paga con su tarjeta desde su propio teléfono
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={copiar}
            className="glass-sm min-h-12 py-3 text-base font-semibold text-charcoal-800 transition-all hover:border-brand-400 active:scale-95 lg:min-h-14 lg:py-4"
            aria-label="Copiar el enlace de pago"
          >
            {copiado ? '✓ Copiado' : '📋 Copiar enlace'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-xl bg-brand-600 py-3 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 active:bg-brand-800 lg:min-h-14 lg:py-4"
            aria-label="Abrir el formulario de pago en esta pantalla"
          >
            Pagar aquí
          </a>
        </div>

        <button
          onClick={() => setVerEnlace((v) => !v)}
          className="mt-3 w-full text-xs text-charcoal-300 underline underline-offset-2"
        >
          {verEnlace ? 'Ocultar el enlace' : 'Ver el enlace escrito'}
        </button>
        {verEnlace && (
          <p className="mt-2 select-all break-all rounded-lg bg-white/60 p-2 font-mono text-xs text-brand-700">
            {url}
          </p>
        )}

        <p className="mt-4 text-xs text-charcoal-800 lg:text-sm">
          El pedido entra a cocina cuando Wompi confirme el pago. Si la tarjeta
          no pasa, la orden queda pendiente y se puede cobrar en efectivo.
        </p>

        <button
          onClick={onClose}
          className="glass-sm mt-5 min-h-12 w-full py-3 text-base font-semibold text-charcoal-800 transition-all hover:border-brand-300 active:scale-95 lg:mt-6 lg:min-h-14 lg:py-4"
          aria-label="Cerrar"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
