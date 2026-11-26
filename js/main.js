import { $, icon, toast } from './utils/dom.js';
import { all, setDb } from './services/db.js';
import { seedDemo } from './data/demo.js';
import * as sb from './services/supabase.js';
import { urls } from './services/storage.js';
import { brandFont } from './data/fonts.js';
import { bannerCss } from './utils/banner.js';
import { PAGES, TABS, can } from './data/menu.js';
import { ctx, isProd, syncNow, saveCtx } from './services/sync.js';
import { renderAuth, renderBusiness } from './pages/auth.js';

const dlg = $('#dlg'), sm = dlg.showModal.bind(dlg);
let cleanup, seq = 0, started = false, exiting = false, viaPop = false, lastBad = 0, lastOk = 0;
// Dialog ikut riwayat: tombol Back menutup dialog dulu, bukan pindah halaman.
dlg.showModal = () => { if (!dlg.open) history.pushState({ dlg: 1 }, ''); sm(); };
dlg.addEventListener('close', () => { if (!viaPop && history.state?.dlg) history.back(); viaPop = false; });

async function brand() {
  const b = isProd() ? ctx.business : null, top = $('#top'), el = $('#brand'), R = document.documentElement.style;
  el.textContent = b?.name || 'Warungku'; el.style.fontFamily = b?.name_font ? brandFont(b.name_font) : '';
  const bn = b?.banner_path, bg = b?.bg_mode === 'image' ? b.bg_path : null, U = await urls([bn, bg]);
  top.classList.toggle('has-banner', !!U[bn]); top.style.backgroundImage = ''; let im = top.querySelector('.bn');
  if (U[bn]) { if (!im) { im = new Image(); im.className = 'bn'; im.alt = ''; im.draggable = false; top.prepend(im); } if (im.getAttribute('src') !== U[bn]) im.src = U[bn]; Object.assign(im.style, bannerCss(b)); } else im?.remove();
  R.removeProperty('--bg'); R.removeProperty('--bgl');
  if (b?.bg_mode === 'color' && b.bg_color) R.setProperty('--bg', b.bg_color);
  if (U[bg]) { const a = (b.bg_overlay ?? 40) / 100; R.setProperty('--bgl', `linear-gradient(rgba(245,243,236,${a}),rgba(245,243,236,${a})),url("${U[bg]}")`); }
}
async function go() {
  const h = location.hash.slice(1), k = Object.hasOwn(PAGES, h) && can(h, ctx.role, isProd()) ? h : 'kasir', tab = TABS.includes(k) ? k : 'lainnya', n = ++seq;
  $('#nav').innerHTML = TABS.filter(t => can(t, ctx.role, isProd())).map(t => `<a href="#${t}" class="${t === tab ? 'on' : ''}"${t === tab ? ' aria-current="page"' : ''}>${icon(t)}<span>${PAGES[t][0]}</span></a>`).join('') + '<button class="sbc" id="sbc" type="button">Sembunyikan menu</button>';
  cleanup?.(); cleanup = null;
  const root = $('#app'); root.innerHTML = '<p class="empty">Memuat…</p>';
  try { const m = await import(`./pages/${k}.js`); if (n !== seq) return;
    root.innerHTML = ''; const el = document.createElement('div'); root.append(el); cleanup = await m.render(el); }
  catch (e) { console.error(e); root.innerHTML = '<p class="empty">Halaman gagal dimuat. Muat ulang aplikasi.</p>'; }
}
function confirmExit() {
  dlg.innerHTML = `<h3>Yakin ingin keluar dari Warungku?</h3>${ctx.cart ? `<p>Keranjang berisi ${ctx.cart} item yang belum dibayar akan hilang.</p>` : ''}<div class="rc-a"><button class="btn" id="st">Tetap di aplikasi</button><button class="btn primary" id="ex">Keluar</button></div>`;
  sm(); $('#st').onclick = () => { history.pushState({ app: 1 }, ''); dlg.close(); };
  $('#ex').onclick = () => { exiting = true; history.back(); };
}
function start() {
  if (!started) { started = true;
    history.replaceState({ root: 1 }, ''); history.pushState({ app: 1 }, ''); // dasar riwayat: Back di halaman utama memunculkan dialog keluar
    addEventListener('popstate', () => { if (exiting) return; if (dlg.open) { viaPop = true; dlg.close(); return; } if (history.state?.root) confirmExit(); });
    addEventListener('hashchange', go); addEventListener('wk:brand', brand);
    addEventListener('online', () => { toast('Koneksi internet kembali', 'info'); syncNow(); });
    addEventListener('offline', () => toast('Koneksi internet terputus. Transaksi tetap disimpan di perangkat.', 'warning'));
    addEventListener('wk:sale', () => syncNow()); setInterval(() => navigator.onLine && syncNow(), 30000);
    addEventListener('wk:synced', () => { if (Date.now() - lastOk > 4000) { lastOk = Date.now(); toast('Data berhasil disinkronkan', 'success'); } });
    addEventListener('wk:changed', async () => { const bad = (await all('transactions')).filter(t => t.sync === 'gagal').length;
      if (bad > lastBad) toast('Ada transaksi yang gagal disinkronkan. Buka menu Transaksi untuk kirim ulang.', 'warning'); lastBad = bad; });
    document.addEventListener('gesturestart', e => e.preventDefault()); } // cegah pinch-zoom di iOS
  go();
}
function showAuth() { $('#nav').innerHTML = ''; brand(); renderAuth($('#app'), { onAuthed: () => enterProd().catch(e => toast('Gagal masuk: ' + e.message, 'error')), onDemo: enterDemo }); }
async function enterDemo() {
  Object.assign(ctx, { mode: 'demo', business: null, role: 'owner' }); setDb('warungku-demo'); $('#demo-banner').hidden = false; brand();
  try { await seedDemo(); } catch (e) { console.error(e); } start();
}
async function enterProd() {
  let m; try { const rows = await sb.select('memberships', `select=role,businesses(*)&user_id=eq.${sb.session().user.id}`);
    if (!rows.length) return renderBusiness($('#app'), { onDone: enterProd, onOut: () => { sb.signOut(); location.reload(); } });
    m = rows.find(r => r.businesses.id === localStorage.getItem('warungku.active')) || rows[0]; }
  catch (e) { const c = e.offline && JSON.parse(localStorage.getItem('warungku.ctx') || 'null'); if (!c) throw e; m = { role: c.role, businesses: c.business }; }
  Object.assign(ctx, { mode: 'prod', business: m.businesses, role: m.role }); localStorage.setItem('warungku.active', m.businesses.id); saveCtx();
  setDb('warungku-' + ctx.business.id); $('#demo-banner').hidden = true; brand(); await syncNow(); start();
}
// Sidebar landscape (html.ls = landscape dan tinggi <= 600px): geser ke kiri untuk menutup, geser ke kanan dari sisi kiri untuk membuka.
// Hanya membaca touchstart/touchend (pasif), sehingga tidak pernah menahan scroll. Chips, tabel, slider, dialog, dan keranjang dikecualikan.
(function sidebar() {
  const H = document.documentElement, mq = matchMedia('(orientation: landscape) and (max-height: 600px)'), W = 176;
  const apply = () => H.classList.toggle('ls', mq.matches); apply(); mq.addEventListener('change', apply);
  if (localStorage.getItem('warungku.sb') === '0') H.classList.add('sb-closed');
  const set = open => { H.classList.toggle('sb-closed', !open); localStorage.setItem('warungku.sb', open ? '1' : '0'); };
  document.body.insertAdjacentHTML('beforeend', '<button class="sbh" id="sbh" type="button" aria-label="Buka menu"></button>');
  document.addEventListener('click', e => { if (e.target.closest('#sbc')) set(false); else if (e.target.closest('#sbh')) set(true); });
  let s = null;
  addEventListener('touchstart', e => { const t = e.touches[0]; s = H.classList.contains('ls') && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, el: e.target } : null; }, { passive: true });
  addEventListener('touchend', e => { if (!s) return; const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y, closed = H.classList.contains('sb-closed'), st = s; s = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || st.el.closest?.('.chips,.quick,.tw,input[type=range],dialog,.cart.open')) return;
    if (!closed && dx < 0 && st.x < W + 60) set(false); else if (closed && dx > 0 && st.x < 140) set(true); }, { passive: true });
})();
// Rasa aplikasi: tanpa menu salin/konteks dan seleksi teks pada UI (input dan textarea tetap normal).
const editable = t => !!t?.closest?.('input,textarea,select,[contenteditable="true"]');
document.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (!editable(e.target?.nodeType === 3 ? e.target.parentElement : e.target)) e.preventDefault(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => { if (sb.configured() && sb.session()) { try { return await enterProd(); } catch (e) { console.error(e); } } showAuth(); })();