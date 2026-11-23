import * as sb from './supabase.js';
import { uid } from './db.js';
import { CONFIG } from '../config.js';
// Gambar: dikompres di perangkat (WebP, sisi terpanjang dibatasi), disimpan di bucket privat per business_id, dibaca lewat signed URL.
export async function compress(file, max) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format gambar harus JPG, PNG, atau WebP');
  if (file.size > 15e6) throw new Error('Gambar terlalu besar (maksimal 15 MB)');
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
  if (!blob || blob.size > 1048576) throw new Error('Gambar gagal diproses atau masih terlalu besar setelah dikompres');
  return blob;
}
export async function upload(b, folder, blob) { const path = `${b}/${folder}/${uid()}.webp`; await sb.storageUpload(path, blob); return path; }
export const drop = paths => { const p = paths.filter(Boolean); return p.length ? sb.storageRemove(p).catch(() => {}) : Promise.resolve(); };
const cache = new Map();
export async function urls(paths) {
  const need = [...new Set(paths.filter(p => p && !(cache.get(p)?.exp > Date.now())))];
  if (need.length) try { for (const r of await sb.sign(need)) if (r.signedURL) cache.set(r.path, { url: CONFIG.SUPABASE_URL + '/storage/v1' + r.signedURL, exp: Date.now() + 82800e3 }); } catch {}
  return Object.fromEntries(paths.filter(p => p && cache.get(p)).map(p => [p, cache.get(p).url]));
}
