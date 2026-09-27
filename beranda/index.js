/* ==========================================================================
   Beranda Module Logic - Isolated
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  await loadBerandaContent();
  await loadBestSellerBooks();
});

// 1. Memuat Header dan Footer secara Asinkron
async function loadSharedComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('../components/header.html'),
      fetch('../components/footer.html')
    ]);

    document.getElementById('globalHeader').innerHTML = await headerRes.text();
    document.getElementById('globalFooter').innerHTML = await footerRes.text();

    // Set Active Link
    const activeNav = document.getElementById('nav-beranda');
    if (activeNav) activeNav.classList.add('active');

  } catch (err) {
    console.error("Gagal memuat komponen shared header/footer:", err);
  }
}

// 2. Update Badge Keranjang
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) badge.innerText = totalQty;
}

// 3. Global Search In-Header
function handleGlobalSearch(event) {
  if (event.key === 'Enter') {
    const keyword = event.target.value.trim();
    if (keyword) {
      window.location.href = `../katalog/index.html?search=${encodeURIComponent(keyword)}`;
    }
  }
}

// 4. Memuat Konten Beranda dari index.json
async function loadBerandaContent() {
  try {
    const res = await fetch('index.json');
    const data = await res.json();

    if (data.banner_promo) {
      document.getElementById('bannerPromoImg').src = data.banner_promo.image_url;
      document.getElementById('bannerPromoLink').href = data.banner_promo.link || '../katalog/index.html';
    }

    if (data.hero) {
      document.getElementById('heroBadge').innerText = data.hero.badge;
      document.getElementById('heroHeadline').innerText = data.hero.headline;
      document.getElementById('heroSubheadline').innerText = data.hero.subheadline;
      document.getElementById('heroCtaPrimary').innerText = data.hero.cta_primary_text;
      document.getElementById('heroCtaPrimary').href = data.hero.cta_primary_link;
      document.getElementById('heroCtaSecondary').innerText = data.hero.cta_secondary_text;
      document.getElementById('heroCtaSecondary').href = data.hero.cta_secondary_link;
    }

    const infoGrid = document.getElementById('infoServicesGrid');
    if (infoGrid && data.info_services) {
      infoGrid.innerHTML = data.info_services.map(info => `
        <div class="info-card-modern">
          <span class="badge-card">${info.badge}</span>
          <h3>${info.icon} ${info.title}</h3>
          <p>${info.description}</p>
        </div>
      `).join('');
    }

    const categoryGrid = document.getElementById('categoryGrid');
    if (categoryGrid && data.categories) {
      categoryGrid.innerHTML = data.categories.map(cat => `
        <a href="../katalog/index.html?kategori=${encodeURIComponent(cat.name)}" class="category-card">
          <div class="category-code">${cat.code}</div>
          <div><span>${cat.icon}</span> <strong>${cat.name}</strong></div>
        </a>
      `).join('');
    }

  } catch (err) {
    console.error("Gagal memuat index.json beranda:", err);
  }
}

// 5. Memuat Produk Best Seller dari index-katalog.json
async function loadBestSellerBooks() {
  const container = document.getElementById('bestSellerGrid');
  if (!container) return;

  try {
    const res = await fetch('../index-katalog.json');
    const index = await res.json();

    let bestSellers = [];
    for (const folder of index.books) {
      const meta = await fetch(`../books/${folder}/metabuku.json`).then(r => r.json());
      if (meta.is_best_seller) {
        bestSellers.push({ folder: `../books/${folder}`, folderName: folder, meta });
      }
    }

    if (bestSellers.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Belum ada rekomendasi Best Seller.</p>';
      return;
    }

    container.innerHTML = bestSellers.map(item => `
      <div class="book-card-light">
        <img src="${item.folder}/gambardepan.png" alt="${item.meta.judul}">
        <h4>${item.meta.judul}</h4>
        <div class="price-light">Rp ${(item.meta.harga_cetak || 0).toLocaleString('id-ID')}</div>
        <a href="../detailbuku/index.html?folder=${item.folderName}" class="btn-card-action">Lihat Detail Buku</a>
      </div>
    `).join('');

  } catch (err) {
    console.error("Gagal memuat best seller:", err);
  }
}
