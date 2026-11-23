import * as sb from '../services/supabase.js';
import { ctx, saveCtx } from '../services/sync.js';
import { toInt } from '../utils/money.js';
import { $, esc, toast } from '../utils/dom.js';

export const title = 'Pengaturan';
export async function render(root) {
  const b = ctx.business;
  root.innerHTML = `<div class="page-h"><h1>Pengaturan usaha</h1></div><form id="sf"><label>Nama usaha<input name="name" class="input" required maxlength="80" value="${esc(b.name)}"></label>
    <label>Alamat<input name="address" class="input" maxlength="160" value="${esc(b.address)}"></label><label>Nomor telepon<input name="phone" class="input" maxlength="30" inputmode="tel" value="${esc(b.phone)}"></label>
    <div class="row2"><label>Pajak (%)<input name="tax" class="input" inputmode="numeric" value="${b.tax_pct}"></label><label>Biaya layanan (Rp)<input name="fee" class="input" inputmode="numeric" value="${b.service_fee}"></label></div>
    <small style="margin-top:8px">Pajak dan biaya layanan berlaku untuk transaksi berikutnya di kasir.</small><button class="btn primary lg" style="margin-top:16px">Simpan pengaturan</button></form>`;
  $('#sf').onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)), e2 = e.submitter; e2.disabled = true;
    const body = { name: v.name.trim(), address: v.address.trim(), phone: v.phone.trim(), tax_pct: Math.min(100, toInt(v.tax)), service_fee: toInt(v.fee) };
    try { await sb.patch('businesses', 'id=eq.' + b.id, body); Object.assign(b, body); saveCtx(); toast('Pengaturan tersimpan'); } catch (er) { toast('Gagal menyimpan: ' + er.message); } e2.disabled = false; };
}
