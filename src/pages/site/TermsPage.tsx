import { site } from './siteInfo';
import { useSeo } from './useSeo';
import LegalPage from './LegalPage';

const UPDATED = '17 de julio de 2026';

export default function TermsPage() {
  useSeo('Términos de Servicio', `Términos y condiciones de pedidos en ${site.name}.`);

  return (
    <LegalPage title="Términos de Servicio" updated={UPDATED}>
        <p>
          Al hacer un pedido en {site.name} ({site.domain}) aceptás los siguientes términos.
        </p>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Pedidos</h2>
          <p className="mt-2">
            Los precios y la disponibilidad de los productos se muestran en el menú en línea y pueden
            cambiar sin previo aviso. Un pedido se considera confirmado cuando lo recibimos y te lo
            notificamos. Nos reservamos el derecho de rechazar o cancelar un pedido por falta de
            disponibilidad u otras razones operativas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Horarios</h2>
          <p className="mt-2">
            Atendemos {site.hoursShort}. Los pedidos se preparan dentro del horario de atención y el
            tiempo estimado de preparación es de {site.prepTime}.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Entrega y retiro</h2>
          <p className="mt-2">
            {site.delivery.note}. El costo de envío depende de la zona
            {site.delivery.zones.length
              ? ` (${site.delivery.zones.map((z) => `${z.name} ${z.fee}`).join(', ')})`
              : ''}
            . También podés retirar tu pedido en nuestra sucursal. Los tiempos de entrega son estimados y
            pueden variar según la demanda.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Pagos</h2>
          <p className="mt-2">
            Aceptamos pago en efectivo al recibir o recoger el pedido y, cuando esté disponible, pago en
            línea a través de un proveedor externo. Todos los precios están en dólares de los Estados
            Unidos (USD).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Cancelaciones</h2>
          <p className="mt-2">
            Si necesitás cancelar o modificar un pedido, contactanos lo antes posible. Una vez que el
            pedido está en preparación puede que no sea posible cancelarlo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Contacto</h2>
          <p className="mt-2">
            {site.name} · {site.city}
            {site.email ? ` · ${site.email}` : ''}
            {site.whatsappDisplay ? ` · WhatsApp ${site.whatsappDisplay}` : ''}
          </p>
        </section>
    </LegalPage>
  );
}
