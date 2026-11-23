import { CONFIG } from '../config.js';
// Klien REST ringan untuk Supabase (GoTrue + PostgREST). Hanya anon key; token pengguna dipakai untuk RLS.
const K = 'warungku.session';
export const configured = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
let sess = JSON.parse(localStorage.getItem(K) || 'null');
const save = s => { sess = s; s ? localStorage.setItem(K, JSON.stringify(s)) : localStorage.removeItem(K); };
export const session = () => sess;
async function call(path, { method = 'GET', body, headers = {}, auth = true } = {}, retry = true) {
  const h = { apikey: CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...headers, Authorization: 'Bearer ' + (auth && sess ? sess.access_token : CONFIG.SUPABASE_ANON_KEY) };
  let r; try { r = await fetch(CONFIG.SUPABASE_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { const e = new Error('Tidak ada koneksi'); e.offline = true; throw e; }
  if (r.status === 401 && auth && sess?.refresh_token && retry) { await refresh(); return call(path, { method, body, headers, auth }, false); }
  const txt = await r.text(); let d = null; try { d = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) { const e = new Error(d?.message || d?.msg || d?.error_description || 'Permintaan gagal (' + r.status + ')'); e.status = r.status; e.code = d?.code; throw e; }
  return d;
}
const setSess = d => save({ access_token: d.access_token, refresh_token: d.refresh_token, user: d.user, exp: Date.now() + d.expires_in * 1000 });
async function refresh() { try { setSess(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token }, auth: false })); } catch (e) { if (!e.offline) save(null); throw e; } }
export const signIn = async (email, password) => setSess(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }));
export async function signUp(email, password) { const d = await call('/auth/v1/signup', { method: 'POST', body: { email, password }, auth: false }); if (d?.access_token) setSess(d); return d; }
export const signOut = () => { save(null); localStorage.removeItem('warungku.ctx'); };
export const rpc = (fn, args) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: args });
export const select = (t, q = '') => call(`/rest/v1/${t}?${q}`);
export const upsert = (t, rows) => call('/rest/v1/' + t, { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
export const patch = (t, q, body) => call(`/rest/v1/${t}?${q}`, { method: 'PATCH', body, headers: { Prefer: 'return=minimal' } });
export const remove = (t, q) => call(`/rest/v1/${t}?${q}`, { method: 'DELETE' });
