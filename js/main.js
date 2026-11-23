import { CONFIG } from './config.js';
import { $, icon, toast } from './utils/dom.js';
import { all, setDb } from './services/db.js';
import { seedDemo } from './data/demo.js';
import * as sb from './services/supabase.js';
import { ctx, isProd, syncNow, saveCtx } from './services/sync.js';
import { renderAuth, renderBusiness } from './pages/auth.js';

// [label, role yang boleh, hanya mode produksi]. Akses sebenarnya tetap dipaksa oleh RLS di server.
const PAGES = { kasir: ['Kasir', 'owner admin kasir'], transaksi: ['Transaksi', 'owner admin kasir'], produk: ['Produk', 'owner admin'], inventaris: ['Inventaris', 'owner admin'],
  dashboard: ['Ringkasan', 'owner admin'], laporan: ['Laporan', 'owner admin'], pengeluaran: ['Pengeluaran', 'owner admin'], pengguna: ['Pengguna', 'owner', 1], pengaturan: ['Pengaturan', 'owner', 1] };
const allowed = () => Object.keys(PAGES).filter(k => PAGES[k][1].includes(ctx.role) && (!PAGES[k][2] || isProd()));
let cleanup, seq = 0, started = false;

async function net() {
  const ts = (await all('transactions')).filter(t => !t.seed), on = navigator.onLine, el = $('#net');
  const wait = ts.filter(t => t.sync === 'menunggu').length, bad = ts.filter(t => t.sync === 'gagal').length;
  el.textContent = (on ? 'Online' : 'Offline') + (isProd() ? (wait ? ', ' + wait + ' menunggu sinkronisasi' : '') + (bad ? ', ' + bad + ' gagal' : '') : ', mode demo');
  el.className = 'net ' + (on && !bad ? 'on' : 'off');
}
async function go() {
  const ok = allowed(), h = location.hash.slice(1), k = ok.includes(h) ? h : 'kasir', n = ++seq;
  $('#nav').innerHTML = ok.map(p => `<a href="#${p}" class="${p === k ? 'on' : ''}">${icon(p)}<span>${PAGES[p][0]}</span></a>`).join('');
  cleanup?.(); cleanup = null;
  const root = $('#app'); root.innerHTML = '<p class="empty">Memuat…</p>';
  try { const m = await import(`./pages/${k}.js`); if (n !== seq) return;
    root.innerHTML = ''; const el = document.createElement('div'); root.append(el); cleanup = await m.render(el); }
  catch (e) { console.error(e); root.innerHTML = '<p class="empty">Halaman gagal dimuat. Muat ulang aplikasi.</p>'; }
  net();
}
function start() {
  if (!$('#out')) $('.top-actions').insertAdjacentHTML('beforeend', '<button class="btn sm" id="out">Keluar</button>');
  $('#out').onclick = () => { sb.signOut(); location.hash = ''; location.reload(); };
  if (!started) { started = true;
    addEventListener('hashchange', go); addEventListener('online', () => { net(); syncNow(); }); addEventListener('offline', net); addEventListener('wk:changed', net);
    addEventListener('wk:sale', () => syncNow()); setInterval(() => navigator.onLine && syncNow(), 30000); }
  go();
}
function showAuth() { $('#nav').innerHTML = ''; $('#out')?.remove(); $('#net').textContent = ''; renderAuth($('#app'), { onAuthed: () => enterProd().catch(e => toast(e.message)), onDemo: enterDemo }); }
async function enterDemo() {
  Object.assign(ctx, { mode: 'demo', business: null, role: 'owner' }); setDb('warungku-demo'); $('#demo-banner').hidden = false;
  try { await seedDemo(); } catch (e) { console.error(e); } start();
}
async function enterProd() {
  let m; try { m = (await sb.select('memberships', `select=role,businesses(*)&user_id=eq.${sb.session().user.id}`))[0]; if (!m) return renderBusiness($('#app'), { onDone: enterProd, onOut: () => { sb.signOut(); location.reload(); } }); }
  catch (e) { const c = e.offline && JSON.parse(localStorage.getItem('warungku.ctx') || 'null'); if (!c) throw e; m = { role: c.role, businesses: c.business }; }
  Object.assign(ctx, { mode: 'prod', business: m.businesses, role: m.role }); saveCtx(); setDb('warungku-' + ctx.business.id); $('#demo-banner').hidden = true;
  await syncNow(); start();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => { if (sb.configured() && sb.session()) { try { return await enterProd(); } catch (e) { console.error(e); } } showAuth(); })();
