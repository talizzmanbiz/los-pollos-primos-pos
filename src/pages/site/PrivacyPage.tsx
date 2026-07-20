import { site } from './siteInfo';
import { useSeo } from './useSeo';
import LegalPage from './LegalPage';

const UPDATED = '17 de julio de 2026';

export default function PrivacyPage() {
  useSeo('Política de Privacidad', `Cómo ${site.name} recolecta y usa tus datos al hacer un pedido.`);

  return (
    <LegalPage title="Política de Privacidad" updated={UPDATED}>
        <p>
          En {site.name} ({site.domain}) respetamos tu privacidad. Esta política explica qué datos
          recolectamos cuando hacés un pedido y cómo los usamos.
        </p>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Datos que recolectamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Nombre y número de teléfono, para identificar y coordinar tu pedido.</li>
            <li>Dirección de entrega, únicamente cuando elegís servicio a domicilio.</li>
            <li>Detalle de tu pedido (productos, cantidades, total).</li>
            <li>Correo electrónico, solo si nos lo proporcionás.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Cómo usamos tus datos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Preparar, cobrar y entregar tu pedido.</li>
            <li>Comunicarnos con vos sobre el estado del pedido, por teléfono o WhatsApp.</li>
            <li>Llevar un registro de clientes para mejorar nuestro servicio.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Pagos</h2>
          <p className="mt-2">
            No almacenamos datos de tarjetas de crédito o débito. Los pagos en línea, cuando estén
            disponibles, son procesados por un proveedor de pagos externo que maneja tu información
            financiera de forma segura. Los pagos en efectivo se realizan al recibir o recoger el pedido.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Con quién compartimos</h2>
          <p className="mt-2">
            No vendemos tus datos. Los compartimos únicamente con los servicios necesarios para operar
            (por ejemplo, plataforma de pedidos, mensajería de WhatsApp y nuestro sistema de gestión de
            clientes) y cuando la ley lo requiera.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-brand-900">Tus derechos</h2>
          <p className="mt-2">
            Podés solicitar acceso, corrección o eliminación de tus datos escribiéndonos
            {site.whatsappDisplay ? ` por WhatsApp al ${site.whatsappDisplay}` : ''}
            {site.email ? ` o al correo ${site.email}` : ''}.
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
