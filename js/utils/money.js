// Semua uang = integer rupiah.
export const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const toInt = v => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0; };
// Kalkulator aman (tanpa eval). Hasil dibulatkan ke rupiah utuh.
export function calc(expr) {
  const t = expr.replace(/\s/g, '').match(/\d+(\.\d+)?|[^\d]/g) || [];
  while (t.length && /[^\d.]/.test(t[t.length - 1])) t.pop(); // buang operator menggantung
  if (!t.length) return 0;
  const f = { '+': (a, b) => a + b, '-': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => b ? a / b : NaN };
  for (const set of [['×', '÷'], ['+', '-']])
    for (let i = 1; i < t.length; i += 2) if (set.includes(t[i])) { t.splice(i - 1, 3, String(f[t[i]](+t[i - 1], +t[i + 1]))); i -= 2; }
  const r = Math.round(+t[0]);
  return Number.isFinite(r) ? r : 0;
}
