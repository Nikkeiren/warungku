import * as sb from '../services/supabase.js';
import { $, esc } from '../utils/dom.js';

export function renderAuth(root, { onAuthed, onDemo }) {
  let mode = 'masuk', info = '';
  const draw = () => { const masuk = mode === 'masuk';
    root.innerHTML = `<div class="auth"><h1>Warungku</h1><small>Kelola Usaha, Lebih Mudah.</small>
    ${sb.configured() ? `<form id="af"><label>Email<input name="email" type="email" class="input" required autocomplete="email"></label>
      <label>Kata sandi (minimal 8 karakter)<input name="pw" type="password" class="input" minlength="8" required autocomplete="${masuk ? 'current-password' : 'new-password'}"></label>
      <p id="msg" class="warnbox" ${info ? '' : 'hidden'}>${esc(info)}</p><button class="btn primary lg" style="margin-top:12px">${masuk ? 'Masuk' : 'Daftar akun'}</button></form>
      <button class="btn lg" id="sw" style="margin-top:8px">${masuk ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</button>`
      : '<p class="warnbox">Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di env.js (lihat README).</p>'}
    <button class="btn lg" id="demo" style="margin-top:8px">Coba mode demo (data contoh)</button></div>`;
    $('#demo').onclick = onDemo;
    if (!sb.configured()) return;
    $('#sw').onclick = () => { mode = masuk ? 'daftar' : 'masuk'; info = ''; draw(); };
    $('#af').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), b = e.submitter, msg = $('#msg'); b.disabled = true; msg.hidden = true;
      try { const em = f.get('email').trim();
        if (masuk) await sb.signIn(em, f.get('pw'));
        else { const d = await sb.signUp(em, f.get('pw')); if (!d?.access_token) { mode = 'masuk'; info = 'Pendaftaran berhasil. Buka email untuk konfirmasi, lalu masuk.'; return draw(); } }
        onAuthed();
      } catch (er) { msg.textContent = er.message; msg.hidden = false; b.disabled = false; } };
  };
  draw();
}

export function renderBusiness(root, { onDone, onOut }) {
  root.innerHTML = `<div class="auth"><h1>Belum terhubung ke usaha</h1>
    <small>Jika kamu karyawan, admin, atau kasir, minta owner menambahkan email akun ini melalui menu Pengguna. Buat usaha hanya jika kamu pemilik usaha.</small>
    <form id="bf"><label>Nama usaha<input name="n" class="input" required maxlength="80"></label>
    <p id="msg" class="warnbox" hidden></p><button class="btn primary lg" style="margin-top:12px">Buat usaha</button></form>
    <button class="btn lg" id="out" style="margin-top:8px">Keluar</button></div>`;
  $('#out').onclick = onOut;
  $('#bf').onsubmit = async e => { e.preventDefault(); const b = e.submitter, msg = $('#msg'); b.disabled = true;
    try { await sb.rpc('create_business', { p_name: new FormData(e.target).get('n') }); onDone(); }
    catch (er) { msg.textContent = er.message; msg.hidden = false; b.disabled = false; } };
}

export function renderBusinessPicker(root, memberships, { onSelect, onOut }) {
  root.innerHTML = `<div class="auth"><h1>Pilih usaha</h1>
    <small>Akun ini terdaftar di beberapa usaha. Pilih usaha yang ingin dibuka.</small>
    <div id="business-list" style="display:grid;gap:8px;margin-top:16px">
      ${memberships.map((m, i) => `<button class="btn lg" type="button" data-business-index="${i}" style="text-align:left">
        <strong>${esc(m.businesses.name || 'Usaha tanpa nama')}</strong>
        <small style="display:block;margin-top:4px">Peran: ${esc(m.role)}</small>
      </button>`).join('')}
    </div>
    <button class="btn lg" id="out" style="margin-top:12px">Keluar</button></div>`;
  root.querySelectorAll('[data-business-index]').forEach(button => {
    button.addEventListener('click', () => {
      const m = memberships[Number(button.dataset.businessIndex)];
      if (m) onSelect(m);
    });
  });
  $('#out').onclick = onOut;
}
