import * as sb from '../services/supabase.js';
import { ctx, saveCtx } from '../services/sync.js';
import { all } from '../services/db.js';
import { compress, upload, drop, urls } from '../services/storage.js';
import { FONTS, brandFont } from '../data/fonts.js';
import { bannerHtml, bindBanner } from '../utils/banner.js';
import { toInt } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Pengaturan';
export async function render(root) {
  const b = ctx.business, own = ctx.role === 'owner', adm = own || ctx.role === 'admin', em = sb.session()?.user?.email || '';
  const save = async body => { await sb.patch('businesses', 'id=eq.' + b.id, body); Object.assign(b, body); saveCtx(); dispatchEvent(new Event('wk:brand')); };
  const sec = (t, h) => `<section class="panel"><h2>${t}</h2>${h}</section>`, U = own ? await urls([b.banner_path, b.bg_path]) : {};
  const pick = (id, f) => `<img id="${id}p" class="prev" alt="Pratinjau" ${U[b[f]] ? `src="${esc(U[b[f]])}"` : 'hidden'}><input id="${id}f" type="file" accept="image/*" hidden>
    <div class="rc-a" style="justify-content:flex-start;margin-top:0"><button class="btn" type="button" id="${id}k">Pilih dari galeri</button><button class="btn primary" type="button" id="${id}s" disabled>Simpan gambar</button><button class="btn danger" type="button" id="${id}d" ${b[f] ? '' : 'disabled'}>Hapus gambar</button></div>`;
  root.innerHTML = `<div class="page-h"><h1>Pengaturan</h1></div>` + (own ? sec('Profil usaha', `<form id="pf"><label>Nama usaha<input name="name" class="input" required maxlength="80" value="${esc(b.name)}"></label>
      <label>Deskripsi<input name="description" class="input" maxlength="200" value="${esc(b.description)}"></label><label>Alamat<input name="address" class="input" maxlength="160" value="${esc(b.address)}"></label>
      <label>Nomor telepon<input name="phone" class="input" maxlength="30" inputmode="tel" value="${esc(b.phone)}"></label><small style="margin-top:8px">Pemilik: ${esc(em)}</small><button class="btn primary lg" style="margin-top:12px">Simpan profil</button></form>`)
    + sec('Tampilan', `<h3>Font nama usaha</h3><div class="fonts">${[['', ''], ...FONTS].map(([n]) => `<button type="button" data-f="${esc(n)}" class="${(b.name_font || '') === n ? 'on' : ''}" style="font-family:${n ? brandFont(n) : 'inherit'}">${esc(b.name)}<small>${n || 'Font bawaan'}</small></button>`).join('')}</div>
      <small style="margin-top:6px">Hanya mengubah tulisan nama usaha di topbar. Font dimuat dari internet.</small>
      <h3 style="margin-top:16px">Banner topbar</h3>${bannerHtml(b, U[b.banner_path])}
      <h3 style="margin-top:16px">Background aplikasi</h3><label>Jenis<select id="bm" class="input"><option value="default">Bawaan</option><option value="color">Warna solid</option><option value="image">Gambar dari galeri</option></select></label>
      <label>Warna solid<input id="bc" type="color" class="input" value="${b.bg_color || '#F5F3EC'}"></label>
      <label>Kekuatan overlay gambar: <span id="bov">${b.bg_overlay ?? 40}</span>%<input id="bo" type="range" min="0" max="90" value="${b.bg_overlay ?? 40}" style="width:100%"></label>
      <button class="btn primary" type="button" id="bsv" style="margin:10px 0">Simpan background</button>${pick('bg', 'bg_path')}
      <button class="btn danger lg" type="button" id="rst" style="margin-top:16px">Reset tampilan ke bawaan</button>`)
    + sec('Kasir', `<form id="kf"><div class="row2"><label>Pajak (%)<input name="tax" class="input" inputmode="numeric" value="${b.tax_pct}"></label><label>Biaya layanan (Rp)<input name="fee" class="input" inputmode="numeric" value="${b.service_fee}"></label></div>
      <small style="margin-top:8px">Berlaku untuk transaksi berikutnya. Kembalian dihitung otomatis di kasir.</small><button class="btn primary lg" style="margin-top:12px">Simpan pengaturan kasir</button></form>`)
    + sec('Pengguna dan akses', '<p>Kelola kasir dan admin usaha.</p><a class="btn lg" href="#pengguna">Buka daftar pengguna</a>') : '')
    + sec('Akun dan keamanan', `<p>Email: <b>${esc(em)}</b></p><form id="af"><label>Kata sandi baru (minimal 8 karakter)<input name="pw" type="password" class="input" minlength="8" required autocomplete="new-password"></label>
      <button class="btn primary lg" style="margin-top:12px">Ubah kata sandi</button></form><button class="btn lg" id="so" style="margin-top:8px">Keluar dari akun</button>`)
    + (adm ? sec('Penyimpanan dan data', '<p id="su">Menghitung penggunaan penyimpanan…</p><button class="btn lg" id="ex">Ekspor data (JSON)</button><small style="margin-top:8px">Ekspor berasal dari data di perangkat ini. Pemulihan data belum tersedia.</small>') : '');

  const form = (id, fn, ok) => { const f = $('#' + id); if (f) f.onsubmit = async e => { e.preventDefault(); e.submitter.disabled = true;
    try { await fn(Object.fromEntries(new FormData(f))); toast(ok, 'success'); } catch (er) { toast('Gagal menyimpan: ' + er.message, 'error'); } e.submitter.disabled = false; }; };
  form('pf', v => { if (!v.name.trim()) throw new Error('Nama usaha wajib diisi'); return save({ name: v.name.trim(), description: v.description.trim(), address: v.address.trim(), phone: v.phone.trim() }); }, 'Pengaturan tersimpan');
  form('kf', v => save({ tax_pct: Math.min(100, toInt(v.tax)), service_fee: toInt(v.fee) }), 'Pengaturan tersimpan');
  form('af', async v => { await sb.setPassword(v.pw); $('#af').reset(); }, 'Kata sandi berhasil diubah');
  $('#so').onclick = () => { if (confirm('Keluar dari akun? Transaksi yang belum tersinkron tetap tersimpan di perangkat ini.')) { sb.signOut(); location.hash = ''; location.reload(); } };
  if (own) {
    $('#bm').value = b.bg_mode || 'default'; $('#bo').oninput = e => $('#bov').textContent = e.target.value;
    root.querySelector('.fonts').onclick = async e => { const f = e.target.closest('[data-f]'); if (!f) return;
      try { await save({ name_font: f.dataset.f }); root.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === f)); toast('Font nama usaha diperbarui', 'success'); } catch (er) { toast('Gagal menyimpan font: ' + er.message, 'error'); } };
    const bind = (id, field, max, extra = {}) => { let blob; const $$ = s => $('#' + id + s);
      $$('k').onclick = () => $$('f').click();
      $$('f').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { blob = await compress(f, max); $$('p').src = URL.createObjectURL(blob); $$('p').hidden = false; $$('s').disabled = false; } catch (er) { toast('Gagal memproses gambar: ' + er.message, 'error'); } e.target.value = ''; };
      $$('s').onclick = async () => { $$('s').disabled = true; const old = b[field]; let path;
        try { path = await upload(b.id, 'branding', blob); } catch (er) { toast('Gagal mengunggah gambar: ' + er.message, 'error'); $$('s').disabled = false; return; }
        try { await save({ [field]: path, ...extra }); await drop([old]); $$('d').disabled = false; if (extra.bg_mode) $('#bm').value = 'image'; toast('Gambar tersimpan', 'success'); } catch (er) { await drop([path]); toast('Gagal menyimpan: ' + er.message, 'error'); $$('s').disabled = false; } };
      $$('d').onclick = async () => { if (!confirm('Hapus gambar ini?')) return; const old = b[field];
        try { await save({ [field]: null, ...(field === 'bg_path' && b.bg_mode === 'image' ? { bg_mode: 'default' } : {}) }); await drop([old]); $$('p').hidden = true; $$('d').disabled = true; if (field === 'bg_path') $('#bm').value = b.bg_mode; toast('Gambar dihapus', 'success'); } catch (er) { toast('Gagal menghapus: ' + er.message, 'error'); } }; };
    bindBanner(b, U[b.banner_path], save); bind('bg', 'bg_path', 1600, { bg_mode: 'image' });
    $('#bsv').onclick = async () => { const m = $('#bm').value; if (m === 'image' && !b.bg_path) return toast('Pilih dan simpan gambar background dulu', 'warning');
      try { await save({ bg_mode: m, bg_color: m === 'color' ? $('#bc').value : b.bg_color || null, bg_overlay: +$('#bo').value }); toast('Background tersimpan', 'success'); } catch (er) { toast('Gagal menyimpan background: ' + er.message, 'error'); } };
    $('#rst').onclick = async () => { if (!confirm('Reset font, banner, dan background ke bawaan?')) return; const old = [b.banner_path, b.bg_path];
      try { await save({ name_font: '', banner_path: null, banner_x: 50, banner_y: 50, banner_zoom: 100, bg_mode: 'default', bg_color: null, bg_path: null, bg_overlay: 40 }); await drop(old); toast('Tampilan dikembalikan ke bawaan', 'success'); render(root); } catch (er) { toast('Gagal mereset tampilan: ' + er.message, 'error'); } };
  }
  if (adm) {
    navigator.storage?.estimate?.().then(s => { const mb = n => (n / 1048576).toFixed(1) + ' MB'; $('#su').textContent = `Penyimpanan perangkat: ${mb(s.usage || 0)} terpakai dari ${mb(s.quota || 0)}.`; }, () => { $('#su').textContent = 'Penggunaan penyimpanan tidak tersedia di perangkat ini.'; });
    $('#ex').onclick = async () => { const d = { diekspor: new Date().toISOString(), usaha: { id: b.id, nama: b.name }, produk: await all('products'), transaksi: (await all('transactions')).filter(t => !t.seed) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })); a.download = `warungku-data-${b.name.replace(/\W+/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Data berhasil diekspor', 'success'); };
  }
}
