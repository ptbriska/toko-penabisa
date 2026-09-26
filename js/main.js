/* ==========================================================================
   Toko Pena Bisa - Core JavaScript Engine
   ========================================================================== */

const WA_NUMBER = "6282268118842";
const INDEX_URL = "data/index-katalog.json";

let catalogBooks = [];
let catalogBundling = [];
let cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];

// INITIALIZATION
document.addEventListener("DOMContentLoaded", async () => {
  updateCartBadge();
  await loadAllCatalogData();

  const currentPage = document.body.getAttribute('data-page');

  switch (currentPage) {
    case 'beranda':
      renderBerandaView();
      break;
    case 'katalog':
      renderKatalogView(catalogBooks);
      populateCategoryFilters();
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

// FETCH DATA FROM GITHUB REPO
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

// RENDER VIEWS
function renderBerandaView() {
  const container = document.getElementById('bestSellerGrid');
  if (!container) return;

  const bestSellers = catalogBooks.filter(item => item.meta.is_best_seller);
  container.innerHTML = bestSellers.map(item => createProductCardHTML(item, 'book')).join('');
}

function renderKatalogView(items) {
  const container = document.getElementById('katalogGrid');
  const countSpan = document.getElementById('productCount');
  if (!container) return;

  container.innerHTML = items.map(item => createProductCardHTML(item, 'book')).join('');
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
    <div class="product-card">
      <img src="${item.folder}/${coverImg}" alt="${item.meta.judul}" loading="lazy">
      <h4>${item.meta.judul}</h4>
      <div class="price">${priceDisplay}</div>
      <button onclick="openIgModal('${type}', '${item.folderName}')">Cek Info Buku</button>
    </div>
  `;
}

// IG MODAL POP-UP LOGIC
function openIgModal(type, folderName) {
  const dataset = type === 'book' ? catalogBooks : catalogBundling;
  const item = dataset.find(i => i.folderName === folderName);
  if (!item) return;

  const modal = document.getElementById('igModal');
  const carousel = document.getElementById('igCarousel');
  const copywriting = document.getElementById('igCopywriting');
  const footer = document.getElementById('igModalFooter');

  carousel.innerHTML = item.landing.carousel_images.map(img => 
    `<img src="${item.folder}/${img}" alt="Slide">`
  ).join('');

  copywriting.innerText = item.landing.copywriting_ig || item.landing.headline;

  const detailTarget = type === 'book' ? 'detailbuku.html' : 'detailbundling.html';
  footer.innerHTML = `
    <a href="${detailTarget}?folder=${folderName}" class="btn-primary" style="display:block; text-align:center;">
      Informasi Lengkap & Pemesanan
    </a>
  `;

  modal.classList.remove('hidden');
}

function closeIgModal() {
  document.getElementById('igModal').classList.add('hidden');
}

// DETAIL PAGES LOGIC
async function initDetailBukuPage() {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folder');
  if (!folderName) return;

  try {
    const meta = await fetch(`books/${folderName}/metabuku.json`).then(r => r.json());
    const landing = await fetch(`books/${folderName}/landingpage.json`).then(r => r.json());
    const mdText = await fetch(`books/${folderName}/deskripsibuku.md`).then(r => r.text());

    document.getElementById('detailLoading').classList.add('hidden');
    document.getElementById('bookView').classList.remove('hidden');
    document.getElementById('bookExtra').classList.remove('hidden');

    document.getElementById('bookTitle').innerText = meta.judul;
    document.getElementById('bookAuthor').innerText = meta.penulis;
    document.getElementById('isbnCetakText').innerText = meta.isbn_cetak || '-';
    document.getElementById('isbnEbookText').innerText = meta.isbn_ebook || '-';
    document.getElementById('bookCategory').innerText = meta.kategori || 'Umum';

    // Images
    const mainImg = document.getElementById('bookMainImage');
    mainImg.innerHTML = `<img src="books/${folderName}/gambardepan.png" id="currentMainImg">`;

    // Ebook Section
    if (meta.links && meta.links.mayar_ebook) {
      const ebookCard = document.getElementById('ebookOptionCard');
      ebookCard.classList.remove('hidden');
      document.getElementById('priceEbookTag').innerText = `Rp ${meta.harga_ebook.toLocaleString('id-ID')}`;
      document.getElementById('btnMayar').href = meta.links.mayar_ebook;
    }

    // Cetak Section
    if (meta.harga_cetak) {
      const cetakCard = document.getElementById('cetakOptionCard');
      cetakCard.classList.remove('hidden');
      document.getElementById('priceCetakTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

      if (meta.links.shopee) {
        const btn = document.getElementById('btnShopee');
        btn.href = meta.links.shopee; btn.classList.remove('hidden');
      }
      if (meta.links.tokopedia) {
        const btn = document.getElementById('btnTokopedia');
        btn.href = meta.links.tokopedia; btn.classList.remove('hidden');
      }

      const waMsg = encodeURIComponent(`Halo Pena Bisa, saya berminat membeli buku cetak: ${meta.judul}`);
      document.getElementById('btnWaDirect').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      document.getElementById('btnAddToCartBook').onclick = () => {
        addToCart(meta.id || folderName, meta.judul, meta.harga_cetak, `books/${folderName}/gambardepan.png`);
      };
    }

    // Markdown Render
    document.getElementById('bookMarkdown').innerHTML = marked.parse(mdText);

  } catch (err) {
    console.error("Gagal memuat detail buku:", err);
  }
}

async function initDetailBundlingPage() {
  const params = new URLSearchParams(window.location.search);
  const folderName = params.get('folder');
  if (!folderName) return;

  try {
    const meta = await fetch(`bundling/${folderName}/metabuku.json`).then(r => r.json());
    const landing = await fetch(`bundling/${folderName}/landingpage.json`).then(r => r.json());
    const mdText = await fetch(`bundling/${folderName}/deskripsibuku.md`).then(r => r.text());

    document.getElementById('bundlingLoading').classList.add('hidden');
    document.getElementById('bundlingView').classList.remove('hidden');
    document.getElementById('bundlingExtra').classList.remove('hidden');

    document.getElementById('bundlingTitle').innerText = meta.judul;
    document.getElementById('bundlingPriceTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

    document.getElementById('bundlingFeedMain').innerHTML = `<img src="bundling/${folderName}/feed1.png">`;

    // Direct Buttons
    const waMsg = encodeURIComponent(`Halo Pena Bisa, saya berminat beli Paket Bundling: ${meta.judul}`);
    document.getElementById('btnWaBundling').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

    document.getElementById('btnAddToCartBundling').onclick = () => {
      addToCart(meta.id || folderName, meta.judul, meta.harga_cetak, `bundling/${folderName}/feed1.png`);
    };

    document.getElementById('bundlingMarkdown').innerHTML = marked.parse(mdText);

  } catch (err) {
    console.error("Gagal memuat detail bundling:", err);
  }
}

// CART ENGINE & LOCAL STORAGE
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
    emptyState.classList.remove('hidden');
    document.getElementById('summaryTotalItems').innerText = '0 produk';
    document.getElementById('summaryTotalPrice').innerText = 'Rp 0';
    return;
  }

  emptyState.classList.add('hidden');
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

// SEARCH & FILTER HELPERS
function populateCategoryFilters() {
  const filterBox = document.getElementById('categoryFilterList');
  if (!filterBox) return;

  const categories = [...new Set(catalogBooks.map(b => b.meta.kategori).filter(Boolean))];
  filterBox.innerHTML = categories.map(cat => `
    <label><input type="checkbox" value="${cat}" onchange="filterCatalog()"> ${cat}</label>
  `).join('');
}

function filterCatalog() {
  const search = document.getElementById('katalogSearch')?.value.toLowerCase() || '';
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
