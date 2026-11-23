// Font khusus nama usaha di topbar (dimuat dari Google Fonts, lihat index.html). Fallback generik bila offline.
export const FONTS = [['Fraunces', 'serif'], ['Playfair Display', 'serif'], ['Lobster', 'cursive'], ['Pacifico', 'cursive'], ['Poppins', 'sans-serif'], ['Montserrat', 'sans-serif'], ['Oswald', 'sans-serif'], ['Merriweather', 'serif'],
  ['Dancing Script', 'cursive'], ['Bebas Neue', 'sans-serif'], ['Abril Fatface', 'serif'], ['Caveat', 'cursive'], ['Righteous', 'sans-serif'], ['Quicksand', 'sans-serif'], ['Space Grotesk', 'sans-serif']];
export const brandFont = n => { const f = FONTS.find(x => x[0] === n); return f ? `"${f[0]}", ${f[1]}` : ''; };
