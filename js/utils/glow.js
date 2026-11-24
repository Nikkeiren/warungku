// Cahaya ambient lembut pada kartu produk: warna dominan foto, dihitung sekali per gambar (canvas 12x12). Tanpa filter blur agar scroll tetap ringan.
const cache = new Map();
export function domColor(d) { // d = data piksel RGBA
  let r = 0, g = 0, b = 0, w = 0, sat = 0;
  for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), l = (mx + mn) / 510, s = mx ? (mx - mn) / mx : 0,
    k = s * s * Math.max(0, 1 - Math.abs(l - .5) * 1.6); r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k; sat += s; }
  if (w < 1.5 || sat / (d.length / 4) < 0.12) return null; // foto netral (putih/hitam/abu): tampilan normal
  const mix = v => Math.round(v / w * .8 + 128 * .2); // diredam agar tidak neon
  return `${mix(r)} ${mix(g)} ${mix(b)}`;
}
export function applyGlow(img) {
  const card = img.closest('.pcard'); if (!card || !img.naturalWidth) return;
  const key = (img.currentSrc || img.src).split('?')[0]; let rgb = cache.get(key);
  if (rgb === undefined) try { const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 12, 12); rgb = domColor(x.getImageData(0, 0, 12, 12).data); cache.set(key, rgb); } catch { return; } // tanpa izin CORS: tampilan normal
  if (rgb) { card.style.setProperty('--glow', rgb); card.classList.add('glow'); }
}
