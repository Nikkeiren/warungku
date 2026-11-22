import { CONFIG } from './config.js';
import { $, icon } from './utils/dom.js';
import { all } from './services/db.js';
import { seedDemo } from './data/demo.js';

const pages = { kasir: './pages/kasir.js', produk: './pages/produk.js', transaksi: './pages/transaksi.js', dashboard: './pages/dashboard.js' };
const label = { kasir: 'Kasir', produk: 'Produk', transaksi: 'Transaksi', dashboard: 'Ringkasan' };
let cleanup, seq = 0;

async function net() {
  const pend = (await all('transactions')).filter(t => !t.synced && !t.seed).length, on = navigator.onLine, el = $('#net');
  el.textContent = (on ? 'Online' : 'Offline') + (pend ? `, ${pend} transaksi tersimpan lokal` : ''); el.className = 'net ' + (on ? 'on' : 'off');
}
async function go() {
  const k = pages[location.hash.slice(1)] ? location.hash.slice(1) : 'kasir', n = ++seq;
  $('#nav').innerHTML = Object.keys(pages).map(p => `<a href="#${p}" class="${p === k ? 'on' : ''}">${icon(p)}<span>${label[p]}</span></a>`).join('');
  cleanup?.(); cleanup = null;
  const root = $('#app'); root.innerHTML = '<p class="empty">Memuat…</p>';
  try { const m = await import(pages[k]); if (n !== seq) return;
    root.innerHTML = ''; const el = document.createElement('div'); root.append(el); cleanup = await m.render(el); }
  catch (e) { console.error(e); root.innerHTML = '<p class="empty">Halaman gagal dimuat. Muat ulang aplikasi.</p>'; }
  net();
}
if (CONFIG.MODE === 'demo') $('#demo-banner').hidden = false;
addEventListener('hashchange', go); addEventListener('online', net); addEventListener('offline', net); addEventListener('wk:changed', net);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => { try { if (CONFIG.MODE === 'demo') await seedDemo(); } catch (e) { console.error(e); } go(); })();
