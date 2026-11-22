import { CONFIG } from '../config.js';
// IndexedDB sebagai penyimpanan lokal. Data demo dan produksi memakai database terpisah.
const NAME = 'warungku-' + CONFIG.MODE;
let dbp;
const open = () => dbp ||= new Promise((ok, no) => {
  const r = indexedDB.open(NAME, 1);
  r.onupgradeneeded = () => ['products', 'transactions', 'audit', 'meta'].forEach(s => r.result.createObjectStore(s, { keyPath: s === 'meta' ? 'k' : 'id' }));
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const done = tx => new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = tx.onabort = () => no(tx.error); });
export const uid = () => crypto.randomUUID();
export async function all(s) { const d = await open(); return new Promise((ok, no) => { const q = d.transaction(s).objectStore(s).getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); }
export async function put(s, v) { const tx = (await open()).transaction(s, 'readwrite'); tx.objectStore(s).put(v); return done(tx); }
export async function del(s, id) { const tx = (await open()).transaction(s, 'readwrite'); tx.objectStore(s).delete(id); return done(tx); }
export const audit = (action, ref, detail = '') => put('audit', { id: uid(), at: Date.now(), action, ref, detail });
const bump = (P, items, sign) => items.forEach(i => P.get(i.productId).onsuccess = e => { const p = e.target.result; if (p && p.stock != null) { p.stock += sign * i.qty; P.put(p); } });
// Idempoten: id transaksi yang sama tidak pernah dicatat dua kali. Transaksi + stok disimpan atomik.
export async function saveSale(t) {
  const tx = (await open()).transaction(['products', 'transactions', 'audit'], 'readwrite'), T = tx.objectStore('transactions');
  T.get(t.id).onsuccess = e => { if (e.target.result) return; T.put(t); bump(tx.objectStore('products'), t.items, -1); };
  return done(tx);
}
export async function voidSale(id, reason) {
  const tx = (await open()).transaction(['products', 'transactions', 'audit'], 'readwrite'), T = tx.objectStore('transactions');
  T.get(id).onsuccess = e => { const t = e.target.result; if (!t || t.status !== 'selesai') return;
    T.put({ ...t, status: 'batal', voidReason: reason, voidAt: Date.now(), synced: false });
    tx.objectStore('audit').put({ id: uid(), at: Date.now(), action: 'batal_transaksi', ref: id, detail: reason });
    bump(tx.objectStore('products'), t.items, 1); };
  return done(tx);
}
