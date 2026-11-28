import * as sb from '../services/supabase.js';
import { esc, toast } from './dom.js';

export async function renderArchivedBusinesses(root, afterChange = () => {}) {
  try {
    const rows = await sb.listArchivedBusinesses();
    if (!rows.length) { root.innerHTML = '<p class="muted">Belum ada usaha yang diarsipkan.</p>'; return; }
    root.innerHTML = rows.map(b => `<div class="item" style="align-items:flex-start;gap:10px"><div style="min-width:0;flex:1"><b>${esc(b.name)}</b><small>Diarsipkan: ${new Date(b.archived_at).toLocaleString('id-ID')}</small></div><div class="rc-a" style="flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" type="button" data-restore="${esc(b.id)}">Pulihkan</button><button class="btn sm danger" type="button" data-delete="${esc(b.id)}" data-name="${esc(b.name)}">Hapus permanen</button></div></div>`).join('');
    root.querySelectorAll('[data-restore]').forEach(btn => btn.onclick = async () => { btn.disabled = true; try { await sb.restoreBusiness(btn.dataset.restore); toast('Usaha berhasil dipulihkan', 'success'); await afterChange(); } catch (e) { toast('Gagal memulihkan usaha: ' + e.message, 'error'); btn.disabled = false; } });
    root.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => { const name=btn.dataset.name; if (!confirm('PERINGATAN: seluruh produk, transaksi, pengeluaran, anggota, dan data terkait akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return; const typed=prompt('Ketik nama usaha persis seperti berikut untuk menghapus permanen:\n\n'+name); if(typed===null)return; btn.disabled=true; try { await sb.deleteBusinessPermanently(btn.dataset.delete,typed); toast('Usaha dan seluruh datanya telah dihapus permanen','success'); await afterChange(); } catch(e){toast('Penghapusan dibatalkan: '+e.message,'error');btn.disabled=false;} });
  } catch(e){root.innerHTML=`<p class="empty">${esc(e.message)}</p>`;}
}
