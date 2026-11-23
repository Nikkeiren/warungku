export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('on'), 2600); }
export const share = (text, title) => navigator.share ? navigator.share({ title, text }).catch(() => {}) :
  navigator.clipboard.writeText(text).then(() => toast('Struk disalin ke papan klip'), () => toast('Perangkat ini tidak mendukung berbagi'));
const P = { kasir: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20h.01M17 20h.01', produk: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4m0 0l9-4m-9 4v10',
  transaksi: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6', dashboard: 'M4 20V10m6 10V4m6 16v-7M2 20h20', plus: 'M12 5v14M5 12h14', laporan: 'M6 3h9l4 4v14H6V3zm8 0v5h5M9 13h6m-6 4h6', pengeluaran: 'M3 7h18v12H3V7zm0 4h18M7 15h3', inventaris: 'M12 3l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5', pengaturan: 'M4 7h10m4 0h2M4 17h2m4 0h10M14 5v4M8 15v4', pengguna: 'M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 11a3 3 0 100-6 3 3 0 000 6zm10 8v-1a3 3 0 00-2-2.8M15 5.2a3 3 0 010 5.6', x: 'M6 6l12 12M18 6L6 18' };
export const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
