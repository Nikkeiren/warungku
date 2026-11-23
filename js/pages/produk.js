import { all, uid } from '../services/db.js';
import { saveProduct, removeProduct, isProd } from '../services/sync.js';
import { rp, toInt } from '../utils/money.js';
import { $, esc, toast, icon } from '../utils/dom.js';

export const title = 'Produk';
export async function render(root) {
  const dlg = $('#dlg');
  root.innerHTML = `<div class="page-h"><h1>Produk</h1><button class="btn primary" id="add">${icon('plus')}Tambah produk</button></div><div id="list" class="list"></div>`;
  let ps = [];
  const draw = async () => { ps = (await all('products')).sort((a, b) => a.name.localeCompare(b.name));
    $('#list').innerHTML = ps.length ? ps.map(p => `<div class="item" data-id="${esc(p.id)}"><div><b>${esc(p.name)}</b>${p.active ? '' : ' <em class="tag">Nonaktif</em>'}
      <small class="meta"><span>${esc(p.category || 'Tanpa kategori')}</span><span>${esc(p.sku || 'Tanpa SKU')}</span><span>Modal ${rp(p.cost)}</span><span>Jual ${rp(p.price)}</span><span>${p.stock == null ? 'Stok tidak dilacak' : 'Stok ' + p.stock + ' ' + esc(p.unit || '')}</span></small></div>
      <div class="acts"><button class="btn sm" data-a="edit">Ubah</button><button class="btn sm danger" data-a="del">Hapus</button></div></div>`).join('')
      : '<p class="empty">Belum ada produk. Tekan Tambah produk untuk memulai.</p>'; };
  const form = p => { const isNew = !p; p = p || { id: uid(), active: true, unit: 'pcs' };
    dlg.innerHTML = `<form method="dialog" id="f"><h3>${isNew ? 'Tambah' : 'Ubah'} produk</h3>
      <label>Nama produk<input name="name" class="input" required maxlength="80" value="${esc(p.name)}"></label>
      <div class="row2"><label>SKU / kode<input name="sku" class="input" maxlength="40" value="${esc(p.sku)}"></label><label>Kategori<input name="category" class="input" maxlength="40" value="${esc(p.category)}"></label></div>
      <div class="row2"><label>Harga modal (Rp)<input name="cost" class="input" inputmode="numeric" value="${p.cost || 0}"></label><label>Harga jual (Rp)<input name="price" class="input" inputmode="numeric" required value="${p.price ?? ''}"></label></div>
      <div class="row2"><label>Satuan<input name="unit" class="input" maxlength="20" value="${esc(p.unit)}"></label><label>Stok (kosong = tidak dilacak)<input name="stock" class="input" inputmode="numeric" value="${p.stock ?? ''}" ${!isNew && isProd() ? 'readonly title="Ubah stok lewat menu Inventaris"' : ''}></label></div>
      <label class="chk"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}>Aktif dijual</label>
      <div class="rc-a"><button class="btn" value="cancel" formnovalidate>Batal</button><button class="btn primary" value="ok">Simpan</button></div></form>`;
    dlg.showModal();
    $('#f').onsubmit = async e => { if (e.submitter?.value === 'cancel') return; try {
      const v = Object.fromEntries(new FormData(e.target));
      await saveProduct({ ...p, name: v.name.trim(), sku: v.sku.trim(), category: v.category.trim(), unit: v.unit.trim() || 'pcs',
        cost: toInt(v.cost), price: toInt(v.price), stock: v.stock.trim() === '' ? null : toInt(v.stock), active: 'active' in v }, isNew);
      toast('Produk tersimpan'); draw(); } catch (er) { toast('Gagal menyimpan: ' + er.message); } }; };
  root.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'add') return form();
    const p = ps.find(x => x.id === b.closest('[data-id]')?.dataset.id); if (!p) return;
    if (b.dataset.a === 'edit') form(p);
    else if (b.dataset.a === 'del' && confirm(`Hapus "${p.name}"? Riwayat transaksi lama tidak berubah.`)) { try { await removeProduct(p); draw(); } catch (er) { toast('Gagal menghapus: ' + er.message); } } });
  draw();
}
