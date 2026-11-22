export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove('on'), 2600); }
export const share = (text, title) => navigator.share ? navigator.share({ title, text }).catch(() => {}) :
  navigator.clipboard.writeText(text).then(() => toast('Struk disalin ke papan klip'), () => toast('Perangkat ini tidak mendukung berbagi'));
const P = { kasir: 'M3 4h2l2.4 11h10.2L20 7H6.2M9 20h.01M17 20h.01', produk: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4m0 0l9-4m-9 4v10',
  transaksi: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6', dashboard: 'M4 20V10m6 10V4m6 16v-7M2 20h20', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18' };
export const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
