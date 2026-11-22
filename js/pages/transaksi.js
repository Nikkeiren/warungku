import { all, voidSale } from '../services/db.js';
import { rp } from '../utils/money.js';
import { $, esc, toast, share } from '../utils/dom.js';
import { receiptText } from './kasir.js';
import { CONFIG } from '../config.js';

export const title = 'Transaksi';
export async function render(root) {
  const dlg = $('#dlg'); let list = [], q = '', m = '';
  root.innerHTML = `<div class="page-h"><h1>Transaksi</h1></div><div class="row2"><input id="q" class="input" type="search" placeholder="Cari nomor transaksi" aria-label="Cari nomor transaksi">
    <select id="m" class="input" aria-label="Metode pembayaran"><option value="">Semua metode</option>${CONFIG.payMethods.map(x => `<option>${x}</option>`).join('')}</select></div><div id="tl" class="list" style="margin-top:12px"></div>`;
  const draw = () => { const f = list.filter(t => (!q || t.no.toLowerCase().includes(q)) && (!m || t.method === m));
    $('#tl').innerHTML = f.length ? f.slice(0, 200).map(t => `<button class="item btnrow" data-id="${esc(t.id)}"><div><b>${esc(t.no)}</b><small class="meta"><span>${new Date(t.at).toLocaleString('id-ID')}</span><span>${esc(t.method)}</span>${t.status !== 'selesai' ? '<span>Dibatalkan</span>' : ''}${t.demo ? '<span>Demo</span>' : ''}</small></div>
      <b class="${t.status !== 'selesai' ? 'strike' : ''}">${rp(t.total)}</b></button>`).join('') : '<p class="empty">Tidak ada transaksi yang cocok.</p>'; };
  const load = async () => { list = (await all('transactions')).sort((a, b) => b.at - a.at); draw(); };
  const detail = t => { const open = t.status === 'selesai';
    dlg.innerHTML = `<h3>${esc(t.no)}</h3><pre class="rc">${esc(receiptText(t))}</pre>
      ${open ? '<label>Alasan pembatalan<input id="why" class="input" maxlength="120"></label>' : `<p class="warnbox">Dibatalkan: ${esc(t.voidReason)}</p>`}
      <div class="rc-a"><button class="btn" id="dx">Tutup</button><button class="btn" id="ds">Bagikan</button>${open ? '<button class="btn danger" id="dv">Batalkan transaksi</button>' : ''}</div>`;
    dlg.showModal(); $('#dx').onclick = () => dlg.close(); $('#ds').onclick = () => share(receiptText(t), t.no);
    if (open) $('#dv').onclick = async () => { const why = $('#why').value.trim(); if (!why) return toast('Isi alasan pembatalan dulu');
      if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
      await voidSale(t.id, why); dlg.close(); toast('Transaksi dibatalkan'); dispatchEvent(new Event('wk:changed')); load(); }; };
  root.addEventListener('input', e => { if (e.target.id === 'q') q = e.target.value.toLowerCase().trim(); else if (e.target.id === 'm') m = e.target.value; draw(); });
  root.addEventListener('click', e => { const b = e.target.closest('.btnrow'); if (b) detail(list.find(x => x.id === b.dataset.id)); });
  load();
}
