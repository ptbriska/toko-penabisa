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

    if (headerRes.ok) document.getElementById('globalHeader').innerHTML = await headerRes.text();
    if (footerRes.ok) document.getElementById('globalFooter').innerHTML = await footerRes.text();

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
    if (!res.ok) throw new Error("File index.json tidak ditemukan");
    
    const data = await res.json();

    if (data.banner_promo) {
      const bannerImg = document.getElementById('bannerPromoImg');
      const bannerLink = document.getElementById('bannerPromoLink');
      if (bannerImg && data.banner_promo.image_url) bannerImg.src = data.banner_promo.image_url;
      if (bannerLink) bannerLink.href = data.banner_promo.link || '../katalog/index.html';
    }

    if (data.hero) {
      if (document.getElementById('heroBadge')) document.getElementById('heroBadge').innerText = data.hero.badge;
      if (document.getElementById('heroHeadline')) document.getElementById('heroHeadline').innerText = data.hero.headline;
      if (document.getElementById('heroSubheadline')) document.getElementById('heroSubheadline').innerText = data.hero.subheadline;
      
      const ctaPri = document.getElementById('heroCtaPrimary');
      const ctaSec = document.getElementById('heroCtaSecondary');
      if (ctaPri) {
        ctaPri.innerText = data.hero.cta_primary_text;
        ctaPri.href = data.hero.cta_primary_link;
      }
      if (ctaSec) {
        ctaSec.innerText = data.hero.cta_secondary_text;
        ctaSec.href = data.hero.cta_secondary_link;
      }
    }

    const infoGrid = document.getElementById('infoServicesGrid');
    if (infoGrid && data.info_services) {
      infoGrid.innerHTML = data.info_services.map(info => `
        <div class="info-card-modern">
          <span class="badge-card">${info.badge}</span>
          <h3>${info.icon || ''} ${info.title}</h3>
          <p>${info.description}</p>
        </div>
      `).join('');
    }

    const categoryGrid = document.getElementById('categoryGrid');
    if (categoryGrid && data.categories) {
      categoryGrid.innerHTML = data.categories.map(cat => `
        <a href="../katalog/index.html?kategori=${encodeURIComponent(cat.name)}" class="category-card">
          <div class="category-code">${cat.code}</div>
          <div><span>${cat.icon || '📚'}</span> <strong>${cat.name}</strong></div>
        </a>
      `).join('');
    }

  } catch (err) {
    console.error("Gagal memuat index.json beranda:", err);
  }
}

// 5. Memuat Produk Best Seller dari index-katalog.json (dengan Robust Fallback Path)
async function loadBestSellerBooks() {
  const container = document.getElementById('bestSellerGrid');
  if (!container) return;

  const possiblePaths = [
    '../index-katalog.json',
    '/index-katalog.json',
    '../../index-katalog.json'
  ];

  let res = null;
  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        res = response;
        break;
      }
    } catch (e) {}
  }

  if (!res) {
    console.error("Gagal memuat file index-katalog.json untuk Best Seller.");
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Gagal memuat daftar Best Seller.</p>';
    return;
  }

  try {
    const index = await res.json();
    const books = index.books || [];

    let bestSellers = [];
    for (const folder of books) {
      try {
        const metaRes = await fetch(`../books/${folder}/metabuku.json`);
        if (!metaRes.ok) continue;
        const meta = await metaRes.json();

        if (meta.is_best_seller) {
          bestSellers.push({ folder: `../books/${folder}`, folderName: folder, meta });
        }
      } catch (e) {}
    }

    if (bestSellers.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">Belum ada rekomendasi Best Seller.</p>';
      return;
    }

    container.innerHTML = bestSellers.map(item => `
      <div class="book-card-light">
        <img src="${item.folder}/gambardepan.png" alt="${item.meta.judul}" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x260?text=Sampul+Buku';">
        <h4>${item.meta.judul}</h4>
        <div class="price-light">Rp ${(item.meta.harga_cetak || item.meta.harga_ebook || 0).toLocaleString('id-ID')}</div>
        <a href="../detailbuku/index.html?folder=${item.folderName}" class="btn-card-action">Lihat Detail Buku</a>
      </div>
    `).join('');

  } catch (err) {
    console.error("Gagal memuat best seller:", err);
  }
}
