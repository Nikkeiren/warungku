// [label, role yang boleh, hanya mode produksi]. Akses sebenarnya dipaksa RLS di server.
export const PAGES = { kasir: ['Kasir', 'owner admin kasir'], transaksi: ['Transaksi', 'owner admin kasir'], produk: ['Produk', 'owner admin'], inventaris: ['Inventaris', 'owner admin'], lainnya: ['Lainnya', 'owner admin kasir'],
  dashboard: ['Ringkasan', 'owner admin'], laporan: ['Laporan', 'owner admin'], pengeluaran: ['Pengeluaran', 'owner admin'], pengguna: ['Pengguna', 'owner', 1], pengaturan: ['Pengaturan', 'owner admin kasir', 1] };
export const TABS = ['kasir', 'transaksi', 'produk', 'inventaris', 'lainnya'];
export const can = (k, role, prod) => !!PAGES[k] && PAGES[k][1].includes(role) && (!PAGES[k][2] || prod);
