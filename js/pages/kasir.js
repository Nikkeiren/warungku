import { all, saveSale, uid } from '../services/db.js';
import { CONFIG } from '../config.js';
import { isProd, settings, bizName, ctx } from '../services/sync.js';
import { urls } from '../services/storage.js';
import { applyGlow } from '../utils/glow.js';
import { rp, toInt, calc } from '../utils/money.js';
import { $, esc, toast, icon, share } from '../utils/dom.js';

export const receiptText = t => [bizName() + (t.demo ? ' (DEMO)' : ''), t.no, new Date(t.at).toLocaleString('id-ID'),
  t.status !== 'selesai' ? 'STATUS: ' + t.status.toUpperCase() : null, '',
  ...t.items.map(i => `${i.name}\n  ${i.qty} x ${rp(i.price)} = ${rp(i.qty * i.price)}`), '',
  `Subtotal  ${rp(t.subtotal)}`, t.discount ? `Diskon    -${rp(t.discount)}` : null, t.tax ? `Pajak     ${rp(t.tax)}` : null, t.fee ? `Layanan   ${rp(t.fee)}` : null,
  `TOTAL     ${rp(t.total)}`, `${t.method}  ${rp(t.paid)}`, `Kembali   ${rp(t.change)}`, t.note ? 'Catatan: ' + t.note : null].filter(x => x !== null).join('\n');

const KEYS = [['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷'], ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×'], ['1', '1'], ['2', '2'], ['3', '3'], ['−', '-'], ['0', '0'], ['000', '000'], ['+', '+'], ['=', '=']];
const OPS = /[+\-×÷]/;

export const title = 'Kasir';
export async function render(root) {
  const dlg = $('#dlg');
  let U = {}, prods = [], cart = new Map(), disc = 0, method = CONFIG.payMethods[0], expr = '', cat = 'Semua', q = '', saving = false, draft = uid();
  const load = async () => { prods = (await all('products')).filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name)); U = isProd() ? await urls(prods.map(p => p.image_path)) : {}; };
  await load();
  root.innerHTML = `<section class="pos"><div class="catalog">
  
  <div class="chips" id="cats"></div><div class="grid" id="grid"></div></div>
  <aside class="cart" id="cart"><div class="cart-h"><h2>Keranjang</h2><button class="btn sm" data-a="close">Tutup</button></div>
  <div id="lines"></div>
  <label>Catatan pesanan<input id="note" class="input" maxlength="120"></label>
  <div id="sum" class="sum"></div><div class="chips" id="meth"></div>
  <div class="calc"><div class="cd"><small id="cx"></small><output id="cv">Rp0</output></div>
  <div class="quick">${CONFIG.quickCash.map(n => `<button class="btn" data-q="${n}">${rp(n)}</button>`).join('')}<button class="btn" data-q="pas">Uang pas</button></div>
  <div class="keys">${KEYS.map(([l, k]) => `<button class="btn ${OPS.test(k) || k === '=' ? 'op' : ''}" data-k="${k}">${l}</button>`).join('')}
  <button class="btn" data-k="C">C</button><button class="btn" data-k="B" aria-label="Hapus satu karakter">⌫</button></div>
  <div id="chg" class="chg"></div></div>
  <button class="btn primary lg" id="pay">Bayar</button></aside></section>
  <div class="fab" id="fab"><button class="fk" id="fk" type="button" aria-label="Cari produk">${icon('cari')}</button><input id="q" type="search" placeholder="Cari nama atau SKU produk" aria-label="Cari produk" autocomplete="off" tabindex="-1"><button class="fx" id="fx" type="button" aria-label="Tutup pencarian" tabindex="-1">${icon('x')}</button></div>
  <button class="cartbar" id="cartbar"></button>`;

  const totals = () => { const sub = [...cart.values()].reduce((a, l) => a + l.p.price * l.qty, 0), d = Math.min(disc, sub), base = sub - d;
    const S = settings(), tax = Math.round(base * S.taxPct / 100), fee = cart.size ? S.fee : 0; return { sub, d, tax, fee, total: base + tax + fee }; };
  const drawGrid = () => { const f = prods.filter(p => (cat === 'Semua' || p.category === cat) && (!q || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(q)));
    $('#grid').innerHTML = f.length ? f.map(p => { const n = cart.get(p.id)?.qty || 0, img = U[p.image_path];
      return `<div class="pcard${n ? ' has' : ''}" data-id="${esc(p.id)}">${img ? `<img src="${esc(img)}" crossorigin="anonymous" alt="" loading="lazy">` : `<div class="ph" aria-hidden="true">${icon('produk')}</div>`}<b>${esc(p.name)}</b>${p.stock != null ? `<small class="${p.stock <= CONFIG.lowStock ? 'warn' : ''}">Stok ${p.stock}</small>` : ''}
        <div class="prow"><span>${rp(p.price)} / ${esc(p.unit || 'pcs')}</span><div class="pill"><button data-a="dec" aria-label="Kurangi ${esc(p.name)}"${n ? '' : ' disabled'}>−</button><input data-a="qty" inputmode="numeric" value="${n}" aria-label="Jumlah ${esc(p.name)}"><button data-a="inc" aria-label="Tambah ${esc(p.name)}">+</button></div></div></div>`; }).join('')
      : `<p class="empty">${q ? 'Produk tidak ditemukan.' : 'Belum ada produk aktif. Tambahkan di menu Produk.'}</p>`;
    $('#grid').querySelectorAll('img').forEach(i => { // jika server tak mengizinkan CORS, gambar tetap tampil (tanpa cahaya)
      i.addEventListener('error', () => { if (i.hasAttribute('crossorigin')) { i.removeAttribute('crossorigin'); i.src = i.src; } }, { once: true });
      i.complete && i.naturalWidth ? applyGlow(i) : i.addEventListener('load', () => applyGlow(i), { once: true }); }); };
  const drawChips = () => { $('#cats').innerHTML = ['Semua', ...new Set(prods.map(p => p.category).filter(Boolean))].map(c => `<button data-cat="${esc(c)}" class="${c === cat ? 'on' : ''}">${esc(c)}</button>`).join('');
    $('#meth').innerHTML = CONFIG.payMethods.map(m => `<button data-m="${m}" class="${m === method ? 'on' : ''}">${m}</button>`).join(''); };
  const refresh = () => {
    const t = totals(), n = [...cart.values()].reduce((a, l) => a + l.qty, 0), recv = calc(expr), cash = method === 'Tunai'; ctx.cart = n;
    $('#lines').innerHTML = cart.size ? [...cart.values()].map(l => `<div class="line" data-id="${esc(l.p.id)}"><div><b>${esc(l.p.name)}</b><small>${rp(l.p.price)}</small></div>
      <div class="qty"><button data-a="dec" aria-label="Kurangi">−</button><input data-a="qty" inputmode="numeric" value="${l.qty}" aria-label="Jumlah"><button data-a="inc" aria-label="Tambah">+</button></div>
      <button class="x" data-a="rm" aria-label="Hapus">${icon('x')}</button><b class="sub">${rp(l.p.price * l.qty)}</b></div>`).join('') : '<p class="empty">Keranjang kosong. Pilih produk untuk memulai.</p>';
    const row = (l, v, c = '') => `<div class="${c}"><span>${l}</span><span>${v}</span></div>`;
    $('#sum').innerHTML = row('Subtotal', rp(t.sub)) + (t.d ? row('Diskon', '-' + rp(t.d)) : '') + (t.tax ? row('Pajak ' + settings().taxPct + '%', rp(t.tax)) : '') + (t.fee ? row('Biaya layanan', rp(t.fee)) : '') + row('Total', rp(t.total), 'tot');
    $('#cx').textContent = expr ? expr.replace(/\d+/g, m => (+m).toLocaleString('id-ID')) : 'Ketik nominal uang diterima';
    $('#cv').textContent = rp(recv);
    const chg = $('#chg'); chg.className = 'chg'; chg.textContent = '';
    if (cash && t.total && recv) { const df = recv - t.total; chg.textContent = df >= 0 ? 'Kembalian ' + rp(df) : 'Kurang ' + rp(-df); chg.classList.add(df >= 0 ? 'ok' : 'low'); }
    $('#pay').disabled = saving || !cart.size || (cash && recv < t.total);
    $('#pay').textContent = cart.size ? 'Bayar ' + rp(t.total) : 'Bayar';
    $('#cartbar').innerHTML = `${icon('kasir')}<span>${n} item</span><b>${rp(t.total)}</b>`; syncCards();
  };
  const setQty = (id, n) => { const p = prods.find(x => x.id === id); if (!p) return;
    if (p.stock != null && n > p.stock) { toast('Stok tidak cukup'); n = p.stock; }
    n > 0 ? cart.set(id, { p, qty: n }) : cart.delete(id); };
  const add = (id, d) => setQty(id, (cart.get(id)?.qty || 0) + d);
  const press = k => {
    if (k === 'C') expr = ''; else if (k === 'B') expr = expr.slice(0, -1);
    else if (k === '=') expr = expr ? String(calc(expr)) : '';
    else if (OPS.test(k)) { if (expr) expr = OPS.test(expr.slice(-1)) ? expr.slice(0, -1) + k : expr + k; }
    else if (k !== '000' || /\d$/.test(expr)) expr += k;
  };
  const quick = k => { const v = k === 'pas' ? String(totals().total) : k; expr = k === 'pas' || !expr ? v : OPS.test(expr.slice(-1)) ? expr + v : expr + '+' + v; };

  // Keranjang layar penuh (HP) ikut riwayat: Back menutupnya lebih dulu.
  const pop = () => $('#cart').classList.remove('open'); addEventListener('popstate', pop);
  const closeCart = async () => { $('#cart').classList.remove('open'); if (history.state?.cart) await new Promise(r => { addEventListener('popstate', r, { once: true }); history.back(); }); };
  // Pencarian mengambang: tombol kaca pembesar -> kolom input; keluar membersihkan kata kunci.
  const vv = window.visualViewport, updKb = () => $('#fab').style.setProperty('--kb', vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px' : '0px'); vv?.addEventListener('resize', updKb);
  const openSearch = () => { $('#fab').classList.add('open'); $('#q').tabIndex = $('#fx').tabIndex = 0; $('#q').focus(); updKb(); };
  const closeSearch = () => { $('#fab').classList.remove('open'); $('#q').value = ''; $('#q').blur(); $('#q').tabIndex = $('#fx').tabIndex = -1; if (q) { q = ''; drawGrid(); } };
  $('#q').addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
  let bt; $('#q').addEventListener('blur', () => { clearTimeout(bt); bt = setTimeout(() => { const i = $('#q'); if (i && !i.value && $('#fab').classList.contains('open')) closeSearch(); }, 150); }); // aman bila halaman sudah berganti
  const syncCards = () => root.querySelectorAll('#grid .pcard').forEach(c => { const n = cart.get(c.dataset.id)?.qty || 0; c.querySelector('input').value = n; c.classList.toggle('has', n > 0); c.querySelector('[data-a=dec]').disabled = !n; });
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.closest('[data-id]')?.dataset.id, a = b.dataset.a, D = b.dataset;
    if (b.classList.contains('pcard')) add(id, 1);
    else if (a === 'inc') add(id, 1); else if (a === 'dec') add(id, -1); else if (a === 'rm') cart.delete(id);
    else if (a === 'close') closeCart();
    else if (b.id === 'cartbar') { history.pushState({ cart: 1 }, ''); $('#cart').classList.add('open'); }
    else if (b.id === 'fk') openSearch(); else if (b.id === 'fx') closeSearch();
    else if (D.k) press(D.k); else if (D.q) quick(D.q);
    else if (D.cat) { cat = D.cat; drawChips(); drawGrid(); } else if (D.m) { method = D.m; drawChips(); }
    refresh();
  });
  root.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value.toLowerCase().trim(); drawGrid(); } });
  root.addEventListener('change', e => { const t = e.target;
    if (t.dataset.a === 'qty') setQty(t.closest('[data-id]').dataset.id, toInt(t.value)); else if (t.id === 'disc') disc = toInt(t.value);
    refresh(); });
  const sp = { '*': '×', x: '×', '/': '÷', Backspace: 'B', Enter: '=', Escape: 'C' };
  const key = e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || dlg.open) return;
    const k = sp[e.key] ?? (/^[0-9+\-=]$/.test(e.key) ? e.key : null); if (k) { e.preventDefault(); press(k); refresh(); } };
  document.addEventListener('keydown', key);

  $('#pay').onclick = async () => {
    if (saving || !cart.size) return;
    const t = totals(), cash = method === 'Tunai', recv = cash ? calc(expr) : t.total;
    if (recv < t.total) return toast('Uang diterima kurang');
    saving = true; refresh();
    const d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const trx = { id: draft, no: `WRG-${ymd}-${draft.slice(0, 6).toUpperCase()}`, at: Date.now(),
      items: [...cart.values()].map(l => ({ productId: l.p.id, name: l.p.name, price: l.p.price, cost: l.p.cost, qty: l.qty, unit: l.p.unit })),
      subtotal: t.sub, discount: t.d, tax: t.tax, fee: t.fee, total: t.total, method, paid: recv, change: recv - t.total,
      note: $('#note').value.trim(), status: 'selesai', demo: !isProd(), synced: false, sync: isProd() ? 'menunggu' : 'lokal' };
    try {
      await saveSale(trx);
      cart.clear(); disc = 0; expr = ''; draft = uid(); $('#note').value = '';
      await load(); drawChips(); drawGrid(); await closeCart(); dispatchEvent(new Event('wk:changed')); dispatchEvent(new Event('wk:sale'));
      dlg.innerHTML = `<h3>Pembayaran berhasil</h3><pre class="rc">${esc(receiptText(trx))}</pre><small>${isProd() ? 'Tersimpan di perangkat, menunggu sinkronisasi ke server.' : 'Mode demo: tidak dikirim ke server.'}</small>
        <div class="rc-a"><button class="btn" id="rp">Cetak</button><button class="btn" id="rs">Bagikan</button><button class="btn primary" id="rx">Transaksi baru</button></div>`;
      dlg.showModal(); toast('Pembayaran berhasil. Transaksi disimpan.', 'success'); $('#rp').onclick = () => print(); $('#rs').onclick = () => share(receiptText(trx), trx.no); $('#rx').onclick = () => dlg.close();
    } catch (err) { console.error(err); toast('Gagal menyimpan transaksi. Coba lagi.'); }
    saving = false; refresh();
  };
  drawChips(); drawGrid(); refresh();
  return () => { document.removeEventListener('keydown', key); removeEventListener('popstate', pop); vv?.removeEventListener('resize', updKb); clearTimeout(bt); ctx.cart = 0; };
}