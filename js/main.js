/* ==========================================================================
   Toko Pena Bisa - Core JavaScript Engine (Versi 1.0 Updated)
   ========================================================================== */

const WA_NUMBER = "6282268118842";
const INDEX_URL = "data/index-katalog.json";

let catalogBooks = [];
let catalogBundling = [];
let cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];

// 1. INITIALIZATION & ROUTER
document.addEventListener("DOMContentLoaded", async () => {
  updateCartBadge();
  await loadAllCatalogData();

  const currentPage = document.body.getAttribute('data-page');

  switch (currentPage) {
    case 'beranda':
      await renderBerandaView();
      break;
    case 'katalog':
      populateCategoryFilters();
      applyUrlCategoryFilter();
      break;
    case 'bundling':
      renderBundlingView(catalogBundling);
      break;
    case 'detailbuku':
      initDetailBukuPage();
      break;
    case 'detailbundling':
      initDetailBundlingPage();
      break;
    case 'cart':
      renderCartPage();
      break;
  }
});

// 2. FETCH ALL DATA FROM GITHUB REPO
async function loadAllCatalogData() {
  try {
    const res = await fetch(INDEX_URL);
    const index = await res.json();

    // Fetch Books
    for (const folder of index.books) {
      const meta = await fetch(`books/${folder}/metabuku.json`).then(r => r.json());
      const landing = await fetch(`books/${folder}/landingpage.json`).then(r => r.json());
      catalogBooks.push({ folder: `books/${folder}`, folderName: folder, meta, landing });
    }

    // Fetch Bundling
    for (const folder of index.bundling) {
      const meta = await fetch(`bundling/${folder}/metabuku.json`).then(r => r.json());
      const landing = await fetch(`bundling/${folder}/landingpage.json`).then(r => r.json());
      catalogBundling.push({ folder: `bundling/${folder}`, folderName: folder, meta, landing });
    }
  } catch (err) {
    console.error("Gagal memuat arsip data katalog:", err);
  }
}

// 3. RENDER BERANDA (MEMBACA data/index.json)
async function renderBerandaView() {
  try {
    const res = await fetch('data/index.json');
    const data = await res.json();

    // A. Render Banner Promosi Utama
    if (data.banner_promo) {
      const bannerImg = document.getElementById('bannerPromoImg');
      const bannerLink = document.getElementById('bannerPromoLink');
      if (bannerImg) {
        bannerImg.src = data.banner_promo.image_url;
        bannerImg.alt = data.banner_promo.alt_text || 'Banner Promosi';
      }
      if (bannerLink) bannerLink.href = data.banner_promo.link || 'katalog.html';
    }

    // B. Render Hero Card Text
    if (data.hero) {
      const elBadge = document.getElementById('heroBadge');
      const elHead = document.getElementById('heroHeadline');
      const elSub = document.getElementById('heroSubheadline');
      const elCta1 = document.getElementById('heroCtaPrimary');
      const elCta2 = document.getElementById('heroCtaSecondary');

      if (elBadge) elBadge.innerText = data.hero.badge;
      if (elHead) elHead.innerText = data.hero.headline;
      if (elSub) elSub.innerText = data.hero.subheadline;
      if (elCta1) {
        elCta1.innerText = data.hero.cta_primary_text;
        elCta1.href = data.hero.cta_primary_link;
      }
      if (elCta2) {
        elCta2.innerText = data.hero.cta_secondary_text;
        elCta2.href = data.hero.cta_secondary_link;
      }
    }

    // C. Render Info Services Cards
    const infoContainer = document.getElementById('infoServicesGrid');
    if (infoContainer && data.info_services) {
      infoContainer.innerHTML = data.info_services.map(info => `
        <div class="info-card-modern">
          <span class="badge-card">${info.badge}</span>
          <div class="info-card-header">
            <span class="icon">${info.icon}</span>
            <h3>${info.title}</h3>
          </div>
          <p>${info.description}</p>
        </div>
      `).join('');
    }

    // D. Render Kategori Grid (Kategori A–V)
    const catContainer = document.getElementById('categoryGrid');
    if (catContainer && data.categories) {
      catContainer.innerHTML = data.categories.map(cat => `
        <a href="katalog.html?kategori=${encodeURIComponent(cat.name)}" class="category-card">
          <div class="category-code">${cat.code}</div>
          <div class="category-info">
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
          </div>
        </a>
      `).join('');
    }

  } catch (err) {
    console.error("Gagal memuat data/index.json untuk beranda:", err);
  }
}

// 4. RENDER ETALASE KATALOG & BUNDLING
function renderKatalogView(items) {
  const container = document.getElementById('katalogGrid');
  const countSpan = document.getElementById('productCount');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">Buku untuk pencarian/kategori ini belum tersedia.</p>';
  } else {
    container.innerHTML = items.map(item => createProductCardHTML(item, 'book')).join('');
  }

  if (countSpan) countSpan.innerText = `Menampilkan ${items.length} produk`;
}

function renderBundlingView(items) {
  const container = document.getElementById('bundlingGrid');
  const countSpan = document.getElementById('bundlingCount');
  if (!container) return;

  container.innerHTML = items.map(item => createProductCardHTML(item, 'bundling')).join('');
  if (countSpan) countSpan.innerText = `Menampilkan ${items.length} paket`;
}

function createProductCardHTML(item, type) {
  const coverImg = type === 'book' ? 'gambardepan.png' : 'feed1.png';
  const priceDisplay = item.meta.harga_cetak 
    ? `Rp ${item.meta.harga_cetak.toLocaleString('id-ID')}`
    : (item.meta.harga_ebook ? `E-Book: Rp ${item.meta.harga_ebook.toLocaleString('id-ID')}` : 'Lihat Info');

  return `
    <div class="book-card-light">
      <img src="${item.folder}/${coverImg}" alt="${item.meta.judul}" loading="lazy">
      <h4>${item.meta.judul}</h4>
      <div class="price-light">${priceDisplay}</div>
      <button class="btn-card-action" onclick="openIgModal('${type}', '${item.folderName}')">Cek Info Buku</button>
    </div>
  `;
}

// 5. IG MODAL POP-UP LOGIC
function openIgModal(type, folderName) {
  const dataset = type === 'book' ? catalogBooks : catalogBundling;
  const item = dataset.find(i => i.folderName === folderName);
  if (!item) return;

  const modal = document.getElementById('igModal');
  const carousel = document.getElementById('igCarousel');
  const copywriting = document.getElementById('igCopywriting');
  const footer = document.getElementById('igModalFooter');

  if (carousel) {
    carousel.innerHTML = item.landing.carousel_images.map(img => 
      `<img src="${item.folder}/${img}" alt="Slide">`
    ).join('');
  }

  if (copywriting) {
    copywriting.innerText = item.landing.copywriting_ig || item.landing.headline;
  }

  const detailTarget = type === 'book' ? 'detailbuku.html' : 'detailbundling.html';
  if (footer) {
    footer.innerHTML = `
      <a href="${detailTarget}?folder=${folderName}" class="btn-brand-primary" style="display:block; text-align:center;">
        Informasi Lengkap & Pemesanan
      </a>
    `;
  }

  if (modal) modal.classList.remove('hidden');
}

function closeIgModal() {
  const modal = document.getElementById('igModal');
  if (modal) modal.classList.add('hidden');
}

// 6. DETAIL BUKU PAGE LOGIC
async function initDetailBukuPage() {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folder');
  if (!folderName) return;

  try {
    const meta = await fetch(`books/${folderName}/metabuku.json`).then(r => r.json());
    const mdText = await fetch(`books/${folderName}/deskripsibuku.md`).then(r => r.text());

    document.getElementById('detailLoading')?.classList.add('hidden');
    document.getElementById('bookView')?.classList.remove('hidden');
    document.getElementById('bookExtra')?.classList.remove('hidden');

    document.getElementById('bookTitle').innerText = meta.judul;
    document.getElementById('bookAuthor').innerText = meta.penulis;
    document.getElementById('isbnCetakText').innerText = meta.isbn_cetak || '-';
    document.getElementById('isbnEbookText').innerText = meta.isbn_ebook || '-';
    document.getElementById('bookCategory').innerText = meta.kategori || 'Umum';

    // Main Cover Image
    const mainImg = document.getElementById('bookMainImage');
    if (mainImg) mainImg.innerHTML = `<img src="books/${folderName}/gambardepan.png" id="currentMainImg">`;

    // Format E-Book (Mayar Direct)
    if (meta.links && meta.links.mayar_ebook) {
      const ebookCard = document.getElementById('ebookOptionCard');
      if (ebookCard) ebookCard.classList.remove('hidden');
      document.getElementById('priceEbookTag').innerText = `Rp ${meta.harga_ebook.toLocaleString('id-ID')}`;
      document.getElementById('btnMayar').href = meta.links.mayar_ebook;
    }

    // Format Cetak (Shopee, Tokopedia, WA, & Cart)
    if (meta.harga_cetak) {
      const cetakCard = document.getElementById('cetakOptionCard');
      if (cetakCard) cetakCard.classList.remove('hidden');
      document.getElementById('priceCetakTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

      if (meta.links.shopee) {
        const btn = document.getElementById('btnShopee');
        if (btn) { btn.href = meta.links.shopee; btn.classList.remove('hidden'); }
      }
      if (meta.links.tokopedia) {
        const btn = document.getElementById('btnTokopedia');
        if (btn) { btn.href = meta.links.tokopedia; btn.classList.remove('hidden'); }
      }

      const waMsg = encodeURIComponent(`Halo Pena Bisa, saya berminat membeli buku cetak: ${meta.judul}`);
      document.getElementById('btnWaDirect').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      document.getElementById('btnAddToCartBook').onclick = () => {
        addToCart(meta.id || folderName, meta.judul, meta.harga_cetak, `books/${folderName}/gambardepan.png`);
      };
    }

    // Markdown Render
    if (typeof marked !== 'undefined') {
      document.getElementById('bookMarkdown').innerHTML = marked.parse(mdText);
    }

  } catch (err) {
    console.error("Gagal memuat detail buku:", err);
  }
}

// 7. DETAIL BUNDLING PAGE LOGIC
async function initDetailBundlingPage() {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folder');
  if (!folderName) return;

  try {
    const meta = await fetch(`bundling/${folderName}/metabuku.json`).then(r => r.json());
    const mdText = await fetch(`bundling/${folderName}/deskripsibuku.md`).then(r => r.text());

    document.getElementById('bundlingLoading')?.classList.add('hidden');
    document.getElementById('bundlingView')?.classList.remove('hidden');
    document.getElementById('bundlingExtra')?.classList.remove('hidden');

    document.getElementById('bundlingTitle').innerText = meta.judul;
    document.getElementById('bundlingPriceTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

    const mainFeed = document.getElementById('bundlingFeedMain');
    if (mainFeed) mainFeed.innerHTML = `<img src="bundling/${folderName}/feed1.png">`;

    // Direct Buttons
    const waMsg = encodeURIComponent(`Halo Pena Bisa, saya berminat beli Paket Bundling: ${meta.judul}`);
    document.getElementById('btnWaBundling').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

    document.getElementById('btnAddToCartBundling').onclick = () => {
      addToCart(meta.id || folderName, meta.judul, meta.harga_cetak, `bundling/${folderName}/feed1.png`);
    };

    if (typeof marked !== 'undefined') {
      document.getElementById('bundlingMarkdown').innerHTML = marked.parse(mdText);
    }

  } catch (err) {
    console.error("Gagal memuat detail bundling:", err);
  }
}

// 8. CART ENGINE & LOCAL STORAGE
function addToCart(id, judul, harga, cover) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, judul, harga, cover, qty: 1 });
  }
  saveCart();
  alert(`"${judul}" telah dimasukkan ke keranjang.`);
}

function saveCart() {
  localStorage.setItem('penabisa_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badges = document.querySelectorAll('#cartBadge');
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  badges.forEach(b => b.innerText = totalQty);
}

function renderCartPage() {
  const tbody = document.getElementById('cartTableBody');
  const emptyState = document.getElementById('emptyCartState');
  if (!tbody) return;

  if (cart.length === 0) {
    tbody.innerHTML = '';
    emptyState?.classList.remove('hidden');
    document.getElementById('summaryTotalItems').innerText = '0 produk';
    document.getElementById('summaryTotalPrice').innerText = 'Rp 0';
    return;
  }

  emptyState?.classList.add('hidden');
  let totalPrice = 0;
  let totalItems = 0;

  tbody.innerHTML = cart.map((item, index) => {
    const subtotal = item.harga * item.qty;
    totalPrice += subtotal;
    totalItems += item.qty;

    return `
      <tr>
        <td><strong>${item.judul}</strong></td>
        <td>Rp ${item.harga.toLocaleString('id-ID')}</td>
        <td>
          <input type="number" min="1" value="${item.qty}" onchange="updateCartQty(${index}, this.value)">
        </td>
        <td>Rp ${subtotal.toLocaleString('id-ID')}</td>
        <td><button onclick="removeFromCart(${index})" class="btn-danger-outline">Hapus</button></td>
      </tr>
    `;
  }).join('');

  document.getElementById('summaryTotalItems').innerText = `${totalItems} produk`;
  document.getElementById('summaryTotalPrice').innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;
}

function updateCartQty(index, newQty) {
  const qty = parseInt(newQty);
  if (qty > 0) {
    cart[index].qty = qty;
    saveCart();
    renderCartPage();
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCartPage();
}

function clearCartConfirm() {
  if (confirm("Apakah Anda yakin ingin me-reset keranjang belanja?")) {
    cart = [];
    saveCart();
    renderCartPage();
  }
}

function checkoutViaWA() {
  if (cart.length === 0) return alert("Keranjang belanja masih kosong.");

  let text = "Halo Admin Pena Bisa, saya mau pesan Buku Cetak berikut:\n\n";
  let total = 0;

  cart.forEach((item, i) => {
    const subtotal = item.harga * item.qty;
    total += subtotal;
    text += `${i + 1}. ${item.judul} (${item.qty}x) = Rp ${subtotal.toLocaleString('id-ID')}\n`;
  });

  text += `\n*Total Tagihan:* Rp ${total.toLocaleString('id-ID')}\n\nMohon info rek pembayaran dan estimasi ongkir ya. Terima kasih!`;

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
}

// 9. SEARCH & FILTER HELPERS UNTUK KATALOG
function handleGlobalSearch(event) {
  if (event.key === 'Enter') {
    const keyword = event.target.value.trim();
    if (keyword) {
      window.location.href = `katalog.html?search=${encodeURIComponent(keyword)}`;
    }
  }
}

function populateCategoryFilters() {
  const filterBox = document.getElementById('categoryFilterList');
  if (!filterBox) return;

  const categories = [...new Set(catalogBooks.map(b => b.meta.kategori).filter(Boolean))];
  filterBox.innerHTML = categories.map(cat => `
    <label><input type="checkbox" value="${cat}" onchange="filterCatalog()"> ${cat}</label>
  `).join('');
}

function applyUrlCategoryFilter() {
  const params = new URLSearchParams(window.location.search);
  const targetCategory = params.get('kategori');
  const targetSearch = params.get('search');

  if (targetSearch) {
    const searchInput = document.getElementById('globalSearchInput') || document.getElementById('katalogSearch');
    if (searchInput) searchInput.value = targetSearch;
  }

  if (targetCategory) {
    const checkboxes = document.querySelectorAll('#categoryFilterList input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (cb.value.toLowerCase() === targetCategory.toLowerCase()) {
        cb.checked = true;
      }
    });
  }

  filterCatalog();
}

function filterCatalog() {
  const searchInput = document.getElementById('globalSearchInput') || document.getElementById('katalogSearch');
  const search = searchInput?.value.toLowerCase() || '';
  const isCetak = document.getElementById('filterCetak')?.checked;
  const isEbook = document.getElementById('filterEbook')?.checked;

  const checkedCategories = Array.from(document.querySelectorAll('#categoryFilterList input:checked')).map(cb => cb.value);

  const filtered = catalogBooks.filter(item => {
    const matchSearch = item.meta.judul.toLowerCase().includes(search) || item.meta.penulis.toLowerCase().includes(search);
    const matchCat = checkedCategories.length === 0 || checkedCategories.includes(item.meta.kategori);
    const matchCetak = !isCetak || item.meta.harga_cetak;
    const matchEbook = !isEbook || item.meta.links?.mayar_ebook;

    return matchSearch && matchCat && matchCetak && matchEbook;
  });

  renderKatalogView(filtered);
}
