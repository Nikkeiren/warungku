import { all } from '../services/db.js';
import * as sb from '../services/supabase.js';
import { ctx, isProd, listExpenses, toLocal } from '../services/sync.js';
import { CONFIG } from '../config.js';
import { rp } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Ringkasan';
const ECH = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js', MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
let loading; const loadEcharts = () => window.echarts ? Promise.resolve(window.echarts) : loading ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = ECH; s.onload = () => ok(window.echarts); s.onerror = () => { loading = null; s.remove(); no(new Error('ECharts gagal dimuat')); }; document.head.append(s); });
const fmt = (d, o) => d.toLocaleDateString('id-ID', o);
// Rentang tiap periode: harian = 14 hari, mingguan = 12 pekan (Senin), bulanan = 12 bulan, tahunan = 5 tahun terakhir.
export function buckets(g, now = new Date()) {
  const out = [], y = now.getFullYear(), m = now.getMonth(), d0 = new Date(y, m, now.getDate()), add = (a, f) => { const r = new Date(a); f(r); return r; }, push = (a, b, label, full) => out.push({ lo: +a, hi: +b, label, full });
  if (g === 'hari') for (let i = 13; i >= 0; i--) { const a = add(d0, r => r.setDate(r.getDate() - i)); push(a, add(a, r => r.setDate(r.getDate() + 1)), `${a.getDate()}/${a.getMonth() + 1}`, fmt(a, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })); }
  else if (g === 'minggu') { const mon = add(d0, r => r.setDate(r.getDate() - (r.getDay() + 6) % 7)); for (let i = 11; i >= 0; i--) { const a = add(mon, r => r.setDate(r.getDate() - 7 * i)), b = add(a, r => r.setDate(r.getDate() + 7)), e = add(b, r => r.setDate(r.getDate() - 1));
    push(a, b, `${a.getDate()}/${a.getMonth() + 1}`, `Pekan ${fmt(a, { day: 'numeric', month: 'short' })} - ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`); } }
  else if (g === 'bulan') for (let i = 11; i >= 0; i--) { const a = new Date(y, m - i, 1); push(a, new Date(y, m - i + 1, 1), `${MON[a.getMonth()]} ${String(a.getFullYear()).slice(2)}`, fmt(a, { month: 'long', year: 'numeric' })); }
  else for (let i = 4; i >= 0; i--) push(new Date(y - i, 0, 1), new Date(y - i + 1, 0, 1), String(y - i), `Tahun ${y - i}`);
  return out;
}
// Pendapatan terealisasi: selesai DAN dikonfirmasi server (bukan menunggu/gagal sinkron, bukan dibatalkan). Mode demo: data lokal.
export const REAL = t => t.status === 'selesai' && (t.sync === 'tersinkron' || t.sync === 'lokal' || !!t.seed);
export function compute(B, tx, ex) {
  const lo = B[0].lo, hi = B[B.length - 1].hi, T = tx.filter(t => REAL(t) && t.at >= lo && t.at < hi), idx = ms => B.findIndex(b => ms >= b.lo && ms < b.hi), z = () => B.map(() => 0);
  const rev = z(), cogs = z(), exp = z(), sum = a => a.reduce((x, y) => x + y, 0);
  T.forEach(t => { const i = idx(t.at); rev[i] += t.subtotal - t.discount; cogs[i] += t.items.reduce((a, x) => a + (x.cost || 0) * x.qty, 0); });
  ex.forEach(e => { const a = +new Date(e.at + 'T00:00'); if (e.category !== 'Pembelian bahan' && a >= lo && a < hi) exp[idx(a)] += e.amount; }); // pembelian bahan sudah masuk HPP
  const profit = rev.map((v, i) => v - cogs[i] - exp[i]);
  return { T, rev, exp, profit, totals: { rev: sum(rev), exp: sum(exp), cogs: sum(cogs), profit: sum(profit) } };
}
async function load(B) {
  const lo = B[0].lo, hi = B[B.length - 1].hi;
  if (isProd() && navigator.onLine) try { const rows = [];
    for (let off = 0; off < 30000; off += 1000) { const r = await sb.select('transactions', `select=*,transaction_items(*)&business_id=eq.${ctx.business.id}&status=eq.selesai&at=gte.${new Date(lo).toISOString()}&at=lt.${new Date(hi).toISOString()}&order=at.asc&limit=1000&offset=${off}`); rows.push(...r); if (r.length < 1000) break; }
    return rows.map(toLocal);
  } catch (e) { toast('Gagal memuat dari server, memakai data di perangkat: ' + e.message, 'warning'); }
  return all('transactions');
}
const short = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(Math.abs(v) % 1e6 ? 1 : 0).replace('.', ',') + ' jt' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + ' rb' : String(v);
const COL = { rev: '#145C45', exp: '#B5604B', profit: '#D6A84B' };
export function chartOption(B, c) {
  const ax = '#5F6B63', ln = '#E2DFD3';
  return { animationDuration: 500, animationDurationUpdate: 400, animationEasing: 'cubicOut', grid: { left: 4, right: 12, top: 40, bottom: 4, containLabel: true },
    legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 6, textStyle: { color: ax, fontSize: 12 } },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: '#fff', borderColor: ln, textStyle: { color: '#202923', fontSize: 13 }, axisPointer: { type: 'line', lineStyle: { color: '#A8BDAE' } },
      formatter: ps => `<b>${B[ps[0].dataIndex].full}</b>` + ps.map(p => `<div>${p.marker} ${p.seriesName}: <b>${rp(p.value)}</b></div>`).join('') },
    xAxis: { type: 'category', data: B.map(b => b.label), boundaryGap: false, axisLine: { lineStyle: { color: ln } }, axisTick: { show: false }, axisLabel: { color: ax, fontSize: 12, hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { color: ax, fontSize: 12, formatter: short }, splitLine: { lineStyle: { color: ln, width: 1 } } },
    series: [['Pendapatan', c.rev, COL.rev, true], ['Pengeluaran', c.exp, COL.exp, false], ['Keuntungan', c.profit, COL.profit, false]].map(([name, data, col, area]) => ({ name, type: 'line', smooth: 0.35, symbolSize: 6, showSymbol: data.length <= 14,
      lineStyle: { width: 2, color: col }, itemStyle: { color: col }, areaStyle: area ? { color: col, opacity: 0.1 } : undefined, data })) };
}
export async function render(root) {
  let g = 'hari', chart = null, ro = null, ps = [];
  root.innerHTML = `<div class="page-h"><h1>Ringkasan</h1></div><div class="seg" id="seg">${[['hari', 'Harian'], ['minggu', 'Mingguan'], ['bulan', 'Bulanan'], ['tahun', 'Tahunan']].map(([k, l]) => `<button type="button" data-g="${k}" class="${k === g ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="stats3" id="st"></div><div class="panel"><h2>Pendapatan, pengeluaran, keuntungan</h2><div id="chw"><div id="chart" class="chart"></div></div></div>
    <p class="hint">Pendapatan = penjualan setelah diskon (hanya transaksi selesai dan sudah tersinkron). Keuntungan = pendapatan dikurangi HPP dan pengeluaran. Pembelian bahan tidak dihitung sebagai pengeluaran karena sudah masuk HPP.</p><div id="out"></div>`;
  ps = await all('products'); let ex = []; try { ex = await listExpenses(); } catch (e) { toast('Pengeluaran belum bisa dimuat: ' + e.message, 'warning'); }
  const draw = async () => { const B = buckets(g), tx = await load(B), c = compute(B, tx, ex), t = c.totals, st = (l, v, k) => `<div class="stat ${k}"><small>${l}</small><b>${rp(v)}</b></div>`;
    $('#st').innerHTML = st('Total pendapatan', t.rev, 'rev') + st('Total pengeluaran', t.exp, 'exp') + st('Keuntungan bersih', t.profit, 'profit');
    const empty = !c.T.length && !t.exp;
    $('#chw').innerHTML = empty ? '<p class="empty">Belum ada transaksi atau pengeluaran pada periode ini.</p>' : '<div id="chart" class="chart"></div>'; chart?.dispose(); chart = null; ro?.disconnect();
    if (!empty) try { const E = await loadEcharts(); if (!$('#chart')) return; chart = E.init($('#chart'), null, { renderer: 'canvas' }); chart.setOption(chartOption(B, c)); ro = new ResizeObserver(() => chart.resize()); ro.observe($('#chart')); }
      catch (e) { $('#chw').innerHTML = '<p class="empty">Grafik tidak dapat dimuat (perlu internet saat pertama dibuka). Angka ringkasan tetap tersedia.</p>'; }
    const sold = {}, byM = {}; c.T.forEach(x => { byM[x.method] = (byM[x.method] || 0) + x.total; x.items.forEach(i => sold[i.name] = (sold[i.name] || 0) + i.qty); });
    const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 3), low = ps.filter(p => p.active && p.stock != null && p.stock <= CONFIG.lowStock), li = (a, f) => a.length ? a.map(f).join('') : '<p class="empty">Belum ada data pada periode ini.</p>';
    $('#out').innerHTML = `<div class="panel"><h2>Produk terlaris</h2>${li(top, ([n, q]) => `<p>${esc(n)}: ${q} terjual</p>`)}</div><div class="panel"><h2>Pemasukan per metode</h2>${li(Object.entries(byM), ([m, v]) => `<p>${esc(m)}: ${rp(v)}</p>`)}</div>
      <div class="panel"><h2>Stok menipis</h2>${low.length ? low.map(p => `<p class="warn">${esc(p.name)}: sisa ${p.stock} ${esc(p.unit || '')}</p>`).join('') : '<p class="empty">Semua stok aman.</p>'}</div>
      <div class="panel"><h2>Transaksi terbaru</h2>${li([...c.T].sort((a, b) => b.at - a.at).slice(0, 6), x => `<p>${esc(x.no)}: ${rp(x.total)}</p>`)}</div>`; };
  root.querySelector('#seg').onclick = e => { const b = e.target.closest('[data-g]'); if (!b || b.dataset.g === g) return; g = b.dataset.g; root.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
  await draw();
  return () => { ro?.disconnect(); chart?.dispose(); };
}