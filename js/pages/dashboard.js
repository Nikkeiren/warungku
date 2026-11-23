import { all } from '../services/db.js';
import { CONFIG } from '../config.js';
import { rp } from '../utils/money.js';
import { $, esc } from '../utils/dom.js';

export const title = 'Ringkasan';
const DAY = 864e5;
const range = (k, a, b) => { const s = new Date(); s.setHours(0, 0, 0, 0); const z = +s;
  if (k === 'today') return [z, z + DAY]; if (k === 'yday') return [z - DAY, z]; if (k === '7') return [z - 6 * DAY, z + DAY]; if (k === '30') return [z - 29 * DAY, z + DAY];
  return [a ? +new Date(a + 'T00:00') : z, (b ? +new Date(b + 'T00:00') : z) + DAY]; };
export async function render(root) {
  root.innerHTML = `<div class="page-h"><h1>Ringkasan</h1></div><label>Periode<select id="k" class="input"><option value="today">Hari ini</option><option value="yday">Kemarin</option><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="c">Rentang tanggal khusus</option></select></label>
    <div id="cr" class="row2" hidden><label>Dari<input id="a" type="date" class="input"></label><label>Sampai<input id="b" type="date" class="input"></label></div><div id="out"></div>`;
  const tx = await all('transactions'), ps = await all('products');
  const draw = () => {
    const k = $('#k').value, [lo, hi] = range(k, $('#a').value, $('#b').value); $('#cr').hidden = k !== 'c';
    const T = tx.filter(t => t.status === 'selesai' && t.at >= lo && t.at < hi).sort((x, y) => y.at - x.at), sum = f => T.reduce((a, t) => a + f(t), 0);
    const omzet = sum(t => t.total), n = T.length, hpp = sum(t => t.items.reduce((a, i) => a + i.cost * i.qty, 0)), laba = sum(t => t.subtotal - t.discount) - hpp;
    const sold = {}, byM = {}; T.forEach(t => { byM[t.method] = (byM[t.method] || 0) + t.total; t.items.forEach(i => sold[i.name] = (sold[i.name] || 0) + i.qty); });
    const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 3), low = ps.filter(p => p.active && p.stock != null && p.stock <= CONFIG.lowStock);
    const days = []; for (let d = lo; d < hi; d += DAY) days.push(d);
    const vd = days.slice(-60), vals = vd.map(d => T.filter(t => t.at >= d && t.at < d + DAY).reduce((a, t) => a + t.total, 0)), mx = Math.max(...vals, 1);
    const li = (a, f) => a.length ? a.map(f).join('') : '<p class="empty">Belum ada data pada periode ini.</p>', st = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
    $('#out').innerHTML = `<div class="stats">${st('Penjualan (omzet)', rp(omzet))}${st('Jumlah transaksi', n)}${st('Rata-rata per transaksi', rp(n ? omzet / n : 0))}${st('Laba kotor (omzet dikurangi HPP)', rp(laba))}</div>
      <div class="panel"><h2>Grafik penjualan</h2>${n ? `<div class="bars">${vals.map((v, i) => `<div class="bar" title="${new Date(vd[i]).toLocaleDateString('id-ID')}: ${rp(v)}" style="--h:${Math.round(v / mx * 100)}%"><i></i></div>`).join('')}</div>` : '<p class="empty">Belum ada penjualan pada periode ini.</p>'}</div>
      <div class="panel"><h2>Produk terlaris</h2>${li(top, ([nm, q]) => `<p>${esc(nm)}: ${q} terjual</p>`)}</div>
      <div class="panel"><h2>Pemasukan per metode</h2>${li(Object.entries(byM), ([mm, v]) => `<p>${esc(mm)}: ${rp(v)}</p>`)}</div>
      <div class="panel"><h2>Stok menipis</h2>${low.length ? low.map(p => `<p class="warn">${esc(p.name)}: sisa ${p.stock} ${esc(p.unit || '')}</p>`).join('') : '<p class="empty">Semua stok aman.</p>'}</div>
      <div class="panel"><h2>Transaksi terbaru</h2>${li(T.slice(0, 6), t => `<p>${esc(t.no)}: ${rp(t.total)}</p>`)}</div>`; };
  root.addEventListener('input', draw); draw();
}
