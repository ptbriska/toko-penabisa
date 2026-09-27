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
let currentSlideIndex = 0;
let currentCarouselImages = [];
let currentActiveFolder = '';

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  renderCategorySidebar();
  await loadKatalogData();
  populateYearFilter();
  applyUrlFilters();
});

// 1. Load Header & Footer Shared Components
async function loadSharedComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('../components/header.html'),
      fetch('../components/footer.html')
    ]);

    if (headerRes.ok) document.getElementById('globalHeader').innerHTML = await headerRes.text();
    if (footerRes.ok) document.getElementById('globalFooter').innerHTML = await footerRes.text();

    const activeNav = document.getElementById('nav-katalog');
    if (activeNav) activeNav.classList.add('active');

  } catch (err) {
    console.warn("Komponen shared (header/footer) tidak ditemukan:", err);
  }
}

// 2. Update Badge Keranjang
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) badge.innerText = totalQty;
}

// 3. Global Search Event Handler
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

// 5. Load Master Data Katalog dari index-katalog.json
async function loadKatalogData() {
  const container = document.getElementById('katalogGrid');
  
  const possiblePaths = [
    '../index-katalog.json',
    '/index-katalog.json',
    '../../index-katalog.json',
    './index-katalog.json'
  ];

  let res = null;
  let usedPath = '';

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        res = response;
        usedPath = path;
        break;
      }
    } catch (e) {}
  }

  if (!res) {
    console.error("❌ File index-katalog.json tidak ditemukan di semua opsi path.");
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; color: #9f1239;">
          <h3 style="margin-bottom: 0.5rem;">⚠️ File index-katalog.json Tidak Ditemukan (404)</h3>
          <p style="font-size: 0.9rem;">Pastikan file <code>index-katalog.json</code> berada di folder root utama repositori.</p>
        </div>
      `;
    }
    return;
  }

  try {
    const index = await res.json();
    console.log(`✅ Berhasil memuat index dari path: ${usedPath}`, index);

    catalogBooks = [];
    if (index.books && Array.isArray(index.books)) {
      for (const folder of index.books) {
        try {
          const metaRes = await fetch(`../books/${folder}/metabuku.json`);
          if (!metaRes.ok) continue;
          const meta = await metaRes.json();

          let landing = { carousel_images: ['gambardepan.png'], copywriting_ig: '' };
          try {
            const landingRes = await fetch(`../books/${folder}/landingpage.json`);
            if (landingRes.ok) landing = await landingRes.json();
          } catch (e) {}

          catalogBooks.push({
            folder: `../books/${folder}`,
            folderName: folder,
            meta,
            landing
          });
        } catch (e) {
          console.warn(`Gagal memuat folder buku: ${folder}`, e);
        }
      }
    }

    renderKatalogView(catalogBooks);

  } catch (err) {
    console.error("❌ Gagal parsing isi file JSON:", err);
  }
}

// 6. Populate Option Tahun Terbit
function populateYearFilter() {
  const select = document.getElementById('yearSelectFilter');
  if (!select) return;

  select.innerHTML = '<option value="">Semua Tahun Terbit</option>';

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
          <img src="${item.folder}/gambardepan.png" alt="${item.meta.judul}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x250?text=Sampul+Buku';">
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

  const checkedCategories = Array.from(document.querySelectorAll('#categoryFilterList input:checked')).map(cb => {
    return {
      name: cb.value.toLowerCase(),
      code: (cb.getAttribute('data-code') || '').toLowerCase()
    };
  });

  const filtered = catalogBooks.filter(item => {
    // A. Match Search
    const titleMatch = (item.meta.judul || '').toLowerCase().includes(search);
    const authorMatch = (item.meta.penulis || '').toLowerCase().includes(search);
    const skuMatch = (item.meta.sku || item.meta.id || '').toLowerCase().includes(search);
    const matchSearch = !search || titleMatch || authorMatch || skuMatch;

    // B. Match Format/Sifat
    const hasCetak = Boolean(item.meta.harga_cetak);
    const hasEbook = Boolean(item.meta.links?.mayar_ebook || item.meta.harga_ebook);
    
    let matchFormat = true;
    if (isCetak && !isEbook) matchFormat = hasCetak;
    if (isEbook && !isCetak) matchFormat = hasEbook;
    if (isCetak && isEbook) matchFormat = hasCetak || hasEbook;

    // C. Match Kategori
    const itemCat = (item.meta.kategori || '').toLowerCase();
    const itemCatCode = (item.meta.kode_kategori || '').toLowerCase();

    const matchCategory = checkedCategories.length === 0 || checkedCategories.some(cat => {
      return itemCat.includes(cat.name) || (cat.code && itemCatCode === cat.code);
    });

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
      const code = cb.getAttribute('data-code');
      if (cb.value.toLowerCase().includes(targetCategory.toLowerCase()) || (code && code.toLowerCase() === targetCategory.toLowerCase())) {
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

// 11. IG Pop-Up Modal (Dinamis Gambar & Live Comment Jujur)
function openIgModal(folderName) {
  const item = catalogBooks.find(i => i.folderName === folderName);
  if (!item) return;

  currentActiveFolder = folderName;

  // Render Carousel Gambar (Fleksibel 1-8+ Gambar)
  currentCarouselImages = (item.landing && Array.isArray(item.landing.carousel_images) && item.landing.carousel_images.length > 0)
    ? item.landing.carousel_images
    : ['gambardepan.png'];

  currentSlideIndex = 0;

  const slidesContainer = document.getElementById('carouselSlidesContainer');
  if (slidesContainer) {
    slidesContainer.innerHTML = currentCarouselImages.map((img, idx) => `
      <div class="slide-item ${idx === 0 ? 'active' : ''}">
        <img src="${item.folder}/${img}" alt="Pratinjau ${idx + 1}" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x500?text=Gambar+Tidak+Tersedia';">
      </div>
    `).join('');
  }

  // Render Tombol Panah & Dots Navigasi
  const prevBtn = document.getElementById('prevSlideBtn');
  const nextBtn = document.getElementById('nextSlideBtn');
  const dotsContainer = document.getElementById('carouselDots');

  if (currentCarouselImages.length > 1) {
    if (prevBtn) prevBtn.style.display = 'flex';
    if (nextBtn) nextBtn.style.display = 'flex';
    if (dotsContainer) {
      dotsContainer.style.display = 'flex';
      dotsContainer.innerHTML = currentCarouselImages.map((_, idx) => `
        <span class="dot ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx})"></span>
      `).join('');
    }
  } else {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (dotsContainer) dotsContainer.style.display = 'none';
  }

  // Render Copywriting
  const copywritingBox = document.getElementById('igCopywriting');
  if (copywritingBox) {
    copywritingBox.innerText = item.landing.copywriting_ig || item.landing.headline || 'Dapatkan buku resmi terbitan Penerbit Pena Bisa.';
  }

  // Render Live Comments (Transparan & Murni)
  renderLiveComments(folderName);

  // Render Button Action Pemesanan
  const footerBox = document.getElementById('igModalFooter');
  if (footerBox) {
    footerBox.innerHTML = `
      <a href="../detailbuku/index.html?folder=${folderName}" class="btn-card-action" style="background:var(--brand-orange); color:#ffffff; display:block; text-align:center; padding:0.85rem; border-radius:30px; text-decoration:none;">
        Informasi Lengkap & Pemesanan ➔
      </a>
    `;
  }

  const modal = document.getElementById('igModal');
  if (modal) modal.classList.remove('hidden');
}

// Navigasi Slider Carousel
function changeSlide(direction) {
  if (currentCarouselImages.length <= 1) return;
  currentSlideIndex += direction;
  
  if (currentSlideIndex >= currentCarouselImages.length) {
    currentSlideIndex = 0;
  } else if (currentSlideIndex < 0) {
    currentSlideIndex = currentCarouselImages.length - 1;
  }

  updateCarouselUI();
}

function goToSlide(index) {
  currentSlideIndex = index;
  updateCarouselUI();
}

function updateCarouselUI() {
  const slides = document.querySelectorAll('.slide-item');
  const dots = document.querySelectorAll('.dot');

  slides.forEach((slide, idx) => {
    if (idx === currentSlideIndex) slide.classList.add('active');
    else slide.classList.remove('active');
  });

  dots.forEach((dot, idx) => {
    if (idx === currentSlideIndex) dot.classList.add('active');
    else dot.classList.remove('active');
  });
}

function closeIgModal() {
  const modal = document.getElementById('igModal');
  if (modal) modal.classList.add('hidden');
}

function handleOverlayClick(event) {
  if (event.target.id === 'igModal') {
    closeIgModal();
  }
}

// 12. Render Live Comments (Hanya Menampilkan Komentar Asli Pengunjung)
function renderLiveComments(folderName) {
  const container = document.getElementById('igCommentsList');
  const countSpan = document.getElementById('commentCount');
  if (!container) return;

  const userCommentsKey = `penabisa_comments_${folderName}`;
  const realComments = JSON.parse(localStorage.getItem(userCommentsKey)) || [];

  if (countSpan) countSpan.innerText = `${realComments.length} ulasan`;

  if (realComments.length === 0) {
    container.innerHTML = `
      <div style="padding: 1rem 0; text-align: center; color: #94a3b8; font-size: 0.83rem;">
        💬 Belum ada ulasan untuk buku ini.<br>
        <span style="font-size: 0.78rem; color: #cbd5e1;">Jadilah yang pertama memberikan ulasan atau pertanyaan!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = realComments.map(c => `
    <div class="comment-item">
      <div class="comment-main">
        <div class="comment-avatar">${c.avatar || '💬'}</div>
        <div class="comment-content">
          <strong>${c.username || 'Pengunjung'}</strong>
          <p>${c.text}</p>
          <span class="comment-meta">${c.time}</span>
        </div>
      </div>
      <button type="button" class="comment-like-btn" onclick="toggleCommentLike(this)">🤍</button>
    </div>
  `).join('');
}

// Input Komentar Baru oleh Pengunjung
function submitNewComment(event) {
  event.preventDefault();
  const input = document.getElementById('commentUserInput');
  if (!input || !input.value.trim() || !currentActiveFolder) return;

  const newComment = {
    username: "Pengunjung",
    avatar: "💬",
    text: input.value.trim(),
    time: "Baru saja"
  };

  const userCommentsKey = `penabisa_comments_${currentActiveFolder}`;
  const existingUserComments = JSON.parse(localStorage.getItem(userCommentsKey)) || [];
  existingUserComments.push(newComment);

  localStorage.setItem(userCommentsKey, JSON.stringify(existingUserComments));

  input.value = '';
  renderLiveComments(currentActiveFolder);

  const scrollBody = document.querySelector('.ig-scrollable-body');
  if (scrollBody) scrollBody.scrollTop = scrollBody.scrollHeight;
}

// Interaksi Like Ulasan & Produk
function toggleCommentLike(btn) {
  if (btn.innerText === '🤍') {
    btn.innerText = '❤️';
    btn.classList.add('liked');
  } else {
    btn.innerText = '🤍';
    btn.classList.remove('liked');
  }
}

function toggleProductLike() {
  const countSpan = document.getElementById('productLikeCount');
  if (!countSpan) return;
  let currentLikes = parseInt(countSpan.innerText) || 0;

  const btn = document.getElementById('btnLikeProduct');
  if (btn.classList.contains('liked')) {
    btn.classList.remove('liked');
    countSpan.innerText = Math.max(0, currentLikes - 1);
  } else {
    btn.classList.add('liked');
    countSpan.innerText = currentLikes + 1;
  }
}
