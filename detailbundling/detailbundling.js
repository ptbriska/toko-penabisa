/* ==========================================================================
   Detail Bundling Module Logic - Isolated (Dynamic WMS SKU & Reviews)
   ========================================================================== */

const WA_NUMBER = "6282268118842";

let masterIndexData = null;
let targetSku = null;
let targetBundle = null;
let booksDatabase = {};

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  await initDetailBundlingPage();
});

// 1. Load Shared Components (Header & Footer)
async function loadSharedComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('../components/header.html'),
      fetch('../components/footer.html')
    ]);

    if (headerRes.ok) document.getElementById('globalHeader').innerHTML = await headerRes.text();
    if (footerRes.ok) document.getElementById('globalFooter').innerHTML = await footerRes.text();

    const activeNav = document.getElementById('nav-bundling');
    if (activeNav) activeNav.classList.add('active');

  } catch (err) {
    console.warn("Shared components error:", err);
  }
}

// 2. Update Badge Keranjang
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) badge.innerText = totalQty;
}

// 3. Inisialisasi Data Detail Bundling & Dynamic WMS Rekap
async function initDetailBundlingPage() {
  const params = new URLSearchParams(window.location.search);
  targetSku = params.get('sku') || params.get('folder');

  if (!targetSku) {
    document.getElementById('detailLoading').innerHTML = '<p style="color:#ef4444;">⚠️ SKU Paket Bundling tidak ditentukan di URL.</p>';
    return;
  }

  try {
    // Fetch Master Index
    const res = await fetch('../index-katalog.json');
    if (!res.ok) throw new Error("File index-katalog.json tidak dapat diakses.");
    masterIndexData = await res.json();

    // Cari target bundling berdasarkan SKU atau Nama Folder
    const bundlingList = masterIndexData.bundling || [];
    targetBundle = bundlingList.find(b => b.sku === targetSku || b.folder === targetSku);

    if (!targetBundle) {
      document.getElementById('detailLoading').innerHTML = `<p style="color:#ef4444;">⚠️ Paket Bundling dengan SKU "${targetSku}" tidak ditemukan.</p>`;
      return;
    }

    // Pre-fetch seluruh metadata buku penyusun untuk WMS mapping
    if (masterIndexData.books && Array.isArray(masterIndexData.books)) {
      for (const bookFolder of masterIndexData.books) {
        try {
          const bRes = await fetch(`../books/${bookFolder}/metabuku.json`);
          if (bRes.ok) {
            const bMeta = await bRes.json();
            const skuKey = bMeta.sku || bMeta.id || bookFolder;
            booksDatabase[skuKey] = {
              folder: bookFolder,
              meta: bMeta
            };
          }
        } catch (e) {}
      }
    }

    const folderPath = `../bundling/${targetBundle.folder}`;

    // Fetch Deskripsi Markdown Bundling
    let mdText = "Deskripsi paket bundling belum tersedia.";
    try {
      const mdRes = await fetch(`${folderPath}/deskripsibundling.md`);
      if (mdRes.ok) mdText = await mdRes.text();
    } catch (e) {}

    // Populate UI Title & Badges
    document.title = `${targetBundle.judul_bundling} - Toko Penerbit Pena Bisa`;
    document.getElementById('breadcrumbTitle').innerText = targetBundle.judul_bundling;
    document.getElementById('bundlingTitle').innerText = targetBundle.judul_bundling;
    document.getElementById('bundlingSkuBadge').innerText = `SKU: ${targetBundle.sku}`;
    document.getElementById('bundlingTypeBadge').innerText = targetBundle.jenis === 'Ebook' ? '📱 Paket E-Book Digital' : '📚 Paket Buku Cetak';

    // Poster Image dengan Fallback Pengecekan (poster.png vs Poster.png)
    const posterImg = document.getElementById('mainPosterImg');
    posterImg.src = `${folderPath}/poster.png`;
    posterImg.onerror = () => {
      posterImg.onerror = () => {
        posterImg.src = 'https://via.placeholder.com/400x500?text=Poster+Bundling';
      };
      posterImg.src = `${folderPath}/Poster.png`;
    };

    // Tags
    document.getElementById('bundlingTagPills').innerHTML = (targetBundle.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join(' ');

    // Price
    document.getElementById('bundlingPriceTag').innerText = targetBundle.harga_bundling ? `Rp ${targetBundle.harga_bundling.toLocaleString('id-ID')}` : 'Hubungi CS';

    // RENDER REKAP DINAMIS WMS SKU BUKU (CLICKABLE CARDS)
    renderWmsBookRekap(targetBundle.items_sku);

    // Opsi Pembelian
    if (targetBundle.jenis === 'Ebook' && targetBundle.link_mayar) {
      const mayarBox = document.getElementById('mayarActionBox');
      mayarBox.classList.remove('hidden');
      document.getElementById('btnMayarDirect').href = targetBundle.link_mayar;
    } else {
      const cetakBox = document.getElementById('cetakActionBox');
      cetakBox.classList.remove('hidden');

      const waMsg = encodeURIComponent(`Halo Admin Pena Bisa, saya mau pesan Paket Bundling:\n*Judul:* ${targetBundle.judul_bundling}\n*SKU:* ${targetBundle.sku}\n*Harga:* Rp ${(targetBundle.harga_bundling || 0).toLocaleString('id-ID')}`);
      document.getElementById('btnWaBundling').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      document.getElementById('btnAddToCartBundling').onclick = () => {
        addBundlingToCart(targetBundle.sku, targetBundle.judul_bundling, targetBundle.harga_bundling || 0, `${folderPath}/poster.png`);
      };
    }

    // Render Markdown Content
    if (window.marked) {
      document.getElementById('bundlingMarkdownContent').innerHTML = marked.parse(mdText);
    } else {
      document.getElementById('bundlingMarkdownContent').innerText = mdText;
    }

    // Render Ulasan Pembaca
    renderBundlingReviews();

    // Switch Visibility
    document.getElementById('detailLoading').classList.add('hidden');
    document.getElementById('bundlingWrapper').classList.remove('hidden');
    document.getElementById('bundlingExtraSection').classList.remove('hidden');

  } catch (err) {
    console.error("Gagal memuat detail bundling:", err);
    document.getElementById('detailLoading').innerHTML = '<p style="color:#ef4444;">Gagal memuat data paket bundling.</p>';
  }
}

// 4. Render Rekap Buku Penyusun yang Dapat Di-klik (Direct Link ke Halaman Detail Buku)
function renderWmsBookRekap(itemsSku) {
  const container = document.getElementById('wmsItemsList');
  if (!container) return;

  if (!Array.isArray(itemsSku) || itemsSku.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">Daftar buku penyusun tidak tertera.</p>`;
    return;
  }

  container.innerHTML = itemsSku.map(sku => {
    const bookData = booksDatabase[sku];
    if (bookData) {
      const detailBookUrl = `../detailbuku/index.html?folder=${bookData.folder}`;
      return `
        <a href="${detailBookUrl}" target="_blank" class="wms-item-card" title="Klik untuk membuka detail buku ${bookData.meta.judul}">
          <img src="../books/${bookData.folder}/gambardepan.png" alt="Cover" onerror="this.onerror=null; this.src='https://via.placeholder.com/40x50?text=Buku';">
          <div class="wms-item-details">
            <strong>${bookData.meta.judul}</strong>
            <small>SKU: ${sku} | Penulis: ${bookData.meta.penulis || 'Pena Bisa'}</small>
          </div>
          <span class="arrow-icon">➔</span>
        </a>
      `;
    } else {
      return `
        <div class="wms-item-card" style="cursor:default;">
          <div class="wms-item-details">
            <strong>Buku Terdaftar (SKU: ${sku})</strong>
            <small>Termasuk dalam paket bundling ini</small>
          </div>
        </div>
      `;
    }
  }).join('');
}

// 5. Sistem Ulasan Pembaca
function renderBundlingReviews() {
  const container = document.getElementById('reviewsList');
  if (!container || !targetSku) return;

  const storageKey = `penabisa_reviews_bundling_${targetSku}`;
  const reviews = JSON.parse(localStorage.getItem(storageKey)) || [
    { name: "Ahmad F.", rating: 5, comment: "Paket bundling yang sangat hemat dan bukunya sangat membantu persiapan olimpiade!", date: "12 Feb 2025" }
  ];

  container.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <span class="review-author">${r.name}</span>
        <span class="review-stars">${'⭐'.repeat(r.rating)}</span>
      </div>
      <p class="review-text">${r.comment}</p>
      <span class="review-date">${r.date}</span>
    </div>
  `).join('');
}

function submitBundlingReview() {
  const nameInput = document.getElementById('reviewName');
  const commentInput = document.getElementById('reviewComment');
  const ratingSelect = document.getElementById('reviewRating');

  if (!nameInput.value.trim() || !commentInput.value.trim() || !targetSku) {
    alert("Mohon lengkapi nama dan isi ulasan Anda.");
    return;
  }

  const newReview = {
    name: nameInput.value.trim(),
    rating: parseInt(ratingSelect.value),
    comment: commentInput.value.trim(),
    date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  };

  const storageKey = `penabisa_reviews_bundling_${targetSku}`;
  const existingReviews = JSON.parse(localStorage.getItem(storageKey)) || [];
  existingReviews.unshift(newReview);

  localStorage.setItem(storageKey, JSON.stringify(existingReviews));

  nameInput.value = '';
  commentInput.value = '';
  alert("Terima kasih! Ulasan Anda berhasil ditambahkan.");
  renderBundlingReviews();
}

// 6. Tambah Bundling ke Keranjang Belanja
function addBundlingToCart(sku, judul, harga, cover) {
  let cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const existing = cart.find(item => item.id === sku);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: sku, judul: `[Paket] ${judul}`, harga, cover, qty: 1 });
  }

  localStorage.setItem('penabisa_cart', JSON.stringify(cart));
  updateCartBadge();
  alert(`✅ Paket "${judul}" berhasil ditambahkan ke keranjang belanja.`);
}
