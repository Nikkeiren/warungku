import { put, all } from '../services/db.js';
const P = [['Kopi Hitam', 'Minuman', 3000, 8000, 'gelas', 40], ['Kopi Susu', 'Minuman', 5000, 12000, 'gelas', 40], ['Teh Manis', 'Minuman', 1500, 5000, 'gelas', 50],
  ['Nasi Ayam Goreng', 'Makanan', 12000, 22000, 'porsi', 20], ['Nasi Goreng', 'Makanan', 8000, 18000, 'porsi', 20], ['Mie Instan Telur', 'Makanan', 5000, 12000, 'porsi', 25],
  ['Air Mineral 600 ml', 'Kelontong', 2000, 4000, 'botol', 60], ['Gula 1 kg', 'Kelontong', 14000, 17000, 'kg', 12], ['Minyak Goreng 1 L', 'Kelontong', 16000, 19000, 'liter', 3]];
// Data contoh deterministik. Semua transaksi bertanda demo/seed.
export async function seedDemo() {
  if ((await all('meta')).some(m => m.k === 'seeded')) return;
  const prods = P.map(([name, category, cost, price, unit, stock], i) => ({ id: 'demo-p' + i, name, sku: 'DM-' + (100 + i), category, cost, price, unit, stock, active: true }));
  let s = 7; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647, ri = n => Math.floor(rnd() * n), trx = [];
  for (let d = 13; d >= 0; d--) for (let n = 0, c = 4 + ri(8); n < c; n++) {
    const items = Array.from({ length: 1 + ri(3) }, () => { const p = prods[ri(prods.length)]; return { productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1 + ri(3), unit: p.unit }; });
    const sub = items.reduce((a, i) => a + i.price * i.qty, 0), at = new Date(); at.setDate(at.getDate() - d); at.setHours(8 + ri(12), ri(60), 0, 0);
    if (+at > Date.now()) at.setTime(Date.now() - ri(3e6));
    trx.push({ id: 'demo-t' + trx.length, no: 'DEMO-' + String(trx.length + 1).padStart(4, '0'), at: +at, items, subtotal: sub, discount: 0, tax: 0, fee: 0, total: sub,
      method: ['Tunai', 'QRIS', 'Transfer'][ri(3)], paid: sub, change: 0, note: '', status: 'selesai', demo: true, seed: true, synced: true });
  }
  await Promise.all([...prods.map(p => put('products', p)), ...trx.map(t => put('transactions', t))]);
  await put('meta', { k: 'seeded', at: Date.now() });
}
