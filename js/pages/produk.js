import { all, uid } from '../services/db.js';
import { saveProduct, removeProduct, adjustStock, isProd, ctx } from '../services/sync.js';
import { compress, upload, drop, urls } from '../services/storage.js';
import { rp, toInt } from '../utils/money.js';
import { $, esc, toast, icon } from '../utils/dom.js';

export const title = 'Produk';
export async function render(root) {
  const dlg = $('#dlg');
  root.innerHTML = `<div id="list" class="list produk-list"></div><button class="produk-fab btn primary" id="add" aria-label="Tambah produk">${icon('plus')}<span>Tambah produk</span></button>`;
  let ps = [];
  const draw = async () => { ps = (await all('products')).sort((a, b) => a.name.localeCompare(b.name));
    const U = isProd() ? await urls(ps.map(p => p.image_path)) : {};
    $('#list').innerHTML = ps.length ? ps.map(p => `<div class="item" data-id="${esc(p.id)}">${U[p.image_path] ? `<img class="th" src="${esc(U[p.image_path])}" alt="" loading="lazy">` : `<div class="th ph">${icon('produk')}</div>`}
      <div class="grow"><b>${esc(p.name)}</b>${p.active ? '' : ' <em class="tag">Nonaktif</em>'}
      <small class="meta"><span>${esc(p.category || 'Tanpa kategori')}</span><span>${esc(p.sku || 'Tanpa SKU')}</span><span>Modal ${rp(p.cost)}</span><span>Jual ${rp(p.price)}</span><span>${p.stock == null ? 'Stok tidak dilacak' : 'Stok ' + p.stock + ' ' + esc(p.unit || '')}</span></small></div>
      <div class="acts v"><button class="btn sm" data-a="edit">Ubah</button><button class="btn sm danger" data-a="del">Hapus</button></div></div>`).join('')
      : '<p class="empty">Belum ada produk. Tekan Tambah produk untuk memulai.</p>'; };
  const form = async p => { const isNew = !p; p = p || { id: uid(), active: true, unit: 'pcs' }; let blob = null, rm = false;
    const U = isProd() && p.image_path ? await urls([p.image_path]) : {}, cur = U[p.image_path];
    dlg.innerHTML = `<form id="f"><h3>${isNew ? 'Tambah' : 'Ubah'} produk</h3>
      ${isProd() ? `<label>Gambar produk</label><img id="ip" class="prev sq" alt="Gambar produk" ${cur ? `src="${esc(cur)}"` : 'hidden'}><input id="if" type="file" accept="image/*" hidden>
        <div class="rc-a" style="justify-content:flex-start;margin-top:0"><button class="btn" type="button" id="ik">Pilih dari galeri</button><button class="btn danger" type="button" id="id">Hapus gambar</button></div>` : '<small>Gambar produk tersedia setelah login (disimpan di Supabase Storage).</small>'}
      <label>Nama produk<input name="name" class="input" required maxlength="80" value="${esc(p.name)}"></label>
      <div class="row2"><label>SKU / kode<input name="sku" class="input" maxlength="40" value="${esc(p.sku)}"></label><label>Kategori<input name="category" class="input" maxlength="40" value="${esc(p.category)}"></label></div>
      <div class="row2"><label>Harga modal (Rp)<input name="cost" class="input" inputmode="numeric" value="${p.cost || 0}"></label><label>Harga jual (Rp)<input name="price" class="input" inputmode="numeric" required value="${p.price ?? ''}"></label></div>
      <div class="row2"><label>Satuan<input name="unit" class="input" maxlength="20" value="${esc(p.unit)}"></label><label>Stok (kosong = tidak dilacak)<input name="stock" class="input" inputmode="numeric" value="${p.stock ?? ''}" pattern="[0-9]*" enterkeyhint="done" autocomplete="off"></label></div>
      <label class="chk"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>Aktif dijual</label>
      <div class="rc-a"><button class="btn" value="cancel" formnovalidate>Batal</button><button class="btn primary" value="ok">Simpan</button></div></form>`;
    dlg.showModal();
    if (isProd()) { $('#ik').onclick = () => $('#if').click();
      $('#if').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { blob = await compress(f, 800); rm = false; $('#ip').src = URL.createObjectURL(blob); $('#ip').hidden = false; } catch (er) { toast('Gagal memproses gambar: ' + er.message, 'error'); } e.target.value = ''; };
      $('#id').onclick = () => { blob = null; rm = true; $('#ip').hidden = true; }; }
    $('#f').onsubmit = async e => { e.preventDefault(); if (e.submitter?.value === 'cancel') return dlg.close();
      e.submitter.disabled = true; let up = null, path = p.image_path || null;
      try { if (blob) path = up = await upload(ctx.business.id, 'products', blob); else if (rm) path = null; // unggah dulu; gambar lama dihapus hanya setelah simpan berhasil
        const v = Object.fromEntries(new FormData(e.target)), ns = v.stock.trim() === '' ? null : toInt(v.stock), first = isNew || p.stock == null;
        await saveProduct({ ...p, name: v.name.trim(), sku: v.sku.trim(), category: v.category.trim(), unit: v.unit.trim() || 'pcs', cost: toInt(v.cost), price: toInt(v.price),
          stock: first ? ns : p.stock, active: 'active' in v, image_path: path }, isNew, first);
        if (!first && ns != null && ns !== p.stock) await adjustStock(p.id, 'set', ns, 'Diubah dari formulir produk');
        if (p.image_path && p.image_path !== path) await drop([p.image_path]);
        toast(isNew ? 'Produk berhasil ditambahkan' : 'Produk berhasil diperbarui', 'success'); dlg.close(); draw();
      } catch (er) { if (up) await drop([up]); toast('Gagal menyimpan produk: ' + er.message, 'error'); e.submitter.disabled = false; } }; };
  root.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'add') return form();
    const p = ps.find(x => x.id === b.closest('[data-id]')?.dataset.id); if (!p) return;
    if (b.dataset.a === 'edit') form(p);
    else if (b.dataset.a === 'del' && confirm(`Hapus "${p.name}"? Riwayat transaksi lama tidak berubah.`)) { try { await removeProduct(p); toast('Produk berhasil dihapus', 'success'); draw(); } catch (er) { toast('Gagal menghapus: ' + er.message, 'error'); } } });
  draw();
}
