import { compress, upload, drop } from '../services/storage.js';
import { brandFont } from '../data/fonts.js';
import { $, esc, toast } from './dom.js';
// Gaya gambar banner: dipakai topbar DAN pratinjau agar hasilnya identik. object-fit: cover menjaga proporsi asli (tidak gepeng);
// zoom lewat scale() pada gambar saja, berporos di titik fokus yang sama dengan object-position.
export const bannerCss = b => { const x = b?.banner_x ?? 50, y = b?.banner_y ?? 50, z = (b?.banner_zoom ?? 100) / 100;
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: z > 1 ? `scale(${z})` : 'none' }; };
const clamp = v => Math.max(0, Math.min(100, v));
export const bannerHtml = (b, url) => `<div class="bnf" id="bnf"><img id="bni" class="bn" alt="Pratinjau banner" draggable="false" ${url ? `src="${esc(url)}"` : 'hidden'}><span class="brand" id="bnb" style="font-family:${b.name_font ? brandFont(b.name_font) : 'inherit'}">${esc(b.name)}</span></div>
  <p class="hint">Geser gambar di kotak untuk memilih bagian yang tampil. Pratinjau memakai gaya yang sama dengan topbar.</p>
  <label>Zoom: <span id="bzv">100</span>%<input id="bz" type="range" min="100" max="300" value="100" style="width:100%"></label>
  <div class="pos5">${[['t', 'Atas'], ['m', 'Tengah'], ['b', 'Bawah'], ['l', 'Kiri'], ['r', 'Kanan']].map(([k, l]) => `<button class="btn sm" type="button" data-pos="${k}">${l}</button>`).join('')}</div>
  <div class="rc-a" style="justify-content:flex-start"><button class="btn" type="button" id="bnk">Pilih dari galeri</button><input id="bnfi" type="file" accept="image/*" hidden><button class="btn" type="button" id="bnr">Reset posisi</button>
  <button class="btn primary" type="button" id="bns" ${url ? '' : 'disabled'}>Simpan banner</button><button class="btn danger" type="button" id="bnd" ${url ? '' : 'disabled'}>Hapus gambar</button></div>`;
export function bindBanner(b, url, save) {
  const st = { x: b.banner_x ?? 50, y: b.banner_y ?? 50, z: b.banner_zoom ?? 100 }, fr = $('#bnf'), im = $('#bni'); let blob = null, drag = null;
  const paint = () => { Object.assign(im.style, bannerCss({ banner_x: st.x, banner_y: st.y, banner_zoom: st.z })); $('#bzv').textContent = Math.round(st.z); $('#bz').value = st.z; }; paint();
  fr.onpointerdown = e => { if (im.hidden) return; fr.setPointerCapture(e.pointerId); drag = { px: e.clientX, py: e.clientY, x: st.x, y: st.y }; };
  fr.onpointermove = e => { if (!drag) return; const fw = fr.clientWidth, fh = fr.clientHeight, s0 = Math.max(fw / im.naturalWidth, fh / im.naturalHeight),
      Zw = im.naturalWidth * s0 * st.z / 100, Zh = im.naturalHeight * s0 * st.z / 100; // ukuran gambar tampil; posisi% memetakan linear ke geser piksel
    if (Zw - fw > 1) st.x = clamp(drag.x - 100 * (e.clientX - drag.px) / (Zw - fw)); if (Zh - fh > 1) st.y = clamp(drag.y - 100 * (e.clientY - drag.py) / (Zh - fh)); paint(); };
  fr.onpointerup = fr.onpointercancel = () => { drag = null; };
  $('#bz').oninput = e => { st.z = +e.target.value; paint(); };
  document.querySelectorAll('[data-pos]').forEach(btn => btn.onclick = () => { const k = btn.dataset.pos; if (k === 't') st.y = 0; else if (k === 'b') st.y = 100; else if (k === 'l') st.x = 0; else if (k === 'r') st.x = 100; else { st.x = 50; st.y = 50; } paint(); });
  $('#bnr').onclick = () => { st.x = 50; st.y = 50; st.z = 100; paint(); };
  $('#bnk').onclick = () => $('#bnfi').click();
  $('#bnfi').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { blob = await compress(f, 1600); im.src = URL.createObjectURL(blob); im.hidden = false; $('#bns').disabled = false; } catch (er) { toast('Gagal memproses gambar: ' + er.message, 'error'); } e.target.value = ''; };
  $('#bns').onclick = async () => { const btn = $('#bns'), old = b.banner_path; let path = old, up = null; btn.disabled = true; // gambar lama dihapus hanya setelah simpan berhasil
    try { if (blob) path = up = await upload(b.id, 'branding', blob);
      await save({ banner_path: path, banner_x: Math.round(st.x), banner_y: Math.round(st.y), banner_zoom: Math.round(st.z) });
      if (up && old) await drop([old]); blob = null; $('#bnd').disabled = false; toast('Banner tersimpan', 'success');
    } catch (er) { if (up) await drop([up]); toast('Gagal menyimpan banner: ' + er.message, 'error'); } btn.disabled = false; };
  $('#bnd').onclick = async () => { if (!confirm('Hapus gambar banner?')) return; const old = b.banner_path;
    try { await save({ banner_path: null, banner_x: 50, banner_y: 50, banner_zoom: 100 }); await drop([old]); blob = null; im.hidden = true; im.removeAttribute('src'); st.x = 50; st.y = 50; st.z = 100; paint(); $('#bns').disabled = $('#bnd').disabled = true; toast('Banner dihapus', 'success'); }
    catch (er) { toast('Gagal menghapus banner: ' + er.message, 'error'); } };
}
