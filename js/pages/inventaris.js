import { all } from '../services/db.js';
import { adjustStock, stockHistory } from '../services/sync.js';
import { toInt } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Inventaris';
export async function render(root) {
  const ps = (await all('products')).filter(p => p.stock != null).sort((a, b) => a.name.localeCompare(b.name)), nm = Object.fromEntries((await all('products')).map(p => [p.id, p.name]));
  let h = []; try { h = await stockHistory(); } catch (e) { toast('Riwayat stok belum bisa dimuat: ' + e.message); }
  root.innerHTML = `<div class="page-h"><h1>Inventaris</h1></div>${ps.length ? `<form id="sf"><label>Produk<select name="pid" class="input">${ps.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (stok ${p.stock})</option>`).join('')}</select></label>
    <div class="row2"><label>Jenis<select name="mode" class="input"><option value="masuk">Stok masuk</option><option value="keluar">Stok keluar</option><option value="set">Penyesuaian (isi stok baru)</option></select></label>
    <label>Jumlah<input name="qty" class="input" inputmode="numeric" required></label></div><label>Catatan<input name="note" class="input" maxlength="120"></label>
    <button class="btn primary lg" style="margin-top:12px">Simpan perubahan stok</button></form>` : '<p class="empty">Belum ada produk dengan stok terlacak. Isi stok saat menambah produk.</p>'}
    <h2 style="margin:20px 0 8px">Riwayat perubahan stok</h2><div class="list">${h.length ? h.map(x => `<div class="item"><div><b>${esc(nm[x.ref] || 'Produk dihapus')}</b><small>${esc(x.detail)}</small></div><small>${new Date(x.at).toLocaleString('id-ID')}</small></div>`).join('') : '<p class="empty">Belum ada perubahan stok.</p>'}</div>`;
  const f = $('#sf'); if (!f) return;
  f.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); e.submitter.disabled = true;
    try { await adjustStock(v.pid, v.mode, toInt(v.qty), v.note.trim()); toast('Stok diperbarui'); render(root); } catch (er) { toast('Gagal: ' + er.message); e.submitter.disabled = false; } };
}
