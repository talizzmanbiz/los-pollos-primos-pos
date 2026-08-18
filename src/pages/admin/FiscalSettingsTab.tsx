import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { FiscalSettings } from '../../types/database';

// Datos del emisor que van dentro de cada DTE. Los códigos de departamento,
// municipio y actividad económica son los catálogos del MH (CAT-012, CAT-013 y
// CAT-019): se copian del registro del contribuyente, no se inventan.
const CAMPOS: { k: keyof FiscalSettings; label: string; hint?: string; req?: boolean }[] = [
  { k: 'nit', label: 'NIT', req: true },
  { k: 'nrc', label: 'NRC', req: true },
  { k: 'nombre', label: 'Razón social', req: true },
  { k: 'nombre_comercial', label: 'Nombre comercial' },
  { k: 'cod_actividad', label: 'Código de actividad económica', hint: 'CAT-019', req: true },
  { k: 'desc_actividad', label: 'Descripción de la actividad', req: true },
  { k: 'departamento', label: 'Departamento', hint: 'código MH, ej. 02 Santa Ana', req: true },
  { k: 'municipio', label: 'Municipio', hint: 'código MH', req: true },
  { k: 'complemento', label: 'Dirección', req: true },
  { k: 'telefono', label: 'Teléfono' },
  { k: 'correo', label: 'Correo del emisor', req: true },
  { k: 'cod_estable_mh', label: 'Cód. establecimiento MH', hint: '4 caracteres' },
  { k: 'cod_estable', label: 'Cód. establecimiento propio' },
  { k: 'cod_punto_venta_mh', label: 'Cód. punto de venta MH', hint: '4 caracteres' },
  { k: 'cod_punto_venta', label: 'Cód. punto de venta propio' },
  { k: 'num_resolucion', label: 'N° de resolución', hint: 'para los anexos F-07' },
  { k: 'serie_documento', label: 'Serie del documento', hint: 'para los anexos F-07' },
];

export default function FiscalSettingsTab() {
  const [row, setRow] = useState<Partial<FiscalSettings>>({ ambiente: '00' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('fiscal_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) setRow(data);
      setLoading(false);
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from('fiscal_settings').upsert({
      ...row,
      id: true,
      updated_at: new Date().toISOString(),
    } as FiscalSettings);
    setSaving(false);
    setMsg(error ? error.message : 'Guardado');
  }

  if (loading) return <p className="text-charcoal-300">Cargando…</p>;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <h3 className="section-title mb-1">Identidad fiscal del emisor</h3>
        <p className="mb-4 text-xs text-charcoal-300">
          Estos datos van dentro de cada DTE que se transmite al Ministerio de Hacienda.
          Si alguno no coincide con el registro del contribuyente, el MH rechaza el documento.
        </p>

        <div className="mb-4 rounded-xl border border-cream-300 p-3">
          <label className="mb-1 block text-sm font-medium text-charcoal-500">Ambiente</label>
          <select
            value={row.ambiente ?? '00'}
            onChange={(e) => setRow({ ...row, ambiente: e.target.value })}
            className="input w-auto"
          >
            <option value="00">00 — Pruebas (apitest.dtes.mh.gob.sv)</option>
            <option value="01">01 — Producción (api.dtes.mh.gob.sv)</option>
          </select>
          {row.ambiente === '01' && (
            <p className="mt-2 text-xs font-medium text-brand-700">
              En producción cada documento transmitido es real y queda ante Hacienda.
              Verificá que MH_API_URL apunte a api.dtes.mh.gob.sv.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS.map(({ k, label, hint, req }) => (
            <div key={k}>
              <label className="mb-1 block text-sm text-charcoal-400">
                {label}{req && <span className="text-brand-600"> *</span>}
              </label>
              <input
                value={(row[k] as string | null) ?? ''}
                onChange={(e) => setRow({ ...row, [k]: e.target.value })}
                required={req}
                className="input"
              />
              {hint && <p className="mt-0.5 text-[11px] text-charcoal-300">{hint}</p>}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {msg && <span className="text-sm text-charcoal-400">{msg}</span>}
        </div>
      </div>
    </form>
  );
}
