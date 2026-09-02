import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CustomerInfo } from './createOrder';

type Fiscal = {
  nrc: string;
  cod_actividad: string;
  desc_actividad: string;
  departamento: string;
  municipio: string;
  distrito: string;
  complemento: string;
};

const FISCAL_VACIO: Fiscal = {
  nrc: '', cod_actividad: '', desc_actividad: '',
  departamento: '', municipio: '', distrito: '', complemento: '',
};

/** Los códigos son catálogos del MH: se copian de la tarjeta de contribuyente. */
const CAMPOS_FISCALES: { k: keyof Fiscal; label: string; hint?: string }[] = [
  { k: 'nrc', label: 'NRC' },
  { k: 'cod_actividad', label: 'Cód. actividad', hint: 'CAT-019' },
  { k: 'desc_actividad', label: 'Giro / actividad' },
  { k: 'departamento', label: 'Departamento', hint: 'código, ej. 02' },
  { k: 'municipio', label: 'Municipio', hint: 'código' },
  { k: 'distrito', label: 'Distrito', hint: 'código' },
  { k: 'complemento', label: 'Dirección' },
];

const soloDigitos = (s: string) => s.replace(/\D/g, '');
const clavePhone = (s: string) => soloDigitos(s).slice(-8);

interface Props {
  value: CustomerInfo;
  onChange: (c: CustomerInfo) => void;
}

/**
 * Datos del cliente en la caja.
 *
 * El teléfono es la llave: al teclearlo se busca en el registro y, si el
 * cliente ya vino antes, se llena el resto solo. Esa es toda la gracia — que
 * al frecuente no haya que preguntarle nada más.
 *
 * El crédito fiscal necesita NRC, actividad económica y dirección, que no se
 * teclean con gente esperando. Se capturan UNA vez, se guardan en el registro,
 * y de ahí en adelante basta el NIT.
 */
export default function CustomerPanel({ value, onChange }: Props) {
  const [fiscal, setFiscal] = useState<Fiscal>(FISCAL_VACIO);
  const [conCcf, setConCcf] = useState(false);
  const [encontrado, setEncontrado] = useState<'no' | 'si' | 'con-ccf'>('no');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Evita pisar lo que el cajero está escribiendo con una búsqueda que salió
  // tarde: solo se aplica el resultado de la última consulta lanzada.
  const consulta = useRef(0);

  const buscar = async (campo: 'phone_key' | 'nit_key', clave: string) => {
    if (!clave) return;
    const mia = ++consulta.current;
    const { data } = await supabase
      .from('customers').select('*').eq(campo, clave).maybeSingle();
    if (mia !== consulta.current || !data) return;

    onChange({
      ...value,
      customerId: data.id,
      name: data.name ?? value.name,
      phone: data.phone ?? value.phone,
      email: data.email ?? value.email,
      nit: data.nit ?? value.nit,
    });

    if (data.nit && data.cod_actividad) {
      setFiscal({
        nrc: data.nrc ?? '', cod_actividad: data.cod_actividad ?? '',
        desc_actividad: data.desc_actividad ?? '', departamento: data.departamento ?? '',
        municipio: data.municipio ?? '', distrito: data.distrito ?? '',
        complemento: data.complemento ?? '',
      });
      setConCcf(true);
      setEncontrado('con-ccf');
    } else {
      setEncontrado('si');
    }
  };

  // Búsqueda al parar de escribir. 8 dígitos es un número salvadoreño completo:
  // buscar antes solo devuelve coincidencias equivocadas.
  useEffect(() => {
    const clave = clavePhone(value.phone);
    if (clave.length < 8) return;
    const t = setTimeout(() => buscar('phone_key', clave), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.phone]);

  const fiscalCompleto = CAMPOS_FISCALES.every((c) => fiscal[c.k].trim() !== '')
    && soloDigitos(value.nit).length > 0;

  async function guardarCliente() {
    if (!fiscalCompleto) return;
    setGuardando(true);
    setAviso(null);

    // onConflict por nit_key: si el contribuyente ya existe se actualiza en vez
    // de reventar contra el índice único.
    const fila = {
      phone: value.phone.trim() || null,
      name: value.name.trim() || null,
      email: value.email.trim() || null,
      nit: value.nit.trim(),
      ...Object.fromEntries(CAMPOS_FISCALES.map((c) => [c.k, fiscal[c.k].trim()])),
    };

    const { data, error } = await supabase
      .from('customers')
      .upsert(fila, { onConflict: 'nit_key' })
      .select('id')
      .single();

    setGuardando(false);
    if (error || !data) {
      setAviso(error?.message ?? 'No se pudo guardar el cliente');
      return;
    }
    onChange({ ...value, customerId: data.id });
    setEncontrado('con-ccf');
    setAviso('Cliente guardado. La próxima vez basta el teléfono o el NIT.');
  }

  const campo =
    'w-full glass-sm px-2 lg:px-3 py-2 lg:py-3 text-xs lg:text-sm text-charcoal-800 ' +
    'placeholder:text-gray-500 border border-brand-200 focus:border-brand-500 transition-colors';

  return (
    <div className="mt-2 space-y-2 lg:mt-4 lg:space-y-3">
      <input
        placeholder="Teléfono"
        type="tel"
        inputMode="tel"
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value, customerId: null })}
        className={campo}
        aria-label="Teléfono del cliente"
      />
      {encontrado !== 'no' && (
        <p className="px-1 text-[11px] font-semibold text-green-700">
          ✓ Cliente conocido{encontrado === 'con-ccf' && ' · con crédito fiscal registrado'}
        </p>
      )}

      <input
        placeholder="Nombre"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className={campo}
        aria-label="Nombre del cliente"
      />
      <input
        placeholder="Correo"
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        className={campo}
        aria-label="Correo del cliente"
      />

      <label className="flex items-center gap-2 px-1 text-xs font-semibold text-charcoal-800 lg:text-sm">
        <input
          type="checkbox"
          checked={conCcf}
          onChange={(e) => {
            setConCcf(e.target.checked);
            if (!e.target.checked) onChange({ ...value, nit: '' });
          }}
          className="h-4 w-4"
        />
        El cliente pide crédito fiscal
      </label>

      {conCcf && (
        <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/60 p-2">
          <input
            placeholder="NIT del cliente"
            value={value.nit}
            onChange={(e) => onChange({ ...value, nit: e.target.value, customerId: null })}
            onBlur={() => buscar('nit_key', soloDigitos(value.nit))}
            className={campo}
            aria-label="NIT del cliente"
          />
          {CAMPOS_FISCALES.map((c) => (
            <input
              key={c.k}
              placeholder={c.hint ? `${c.label} (${c.hint})` : c.label}
              value={fiscal[c.k]}
              onChange={(e) => setFiscal({ ...fiscal, [c.k]: e.target.value })}
              className={campo}
              aria-label={c.label}
            />
          ))}

          <button
            type="button"
            onClick={guardarCliente}
            disabled={!fiscalCompleto || guardando}
            className="w-full rounded-lg bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-40 lg:text-sm"
          >
            {guardando ? 'Guardando…' : 'Guardar cliente'}
          </button>

          {aviso && <p className="px-1 text-[11px] leading-snug text-charcoal-800">{aviso}</p>}
          {!value.customerId && (
            <p className="px-1 text-[11px] leading-snug text-chili-600">
              Guardá el cliente antes de cobrar: sin estos datos el Ministerio de
              Hacienda rechaza el crédito fiscal.
            </p>
          )}
        </div>
      )}

      <p className="px-1 text-[11px] leading-snug text-charcoal-400">
        Con el teléfono el cliente queda en el registro y su historial se sincroniza
        con GHL. Con correo, el DTE se le envía automáticamente.
      </p>
    </div>
  );
}
