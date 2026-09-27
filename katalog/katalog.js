/* ==========================================================================
   Katalog Module Logic - Isolated
   ========================================================================== */

const CATEGORY_MAP = [
  { code: "A", name: "Buku Perlombaan" },
  { code: "B", name: "Buku Pra Sekolah" },
  { code: "C", name: "Buku Reguler Sekolah" },
  { code: "D", name: "Buku Persiapan Ujian" },
  { code: "E", name: "Buku Beasiswa" },
  { code: "F", name: "Buku Hobby" },
  { code: "G", name: "Buku Agama" },
  { code: "H", name: "Buku Desain & Multimedia" },
  { code: "I", name: "Buku Kesehatan" },
  { code: "J", name: "Buku Sastra & Bahasa" },
  { code: "K", name: "Buku Sosial & Komunikasi" },
  { code: "L", name: "Buku Teknik" },
  { code: "M", name: "Buku MIPA" },
  { code: "N", name: "Buku Ekonomi Bisnis" },
  { code: "O", name: "Buku Ilmu Bumi" },
  { code: "P", name: "Buku Informasi Teknologi & AI" },
  { code: "Q", name: "Buku Lingkungan" },
  { code: "R", name: "Buku Riset" },
  { code: "S", name: "Buku Pendidikan & Keguruan" },
  { code: "T", name: "Buku Hukum & Politik" },
  { code: "U", name: "Buku Pengembangan Diri" },
  { code: "V", name: "Buku Lainnya" }
];

let catalogBooks = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  renderCategorySidebar();
  await loadKatalogData();
  populateYearFilter();
  applyUrlFilters();
});

// 1. Load Header & Footer
async function loadSharedComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('../components/header.html'),
      fetch('../components/footer.html')
    ]);

    document.getElementById('globalHeader').innerHTML = await headerRes.text();
    document.getElementById('globalFooter').innerHTML = await footerRes.text();

    const activeNav = document.getElementById('nav-katalog');
    if (activeNav) activeNav.classList.add('active');

  } catch (err) {
    console.error("Gagal memuat komponen shared:", err);
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
    filterCatalog();
  }
}

// 4. Render Sidebar Filter Kategori A-V
function renderCategorySidebar() {
  const listContainer = document.getElementById('categoryFilterList');
  if (!listContainer) return;

  listContainer.innerHTML = CATEGORY_MAP.map(cat => `
    <label>
      <input type="checkbox" value="${cat.name}" data-code="${cat.code}" onchange="filterCatalog()">
      <strong>[${cat.code}]</strong>&nbsp;${cat.name}
    </label>
  `).join('');
}

// 5. Load Master Data Katalog dari ../index-katalog.json
async function loadKatalogData() {
  try {
    const res = await fetch('../index-katalog.json');
    const index = await res.json();

    catalogBooks = [];
    for (const folder of index.books) {
      try {
        const meta = await fetch(`../books/${folder}/metabuku.json`).then(r => r.json());
        const landing = await fetch(`../books/${folder}/landingpage.json`).then(r => r.json());
        catalogBooks.push({ folder: `../books/${folder}`, folderName: folder, meta, landing });
      } catch (e) {
        console.warn(`Folder buku "${folder}" gagal dimuat.`, e);
      }
    }

    renderKatalogView(catalogBooks);

  } catch (err) {
    console.error("Gagal memuat index-katalog.json:", err);
  }
}

// 6. Populate Option Tahun Terbit
function populateYearFilter() {
  const select = document.getElementById('yearSelectFilter');
  if (!select) return;

  const years = [...new Set(catalogBooks.map(b => b.meta.tahun_terbit || b.meta.tahun).filter(Boolean))].sort((a, b) => b - a);

  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.innerText = `Tahun ${y}`;
    select.appendChild(opt);
  });
}

// 7. Render Product Cards Grid
function renderKatalogView(items) {
  const container = document.getElementById('katalogGrid');
  const countSpan = document.getElementById('productCount');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
        <p style="font-size: 1.1rem; font-weight: 700;">Buku tidak ditemukan</p>
        <p style="font-size: 0.9rem;">Coba sesuaikan kata kunci pencarian atau reset filter di sebelah kiri.</p>
      </div>
    `;
  } else {
    container.innerHTML = items.map(item => {
      const priceCetak = item.meta.harga_cetak;
      const priceEbook = item.meta.harga_ebook;

      let displayPrice = 'Harga tidak tersedia';
      if (priceCetak) {
        displayPrice = `Rp ${priceCetak.toLocaleString('id-ID')}`;
      } else if (priceEbook) {
        displayPrice = `E-Book: Rp ${priceEbook.toLocaleString('id-ID')}`;
      }

      return `
        <div class="book-card-light">
          <img src="${item.folder}/gambardepan.png" alt="${item.meta.judul}" loading="lazy">
          <div>
            <h4>${item.meta.judul}</h4>
            <p class="author-text">${item.meta.penulis || 'Penulis Pena Bisa'}</p>
            <div class="price-light">${displayPrice}</div>
          </div>
          <button type="button" class="btn-card-action" onclick="openIgModal('${item.folderName}')">Cek Info Buku</button>
        </div>
      `;
    }).join('');
  }

  if (countSpan) countSpan.innerText = `Menampilkan ${items.length} produk`;
}

// 8. Dynamic Filter Processing
function filterCatalog() {
  const searchInput = document.getElementById('globalSearchInput');
  const search = searchInput?.value.toLowerCase().trim() || '';

  const isCetak = document.getElementById('filterCetak')?.checked;
  const isEbook = document.getElementById('filterEbook')?.checked;

  const minPrice = parseFloat(document.getElementById('minPriceInput')?.value) || 0;
  const maxPrice = parseFloat(document.getElementById('maxPriceInput')?.value) || Infinity;

  const selectedYear = document.getElementById('yearSelectFilter')?.value;

  const checkedCategories = Array.from(document.querySelectorAll('#categoryFilterList input:checked')).map(cb => cb.value.toLowerCase());

  const filtered = catalogBooks.filter(item => {
    // A. Match Search
    const titleMatch = (item.meta.judul || '').toLowerCase().includes(search);
    const authorMatch = (item.meta.penulis || '').toLowerCase().includes(search);
    const matchSearch = !search || titleMatch || authorMatch;

    // B. Match Format/Sifat
    const hasCetak = Boolean(item.meta.harga_cetak);
    const hasEbook = Boolean(item.meta.links?.mayar_ebook || item.meta.harga_ebook);
    
    let matchFormat = true;
    if (isCetak && !isEbook) matchFormat = hasCetak;
    if (isEbook && !isCetak) matchFormat = hasEbook;
    if (isCetak && isEbook) matchFormat = hasCetak || hasEbook;

    // C. Match Kategori
    const itemCat = (item.meta.kategori || '').toLowerCase();
    const matchCategory = checkedCategories.length === 0 || checkedCategories.some(cat => itemCat.includes(cat));

    // D. Match Rentang Harga
    const effectivePrice = item.meta.harga_cetak || item.meta.harga_ebook || 0;
    const matchPrice = effectivePrice >= minPrice && effectivePrice <= maxPrice;

    // E. Match Tahun
    const itemYear = String(item.meta.tahun_terbit || item.meta.tahun || '');
    const matchYear = !selectedYear || itemYear === selectedYear;

    return matchSearch && matchFormat && matchCategory && matchPrice && matchYear;
  });

  renderKatalogView(filtered);
}

// 9. Reset Filter Button
function resetAllFilters() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('#categoryFilterList input').forEach(cb => cb.checked = false);
  if (document.getElementById('filterCetak')) document.getElementById('filterCetak').checked = false;
  if (document.getElementById('filterEbook')) document.getElementById('filterEbook').checked = false;

  if (document.getElementById('minPriceInput')) document.getElementById('minPriceInput').value = '';
  if (document.getElementById('maxPriceInput')) document.getElementById('maxPriceInput').value = '';

  if (document.getElementById('yearSelectFilter')) document.getElementById('yearSelectFilter').value = '';

  filterCatalog();
}

// 10. URL Query Params Handler
function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const targetCategory = params.get('kategori');
  const targetSearch = params.get('search');
  const targetFormat = params.get('format');

  if (targetSearch) {
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = targetSearch;
  }

  if (targetCategory) {
    const checkboxes = document.querySelectorAll('#categoryFilterList input');
    checkboxes.forEach(cb => {
      if (cb.value.toLowerCase().includes(targetCategory.toLowerCase())) {
        cb.checked = true;
      }
    });
  }

  if (targetFormat === 'cetak' && document.getElementById('filterCetak')) {
    document.getElementById('filterCetak').checked = true;
  }
  if (targetFormat === 'ebook' && document.getElementById('filterEbook')) {
    document.getElementById('filterEbook').checked = true;
  }

  filterCatalog();
}

// 11. IG Pop-Up Modal
function openIgModal(folderName) {
  const item = catalogBooks.find(i => i.folderName === folderName);
  if (!item) return;

  const carousel = document.getElementById('igCarousel');
  const copywriting = document.getElementById('igCopywriting');
  const footer = document.getElementById('igModalFooter');

  carousel.innerHTML = (item.landing.carousel_images || ['gambardepan.png']).map(img => 
    `<img src="${item.folder}/${img}" alt="Slide">`
  ).join('');

  copywriting.innerText = item.landing.copywriting_ig || item.landing.headline || 'Dapatkan buku resmi terbitan Penerbit Pena Bisa.';

  footer.innerHTML = `
    <a href="../detailbuku/index.html?folder=${folderName}" class="btn-card-action" style="background:var(--brand-orange); color:#ffffff; display:block; text-align:center; padding:0.85rem; border-radius:30px;">
      Informasi Lengkap & Pemesanan ➔
    </a>
  `;

  document.getElementById('igModal').classList.remove('hidden');
}

function closeIgModal() {
  document.getElementById('igModal').classList.add('hidden');
}
