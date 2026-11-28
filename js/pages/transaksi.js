import { all } from '../services/db.js';
import { ctx, isProd, voidTx, retry } from '../services/sync.js';
const SYNC = { menunggu: 'Menunggu sinkronisasi', tersinkron: 'Tersinkron', gagal: 'Gagal sinkronisasi', lokal: 'Tersimpan lokal' };
import { rp } from '../utils/money.js';
import { $, esc, toast, share } from '../utils/dom.js';
import { receiptText } from './kasir.js';
import { CONFIG } from '../config.js';

export const title = 'Transaksi';
export async function render(root) {
  const dlg = $('#dlg'); let list = [], q = '', m = '', shown = 100;
  root.innerHTML = `<div class="page-h"><h1>Transaksi</h1></div><div class="row2"><input id="q" class="input" type="search" placeholder="Cari nomor atau nama pembeli" aria-label="Cari nomor transaksi atau nama pembeli">
    <select id="m" class="input" aria-label="Metode pembayaran"><option value="">Semua metode</option>${CONFIG.payMethods.map(x => `<option>${x}</option>`).join('')}</select></div><div id="tl" class="list" style="margin-top:12px"></div>`;
  const draw = () => { const f = list.filter(t => (!q || t.no.toLowerCase().includes(q) || (t.customerName || '').toLowerCase().includes(q)) && (!m || t.method === m));
    $('#tl').innerHTML = f.length ? f.slice(0, shown).map(t => `<button class="item btnrow" data-id="${esc(t.id)}"><div><b>${esc(t.no)}</b><small class="meta"><span>${new Date(t.at).toLocaleString('id-ID')}</span><span>${esc(t.customerName || 'Pembeli umum')}</span><span>${esc(t.method)}</span>${t.status !== 'selesai' ? '<span>Dibatalkan</span>' : ''}<span>${SYNC[t.sync] || 'Tersinkron'}</span>${t.demo ? '<span>Demo</span>' : ''}</small></div>
      <b class="${t.status !== 'selesai' ? 'strike' : ''}">${rp(t.total)}</b></button>`).join('') + (f.length > shown ? `<button class="btn" id="more">Tampilkan ${Math.min(100, f.length - shown)} transaksi berikutnya (${f.length - shown} tersisa)</button>` : '') : '<p class="empty">Tidak ada transaksi yang cocok.</p>'; };
  const load = async () => { list = (await all('transactions')).sort((a, b) => b.at - a.at); shown = 100; draw(); };
  const detail = t => { const open = t.status === 'selesai' && ctx.role !== 'kasir' && (!isProd() || t.sync === 'tersinkron'), fail = t.sync === 'gagal';
    dlg.innerHTML = `<h3>${esc(t.no)}</h3><pre class="rc">${esc(receiptText(t))}</pre>
      ${t.status !== 'selesai' ? `<p class="warnbox">Dibatalkan: ${esc(t.voidReason)}</p>` : open ? '<label>Alasan pembatalan<input id="why" class="input" maxlength="120"></label>' : ''}${fail ? `<p class="warnbox">Gagal sinkronisasi: ${esc(t.syncError)}</p>` : ''}
      <div class="rc-a"><button class="btn" id="dx">Tutup</button><button class="btn" id="ds">Bagikan</button>${fail ? '<button class="btn" id="dr">Kirim ulang</button>' : ''}${open ? '<button class="btn danger" id="dv">Batalkan transaksi</button>' : ''}</div>`;
    dlg.showModal(); $('#dx').onclick = () => dlg.close(); $('#ds').onclick = () => share(receiptText(t), t.no);
    if (fail) $('#dr').onclick = async () => { await retry(t.id); dlg.close(); load(); }; if (open) $('#dv').onclick = async () => { const why = $('#why').value.trim(); if (!why) return toast('Isi alasan pembatalan dulu');
      if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
      try { await voidTx(t, why); } catch (er) { return toast('Gagal membatalkan: ' + er.message); } dlg.close(); toast('Transaksi dibatalkan'); dispatchEvent(new Event('wk:changed')); load(); }; };
  root.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value.toLowerCase().trim(); shown = 100; } else if (e.target.id === 'm') { m = e.target.value; shown = 100; } draw(); });
  root.addEventListener('change', e => { if (e.target.id === 'm') { m = e.target.value; shown = 100; draw(); } });
  root.addEventListener('click', e => { if (e.target.closest('#more')) { shown += 100; draw(); return; } const b = e.target.closest('.btnrow'); if (b) detail(list.find(x => x.id === b.dataset.id)); });
  load();
}
