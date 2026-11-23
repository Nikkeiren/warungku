import { all } from '../services/db.js';
import { listExpenses, isProd } from '../services/sync.js';
import { rp } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Laporan';
const p2 = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export function key(ms, g) { const d = new Date(ms), y = d.getFullYear();
  if (g === 'tahun') return String(y); if (g === 'bulan') return `${y}-${p2(d.getMonth() + 1)}`;
  if (g === 'minggu') { const s = new Date(d); s.setDate(d.getDate() - (d.getDay() + 6) % 7); return 'Pekan ' + ymd(s); }
  return ymd(d); }
const cell = c => typeof c === 'number' ? String(c) : '"' + (/^[=+\-@]/.test(String(c ?? '')) ? "'" : '') + String(c ?? '').replace(/"/g, '""') + '"'; // cegah formula injection
export const toCsv = rows => rows.map(r => r.map(cell).join(',')).join('\r\n');
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0), grp = (a, kf) => { const m = {}; a.forEach(x => (m[kf(x)] ||= []).push(x)); return Object.entries(m); };

// Pendapatan = penjualan setelah diskon (tanpa pajak/biaya layanan). Laba kotor = pendapatan - HPP. Laba bersih = laba kotor - biaya operasional.
export function build(tx, ps, ex, from, to, g) {
  const lo = +new Date(from + 'T00:00'), hi = +new Date(to + 'T00:00') + 864e5;
  const T = tx.filter(t => t.status === 'selesai' && t.at >= lo && t.at < hi), E = ex.filter(e => e.at >= from && e.at <= to);
  const cat = Object.fromEntries(ps.map(p => [p.id, p.category || 'Tanpa kategori'])), cogs = t => sum(t.items, i => (i.cost || 0) * i.qty), net = t => t.subtotal - t.discount;
  const rev = sum(T, net), hpp = sum(T, cogs), spend = sum(E, e => e.amount), bahan = sum(E.filter(e => e.category === 'Pembelian bahan'), e => e.amount), opex = spend - bahan;
  const L = T.flatMap(t => t.items.map(i => ({ t, i, id: i.productId, name: i.name, qty: i.qty, rev: i.price * i.qty, cogs: (i.cost || 0) * i.qty })));
  const agg = a => ({ qty: sum(a, l => l.qty), rev: sum(a, l => l.rev), gross: sum(a, l => l.rev - l.cogs) }), sold = Object.fromEntries(grp(L, l => l.id).map(([k, a]) => [k, sum(a, l => l.qty)]));
  return { T, E, L, rev, hpp, gross: rev - hpp, tax: sum(T, t => t.tax), fee: sum(T, t => t.fee), spend, bahan, opex, net: rev - hpp - opex,
    periods: grp(T, t => key(t.at, g)).map(([k, a]) => ({ k, n: a.length, rev: sum(a, net), hpp: sum(a, cogs) })).sort((a, b) => a.k.localeCompare(b.k)),
    byP: grp(L, l => l.id || l.name).map(([, a]) => ({ name: a[0].name, ...agg(a) })).sort((a, b) => b.rev - a.rev),
    byC: grp(L, l => cat[l.id] || 'Tanpa kategori').map(([k, a]) => ({ k, ...agg(a) })).sort((a, b) => b.rev - a.rev),
    byM: grp(T, t => t.method).map(([k, a]) => ({ k, n: a.length, total: sum(a, t => t.total) })).sort((a, b) => b.total - a.total),
    slow: ps.filter(p => p.active).map(p => ({ name: p.name, qty: sold[p.id] || 0 })).sort((a, b) => a.qty - b.qty).slice(0, 5), stock: ps.filter(p => p.stock != null) };
}
const tb = (h, rows) => rows.length ? `<div class="tw"><table class="tb"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">Belum ada data pada periode ini.</p>';

export async function render(root) {
  const now = new Date();
  root.innerHTML = `<div class="page-h noprint"><h1>Laporan</h1></div><div class="noprint"><div class="row2"><label>Dari<input id="f" type="date" class="input" value="${ymd(new Date(now.getFullYear(), now.getMonth(), 1))}"></label><label>Sampai<input id="t" type="date" class="input" value="${ymd(now)}"></label></div>
    <label>Kelompokkan per<select id="g" class="input"><option value="hari">Hari (harian)</option><option value="minggu">Pekan (mingguan)</option><option value="bulan">Bulan (bulanan)</option><option value="tahun">Tahun (tahunan)</option></select></label>
    <div class="rc-a" style="justify-content:flex-start"><button class="btn" id="csv">Unduh CSV</button><button class="btn" id="pdf">Cetak / simpan PDF</button></div></div><div id="out"></div>`;
  const tx = await all('transactions'), ps = await all('products'); let ex = [], R;
  try { ex = await listExpenses(); } catch (e) { toast('Pengeluaran belum bisa dimuat: ' + e.message); }
  const draw = () => { const f = $('#f').value, t = $('#t').value;
    if (!f || !t || f > t) { R = null; return $('#out').innerHTML = '<p class="empty">Rentang tanggal tidak valid.</p>'; }
    R = build(tx, ps, ex, f, t, $('#g').value); const st = (l, v) => `<div class="stat"><small>${l}</small><b>${rp(v)}</b></div>`;
    $('#out').innerHTML = `${isProd() && tx.length >= 500 ? '<p class="warnbox">Hanya 500 transaksi terbaru yang dimuat; laporan periode lama bisa tidak lengkap.</p>' : ''}
      <div class="stats">${st('Pendapatan penjualan', R.rev)}${st('HPP', R.hpp)}${st('Laba kotor', R.gross)}${st('Biaya operasional', R.opex)}${st('Laba bersih', R.net)}</div>
      <p>Pajak ${rp(R.tax)} dan biaya layanan ${rp(R.fee)} tidak dihitung sebagai pendapatan. Pembelian bahan ${rp(R.bahan)} tidak dihitung sebagai biaya karena sudah masuk HPP.</p>
      <div class="panel"><h2>Penjualan per periode</h2>${tb(['Periode', 'Transaksi', 'Pendapatan', 'HPP', 'Laba kotor'], R.periods.map(p => [esc(p.k), p.n, rp(p.rev), rp(p.hpp), rp(p.rev - p.hpp)]))}</div>
      <div class="panel"><h2>Penjualan per produk</h2>${tb(['Produk', 'Terjual', 'Pendapatan', 'Laba kotor'], R.byP.map(p => [esc(p.name), p.qty, rp(p.rev), rp(p.gross)]))}</div>
      <div class="panel"><h2>Penjualan per kategori</h2>${tb(['Kategori', 'Terjual', 'Pendapatan', 'Laba kotor'], R.byC.map(p => [esc(p.k), p.qty, rp(p.rev), rp(p.gross)]))}</div>
      <div class="panel"><h2>Metode pembayaran</h2>${tb(['Metode', 'Transaksi', 'Total diterima'], R.byM.map(p => [esc(p.k), p.n, rp(p.total)]))}</div>
      <div class="panel"><h2>Produk kurang laku</h2>${tb(['Produk', 'Terjual'], R.slow.map(p => [esc(p.name), p.qty]))}</div>
      <div class="panel"><h2>Laporan stok (kondisi saat ini)</h2>${tb(['Produk', 'Stok', 'Nilai modal'], R.stock.map(p => [esc(p.name), p.stock + ' ' + esc(p.unit || ''), rp(p.stock * p.cost)]))}<p>Nilai persediaan: ${rp(R.stock.reduce((s, p) => s + p.stock * p.cost, 0))}</p></div>`; };
  root.addEventListener('input', draw);
  $('#csv').onclick = () => { if (!R) return toast('Rentang tanggal tidak valid');
    const rows = [['No transaksi', 'Tanggal', 'Metode', 'Produk', 'Jumlah', 'Harga satuan', 'HPP satuan', 'Pendapatan', 'Laba kotor'],
      ...R.L.map(l => [l.t.no, ymd(new Date(l.t.at)), l.t.method, l.name, l.qty, l.i.price, l.i.cost || 0, l.rev, l.rev - l.cogs])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })); a.download = `warungku-laporan-${$('#f').value}-${$('#t').value}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  $('#pdf').onclick = () => { if (!R) return toast('Rentang tanggal tidak valid'); document.body.classList.add('rpt'); addEventListener('afterprint', () => document.body.classList.remove('rpt'), { once: true }); print(); };
  draw();
}
