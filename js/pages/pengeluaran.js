import { uid } from '../services/db.js';
import { listExpenses, saveExpense, removeExpense } from '../services/sync.js';
import { rp, toInt } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Pengeluaran';
const CATS = ['Pembelian bahan', 'Listrik', 'Transportasi', 'Kemasan', 'Operasional', 'Lainnya'];
export async function render(root) {
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; let list = [];
  root.innerHTML = `<div class="page-h"><h1>Pengeluaran</h1></div><form id="ef"><div class="row2"><label>Tanggal<input name="at" type="date" class="input" required value="${today}"></label>
    <label>Kategori<select name="cat" class="input">${CATS.map(c => `<option>${c}</option>`).join('')}</select></label></div>
    <div class="row2"><label>Nominal (Rp)<input name="amount" class="input" inputmode="numeric" required></label><label>Deskripsi<input name="note" class="input" maxlength="120"></label></div>
    <button class="btn primary lg" style="margin-top:12px">Catat pengeluaran</button></form><h2 style="margin:20px 0 8px">Riwayat pengeluaran</h2><div id="el" class="list"></div>`;
  const draw = async () => { try { list = (await listExpenses()).sort((a, b) => b.at.localeCompare(a.at)); } catch (er) { toast('Gagal memuat: ' + er.message); }
    $('#el').innerHTML = list.length ? list.map(e => `<div class="item" data-id="${esc(e.id)}"><div><b>${esc(e.category)}</b><small>${esc(e.at)} ${esc(e.note || '')}</small></div>
      <div class="acts"><b>${rp(e.amount)}</b><button class="btn sm danger" data-a="del">Hapus</button></div></div>`).join('') : '<p class="empty">Belum ada pengeluaran.</p>'; };
  $('#ef').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)), amount = toInt(v.amount); if (amount <= 0) return toast('Nominal harus lebih dari 0');
    e.submitter.disabled = true;
    try { await saveExpense({ id: uid(), at: v.at, category: v.cat, amount, note: v.note.trim() }); toast('Pengeluaran tercatat'); e.target.reset(); $('#ef').at.value = today; draw(); }
    catch (er) { toast('Gagal menyimpan: ' + er.message); } e.submitter.disabled = false; };
  root.addEventListener('click', async e => { const b = e.target.closest('[data-a=del]'); if (!b) return; const x = list.find(y => y.id === b.closest('[data-id]').dataset.id);
    if (x && confirm('Hapus pengeluaran ini?')) try { await removeExpense(x); draw(); } catch (er) { toast('Gagal menghapus: ' + er.message); } });
  draw();
}
