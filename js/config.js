const env = (typeof window !== 'undefined' && window.WARUNGKU_ENV) || {};
export const CONFIG = {
  APP_NAME: 'Warungku',
  MODE: 'demo', // v1 hanya mode demo (lihat README bagian "Belum selesai")
  SUPABASE_URL: env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
  taxPct: 0, serviceFee: 0, lowStock: 5,
  quickCash: [5000, 10000, 20000, 50000, 100000],
  payMethods: ['Tunai', 'QRIS', 'Transfer', 'Lainnya'],
};
