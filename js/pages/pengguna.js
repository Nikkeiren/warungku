import * as sb from '../services/supabase.js';
import { ctx } from '../services/sync.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Pengguna';
export async function render(root) {
  const b = ctx.business.id;
  root.innerHTML = `<div class="page-h"><h1>Pengguna</h1></div><div id="ml" class="list"></div><form id="mf"><h2 style="margin-top:20px">Tambah atau ubah anggota</h2>
    <label>Email (harus sudah mendaftar di Warungku)<input name="email" type="email" class="input" required></label>
    <label>Role<select name="role" class="input"><option value="kasir">Kasir: transaksi dan riwayat</option><option value="admin">Admin: produk, stok, ringkasan, pembatalan</option></select></label>
    <button class="btn primary lg" style="margin-top:12px">Simpan anggota</button></form>`;
  const draw = async () => { try { const m = await sb.rpc('list_members', { b });
    $('#ml').innerHTML = m.map(x => `<div class="item"><div><b>${esc(x.email)}</b><small>${esc(x.role)}</small></div>${x.role === 'owner' ? '' : `<button class="btn sm danger" data-u="${esc(x.user_id)}">Hapus</button>`}</div>`).join('');
  } catch (er) { $('#ml').innerHTML = `<p class="empty">${esc(er.message)}</p>`; } };
  $('#mf').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target);
    try { await sb.rpc('set_member', { b, p_email: f.get('email').trim(), p_role: f.get('role') }); toast('Anggota tersimpan'); e.target.reset(); draw(); } catch (er) { toast(er.message); } };
  root.addEventListener('click', async e => { const u = e.target.closest('[data-u]')?.dataset.u; if (!u || !confirm('Hapus anggota ini dari usaha?')) return;
    try { await sb.rpc('remove_member', { b, u }); draw(); } catch (er) { toast(er.message); } });
  draw();
}
