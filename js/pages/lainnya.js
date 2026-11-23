import { PAGES, can } from '../data/menu.js';
import { ctx, isProd } from '../services/sync.js';
import * as sb from '../services/supabase.js';
import { icon } from '../utils/dom.js';

export const title = 'Lainnya';
export async function render(root) {
  const items = ['dashboard', 'laporan', 'pengeluaran', 'pengguna', 'pengaturan'].filter(k => can(k, ctx.role, isProd()));
  root.innerHTML = `<div class="page-h"><h1>Lainnya</h1></div><div class="menu">${items.map(k => `<a href="#${k}">${icon(k)}<span>${PAGES[k][0]}</span></a>`).join('')}</div>
    <button class="btn lg" id="out" style="margin-top:8px">${isProd() ? 'Keluar dari akun' : 'Keluar dari mode demo'}</button>`;
  root.querySelector('#out').onclick = () => { if (!confirm(isProd() ? 'Keluar dari akun? Transaksi yang belum tersinkron tetap tersimpan di perangkat ini.' : 'Keluar dari mode demo?')) return;
    sb.signOut(); location.hash = ''; location.reload(); };
}
