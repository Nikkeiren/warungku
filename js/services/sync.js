import * as sb from './supabase.js';
import { all, put, del, uid, audit, voidSale } from './db.js';
import { CONFIG } from '../config.js';

export const ctx = { mode: 'demo', business: null, role: 'owner' };
export const isProd = () => ctx.mode === 'prod';
export const bizName = () => ctx.business?.name || CONFIG.APP_NAME;
export const settings = () => isProd() ? { taxPct: ctx.business.tax_pct, fee: ctx.business.service_fee } : { taxPct: CONFIG.taxPct, fee: CONFIG.serviceFee };
export const saveCtx = () => localStorage.setItem('warungku.ctx', JSON.stringify({ business: ctx.business, role: ctx.role }));

export const toLocal = t => ({ id: t.id, no: t.no, at: +new Date(t.at), subtotal: t.subtotal, discount: t.discount, tax: t.tax, fee: t.fee, total: t.total, method: t.method, paid: t.paid, change: t.change,
  note: t.note || '', customerName: t.customer_name || '', status: t.status, voidReason: t.void_reason, synced: true, sync: 'tersinkron',
  items: (t.transaction_items || []).map(i => ({ productId: i.product_id, name: i.name, price: i.price, cost: i.cost, qty: i.qty })) });
export const payload = t => ({ id: t.id, no: t.no, at: new Date(t.at).toISOString(), subtotal: t.subtotal, discount: t.discount, tax: t.tax, fee: t.fee, total: t.total, method: t.method,
  paid: t.paid, change: t.change, note: t.note || '', customer_name: t.customerName || null, items: t.items.map(i => ({ product_id: i.productId, name: i.name, price: i.price, cost: i.cost || 0, qty: i.qty })) });

// Tarik data server (sumber kebenaran) ke cache lokal.
export async function pull() {
  if (!isProd()) return; const b = ctx.business.id;
  const ps = await sb.select('products', 'select=*&business_id=eq.' + b);
  const ts = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await sb.select('transactions', `select=*,transaction_items(*)&business_id=eq.${b}&order=at.desc&limit=500&offset=${offset}`);
    ts.push(...batch);
    if (batch.length < 500) break;
  }
  const ids = new Set(ps.map(p => p.id)), lt = new Map((await all('transactions')).map(t => [t.id, t]));
  await Promise.all([...ps.map(p => put('products', p)), ...(await all('products')).filter(p => !ids.has(p.id)).map(p => del('products', p.id)),
    ...ts.filter(t => lt.get(t.id)?.sync !== 'menunggu').map(t => put('transactions', toLocal(t)))]);
}
// Kirim antrean transaksi. Server idempoten (id UUID): kirim ulang tidak membuat transaksi ganda.
export async function flush() {
  if (!isProd()) return;
  for (const t of (await all('transactions')).filter(t => !t.seed && t.sync === 'menunggu').sort((a, b) => a.at - b.at)) {
    try { await sb.rpc('create_sale', { b: ctx.business.id, t: payload(t) }); await put('transactions', { ...t, synced: true, sync: 'tersinkron', syncError: null }); dispatchEvent(new Event('wk:synced')); }
    catch (e) { if (e.offline || e.status === 401 || e.status >= 500) break;
      await put('transactions', /23505|duplicate key/.test((e.code || '') + e.message) ? { ...t, synced: true, sync: 'tersinkron' } : { ...t, sync: 'gagal', syncError: e.message }); }
  }
}
let q = Promise.resolve(); // serial: flush dulu, baru pull, agar stok lokal tidak tertimpa
export const syncNow = () => isProd() ? (q = q.then(async () => { await flush().catch(() => {}); await pull().catch(() => {}); dispatchEvent(new Event('wk:changed')); })) : Promise.resolve();
export async function retry(id) { const t = (await all('transactions')).find(x => x.id === id); await put('transactions', { ...t, sync: 'menunggu', syncError: null }); return syncNow(); }
export async function voidTx(t, reason) {
  if (!isProd()) return voidSale(t.id, reason);
  await sb.rpc('void_sale', { b: ctx.business.id, tid: t.id, reason }); await pull();
}
export async function saveProduct(rec, isNew, withStock = isNew) {
  if (!isProd()) { await put('products', rec); return audit(isNew ? 'tambah_produk' : 'ubah_produk', rec.id, rec.name); }
  const { stock, ...rest } = rec, b = ctx.business.id; // stok produk lama hanya diubah lewat Inventaris
  await sb.upsert('products', { ...(withStock ? rec : rest), business_id: b });
  await sb.upsert('audit_log', { business_id: b, action: isNew ? 'tambah_produk' : 'ubah_produk', ref: rec.id, detail: rec.name }); await pull();
}
export async function removeProduct(p) {
  if (!isProd()) { await del('products', p.id); return audit('hapus_produk', p.id, p.name); }
  await sb.remove('products', 'id=eq.' + p.id); if (p.image_path) await sb.storageRemove([p.image_path]).catch(() => {}); await sb.upsert('audit_log', { business_id: ctx.business.id, action: 'hapus_produk', ref: p.id, detail: p.name }); await pull();
}
export async function adjustStock(pid, mode, qty, note) {
  if (isProd()) { await sb.rpc('adjust_stock', { b: ctx.business.id, pid, mode, qty, note }); return pull(); }
  const p = (await all('products')).find(x => x.id === pid), nw = mode === 'masuk' ? p.stock + qty : mode === 'keluar' ? p.stock - qty : qty;
  if (nw < 0) throw new Error('Hasil stok tidak valid');
  await put('products', { ...p, stock: nw }); await put('audit', { id: uid(), at: Date.now(), action: 'stok', ref: pid, detail: `${mode} ${qty}: ${p.stock} ke ${nw}` + (note ? ` (${note})` : '') });
}
export async function stockHistory() {
  const rows = isProd() ? await sb.select('audit_log', `select=at,ref,detail&business_id=eq.${ctx.business.id}&action=eq.stok&order=at.desc&limit=100`) : (await all('audit')).filter(a => a.action === 'stok');
  return rows.map(r => ({ at: +new Date(r.at), ref: r.ref, detail: r.detail })).sort((a, b) => b.at - a.at);
}
// Pengeluaran: produksi langsung ke server (online), demo di IndexedDB.
const aud = (action, ref, detail) => sb.upsert('audit_log', { business_id: ctx.business.id, action, ref, detail });
export const listExpenses = async () => isProd() ? sb.select('expenses', `select=*&business_id=eq.${ctx.business.id}&order=at.desc&limit=1000`) : all('expenses');
export async function saveExpense(e) {
  if (!isProd()) return put('expenses', e);
  await sb.upsert('expenses', { ...e, business_id: ctx.business.id }); await aud('catat_pengeluaran', e.id, `${e.category} ${e.amount}`);
}
export async function removeExpense(e) {
  if (!isProd()) return del('expenses', e.id);
  await sb.remove('expenses', 'id=eq.' + e.id); await aud('hapus_pengeluaran', e.id, `${e.category} ${e.amount}`);
}
