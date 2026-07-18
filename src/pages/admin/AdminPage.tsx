import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, FUNCTIONS_URL } from '../../lib/supabase';
import { money } from '../../lib/format';
import type { Tables, UserRole, Review } from '../../types/database';

type Profile = Tables<'profiles'> & { location: { name: string } | null };
type Product = Tables<'products'>;
type Location = Tables<'locations'>;

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  cajero: 'Cajero',
  cocina: 'Cocina',
  repartidor: 'Repartidor',
};

export default function AdminPage() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<'staff' | 'products' | 'reviews'>('staff');

  // new staff form
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('cajero');
  const [locationId, setLocationId] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // product edit
  const [editing, setEditing] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');

  const refetch = useCallback(async () => {
    const [staffRes, prodRes, locRes, revRes] = await Promise.all([
      supabase.from('profiles').select('*, location:locations(name)').order('created_at'),
      supabase.from('products').select('*').order('sort_order'),
      supabase.from('locations').select('*').eq('active', true),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
    ]);
    setStaff((staffRes.data as Profile[] | null) ?? []);
    setProducts(prodRes.data ?? []);
    setLocations(locRes.data ?? []);
    setReviews(revRes.data ?? []);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createStaff(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setCreatedCreds(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`${FUNCTIONS_URL}/create-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, full_name: fullName, role, location_id: locationId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(data.error ?? 'Error al crear usuario');
      return;
    }
    setCreatedCreds({ email: data.email, password: data.password });
    setEmail('');
    setFullName('');
    setShowForm(false);
    refetch();
  }

  async function toggleActive(p: Profile) {
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id);
    refetch();
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { error } = await supabase
      .from('products')
      .update({
        price: parseFloat(editPrice),
        cost_price: editCost === '' ? null : parseFloat(editCost),
      })
      .eq('id', editing.id);
    if (error) alert(error.message);
    setEditing(null);
    refetch();
  }

  async function toggleProduct(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    refetch();
  }

  async function toggleApprove(r: Review) {
    await supabase.from('reviews').update({ approved: !r.approved }).eq('id', r.id);
    refetch();
  }

  async function deleteReview(r: Review) {
    if (!confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    await supabase.from('reviews').delete().eq('id', r.id);
    refetch();
  }

  const pendingReviews = reviews.filter((r) => !r.approved).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Administración</h1>
      <div className="mb-6 flex gap-2">
        <button onClick={() => setTab('staff')}
          className={`rounded-lg px-4 py-2 font-medium ${tab === 'staff' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 shadow'}`}>
          Personal
        </button>
        <button onClick={() => setTab('products')}
          className={`rounded-lg px-4 py-2 font-medium ${tab === 'products' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 shadow'}`}>
          Catálogo
        </button>
        <button onClick={() => setTab('reviews')}
          className={`rounded-lg px-4 py-2 font-medium ${tab === 'reviews' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 shadow'}`}>
          Reseñas
          {pendingReviews > 0 && (
            <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
              {pendingReviews}
            </span>
          )}
        </button>
      </div>

      {createdCreds && (
        <div className="mb-6 rounded-2xl border-2 border-green-300 bg-green-50 p-6">
          <h3 className="font-bold text-green-900">Usuario creado — anotá la contraseña (se muestra una sola vez)</h3>
          <p className="mt-2 font-mono text-lg">{createdCreds.email}</p>
          <p className="font-mono text-lg">{createdCreds.password}</p>
          <button onClick={() => setCreatedCreds(null)} className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-white">
            Entendido
          </button>
        </div>
      )}

      {tab === 'staff' && (
        <>
          <button onClick={() => setShowForm((v) => !v)}
            className="mb-4 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white active:bg-brand-700">
            {showForm ? 'Cancelar' : '+ Nuevo usuario'}
          </button>

          {showForm && (
            <form onSubmit={createStaff} className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Correo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Nombre completo</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Rol</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="admin">Admin</option>
                  <option value="cajero">Cajero</option>
                  <option value="cocina">Cocina</option>
                  <option value="repartidor">Repartidor</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Sucursal</label>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="">Elegir…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 md:col-span-4">
                <button type="submit" disabled={busy}
                  className="rounded-lg bg-brand-600 px-8 py-3 font-bold text-white disabled:opacity-50">
                  {busy ? 'Creando…' : 'Crear usuario'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Cocina y Repartidor solo tienen sentido en Sucursal Central.
                </p>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-2xl bg-white shadow">
            <table className="w-full text-left">
              <thead className="bg-brand-50 text-sm text-gray-600">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((p) => (
                  <tr key={p.id} className={p.active ? '' : 'text-gray-400'}>
                    <td className="px-4 py-3 font-medium">{p.full_name}</td>
                    <td className="px-4 py-3">{ROLE_LABELS[p.role]}</td>
                    <td className="px-4 py-3">{p.location?.name ?? 'Todas'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.role !== 'superadmin' && (
                        <button onClick={() => toggleActive(p)}
                          className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                          {p.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'products' && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full text-left">
            <thead className="bg-brand-50 text-sm text-gray-600">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Costo est.</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'text-gray-400'}>
                  <td className="px-4 py-3 font-mono text-sm">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right">{money(p.price)}</td>
                  <td className="px-4 py-3 text-right">{p.cost_price != null ? money(p.cost_price) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditing(p);
                        setEditPrice(String(p.price));
                        setEditCost(p.cost_price != null ? String(p.cost_price) : '');
                      }}
                      className="mr-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                      Editar
                    </button>
                    <button onClick={() => toggleProduct(p)}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                      {p.active ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-gray-500 shadow">
              Aún no hay reseñas.
            </p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-amber-400">
                    {'★'.repeat(r.rating)}
                    <span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>
                  </p>
                  {r.comment && <p className="mt-1 text-gray-700">“{r.comment}”</p>}
                  <p className="mt-1 text-sm text-gray-500">
                    {r.customer_name?.trim() || 'Cliente'} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('es-SV')}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    r.approved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {r.approved ? 'Publicada' : 'Pendiente'}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => toggleApprove(r)}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {r.approved ? 'Ocultar' : 'Publicar'}
                </button>
                <button
                  onClick={() => deleteReview(r)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-red-600"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveProduct} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">{editing.name}</h3>
            <label className="mb-1 block text-sm text-gray-600">Precio ($)</label>
            <input type="number" step="0.01" min="0" value={editPrice} required
              onChange={(e) => setEditPrice(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg" />
            <label className="mb-1 block text-sm text-gray-600">Costo estimado ($, vacío = sin costo)</label>
            <input type="number" step="0.0001" min="0" value={editCost}
              onChange={(e) => setEditCost(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(null)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-gray-600">
                Volver
              </button>
              <button type="submit"
                className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
