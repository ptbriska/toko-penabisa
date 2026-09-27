/* ==========================================================================
   Bundling Module Logic - Isolated (IG Modal Preview + WMS Rekap)
   ========================================================================== */

let masterIndexData = null;
let bundlingList = [];
let booksDatabase = {}; // Map WMS SKU ke Metadata Buku
let activeTags = new Set();

let currentSlideIndex = 0;
let currentCarouselImages = [];
let currentActiveSku = '';

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  await loadMasterAndBundlingData();
});

// 1. Load Shared Header & Footer
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

// 3. Memuat Master Index, Metadata Seluruh Buku & Bundling
async function loadMasterAndBundlingData() {
  const container = document.getElementById('bundlingGrid');
  
  try {
    const res = await fetch('../index-katalog.json');
    if (!res.ok) throw new Error("File index-katalog.json tidak ditemukan.");
    
    masterIndexData = await res.json();

    // A. Pre-fetch seluruh metadata buku tunggal untuk WMS Mapping
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

    // B. Ambil Daftar Bundling dari index-katalog.json
    bundlingList = masterIndexData.bundling || [];

    // C. Pre-load landingpage.json untuk tiap folder bundling (jika ada)
    for (const bundle of bundlingList) {
      try {
        const lRes = await fetch(`../bundling/${bundle.folder}/landingpage.json`);
        if (lRes.ok) bundle.landing = await lRes.json();
      } catch (e) {
        bundle.landing = { carousel_images: ['Poster.png'], copywriting_ig: '' };
      }
    }

    // D. Render Sidebar Tags & Grid
    renderTagSidebar();
    renderBundlingGrid(bundlingList);

  } catch (err) {
    console.error("Gagal memuat data bundling:", err);
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: #fff1f2; color: #9f1239; border-radius: 12px;">
          <h3>⚠️ Gagal Memuat Katalog Bundling</h3>
          <p>Pastikan file <code>index-katalog.json</code> sudah menyertakan array <code>bundling</code>.</p>
        </div>
      `;
    }
  }
}

// 4. Render Sidebar Tag Topik Dynamic
function renderTagSidebar() {
  const container = document.getElementById('tagFilterList');
  if (!container) return;

  const allTags = new Set();
  bundlingList.forEach(b => {
    if (Array.isArray(b.tags)) {
      b.tags.forEach(t => allTags.add(t));
    }
  });

  if (allTags.size === 0) {
    container.innerHTML = `<small style="color:var(--text-muted);">Tidak ada tag tersedia</small>`;
    return;
  }

  container.innerHTML = Array.from(allTags).map(tag => `
    <label>
      <input type="checkbox" value="${tag}" onchange="toggleTagFilter('${tag}')">
      🏷️ ${tag}
    </label>
  `).join('');
}

function toggleTagFilter(tag) {
  if (activeTags.has(tag)) activeTags.delete(tag);
  else activeTags.add(tag);
  filterBundling();
}

// 5. Render Grid Card Bundling Ala IG Feed
function renderBundlingGrid(items) {
  const container = document.getElementById('bundlingGrid');
  const countBadge = document.getElementById('bundlingCountBadge');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
        <p style="font-size: 1.1rem; font-weight: 700;">Paket Bundling Tidak Ditemukan</p>
        <p style="font-size: 0.9rem;">Coba sesuaikan filter tag atau rentang harga di sebelah kiri.</p>
      </div>
    `;
    if (countBadge) countBadge.innerText = 'Menampilkan 0 paket';
    return;
  }

  container.innerHTML = items.map(b => {
    const posterPath = `../bundling/${b.folder}/Poster.png`;
    const tagPills = (b.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join('');
    const priceDisplay = b.harga_bundling ? `Rp ${b.harga_bundling.toLocaleString('id-ID')}` : 'Lihat Detail';

    return `
      <div class="bundling-card">
        <div class="bundling-poster-wrap">
          <img src="${posterPath}" alt="${b.judul_bundling}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x400?text=Poster+Bundling';">
          <span class="bundling-type-tag">${b.jenis === 'Ebook' ? '📱 E-Book' : '📚 Buku Cetak'}</span>
        </div>
        <div class="bundling-info-body">
          <h4>${b.judul_bundling}</h4>
          <div class="tag-pills">${tagPills}</div>
          <div class="bundling-price">${priceDisplay}</div>
          <button type="button" class="btn-check-bundling" onclick="openIgModalBundling('${b.sku}')">
            Cek Info Bundling ➔
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (countBadge) countBadge.innerText = `Menampilkan ${items.length} paket`;
}

// 6. Filter Logic
function filterBundling() {
  const isCetak = document.getElementById('filterCetakBundling')?.checked;
  const isEbook = document.getElementById('filterEbookBundling')?.checked;

  const minPrice = parseFloat(document.getElementById('minPriceBundling')?.value) || 0;
  const maxPrice = parseFloat(document.getElementById('maxPriceBundling')?.value) || Infinity;

  const filtered = bundlingList.filter(b => {
    let matchFormat = true;
    if (isCetak && !isEbook) matchFormat = (b.jenis === 'Cetak');
    if (isEbook && !isCetak) matchFormat = (b.jenis === 'Ebook');

    let matchTag = true;
    if (activeTags.size > 0) {
      matchTag = (b.tags || []).some(t => activeTags.has(t));
    }

    const price = b.harga_bundling || 0;
    const matchPrice = price >= minPrice && price <= maxPrice;

    return matchFormat && matchTag && matchPrice;
  });

  renderBundlingGrid(filtered);
}

function resetBundlingFilters() {
  document.querySelectorAll('#tagFilterList input').forEach(cb => cb.checked = false);
  activeTags.clear();

  if (document.getElementById('filterCetakBundling')) document.getElementById('filterCetakBundling').checked = false;
  if (document.getElementById('filterEbookBundling')) document.getElementById('filterEbookBundling').checked = false;

  if (document.getElementById('minPriceBundling')) document.getElementById('minPriceBundling').value = '';
  if (document.getElementById('maxPriceBundling')) document.getElementById('maxPriceBundling').value = '';

  filterBundling();
}

// 7. Pop-Up Modal IG Style Murni (Previews Feed + Live Comments + Direct to Detail Only)
function openIgModalBundling(sku) {
  const bundle = bundlingList.find(b => b.sku === sku);
  if (!bundle) return;

  currentActiveSku = sku;
  const folderPath = `../bundling/${bundle.folder}`;

  // Carousel Gambar (diambil dari landingpage.json atau default Poster.png)
  currentCarouselImages = (bundle.landing && Array.isArray(bundle.landing.carousel_images) && bundle.landing.carousel_images.length > 0)
    ? bundle.landing.carousel_images
    : ['Poster.png'];

  currentSlideIndex = 0;

  const slidesContainer = document.getElementById('carouselSlidesContainer');
  if (slidesContainer) {
    slidesContainer.innerHTML = currentCarouselImages.map((img, idx) => `
      <div class="slide-item ${idx === 0 ? 'active' : ''}">
        <img src="${folderPath}/${img}" alt="Slide ${idx + 1}" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x500?text=Poster';">
      </div>
    `).join('');
  }

  // Navigasi Slider Panah & Dots
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

  // Header & Info
  document.getElementById('modalBundlingTitle').innerText = bundle.judul_bundling;
  document.getElementById('modalBundlingSku').innerText = `SKU: ${bundle.sku}`;
  document.getElementById('modalBundlingTags').innerHTML = (bundle.tags || []).map(t => `<span class="tag-pill">#${t}</span>`).join(' ');
  document.getElementById('modalBundlingPrice').innerText = bundle.harga_bundling ? `Rp ${bundle.harga_bundling.toLocaleString('id-ID')}` : 'Hubungi CS';

  // AUTOMATIC REKAP ITEM WMS BUKU
  const itemsContainer = document.getElementById('modalItemsList');
  if (Array.isArray(bundle.items_sku) && bundle.items_sku.length > 0) {
    itemsContainer.innerHTML = bundle.items_sku.map(itemSku => {
      const bookData = booksDatabase[itemSku];
      if (bookData) {
        return `
          <div class="wms-item-row">
            <img src="../books/${bookData.folder}/gambardepan.png" alt="Cover" onerror="this.onerror=null; this.src='https://via.placeholder.com/30x40?text=Buku';">
            <div class="wms-item-info">
              <strong>${bookData.meta.judul}</strong>
              <small>SKU: ${itemSku} | ${bookData.meta.penulis || 'Pena Bisa'}</small>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="wms-item-row">
            <div class="wms-item-info">
              <strong>Buku SKU: ${itemSku}</strong>
              <small>Terdaftar dalam paket</small>
            </div>
          </div>
        `;
      }
    }).join('');
  } else {
    itemsContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted);">Daftar buku penyusun tidak tertera.</p>`;
  }

  // Copywriting dari landingpage.json
  const copywritingBox = document.getElementById('igCopywriting');
  if (copywritingBox) {
    copywritingBox.innerText = (bundle.landing && bundle.landing.copywriting_ig) 
      ? bundle.landing.copywriting_ig 
      : `Dapatkan promo hemat ${bundle.judul_bundling} resmi dari Penerbit Pena Bisa.`;
  }

  // Live Comments
  renderLiveComments(sku);

  // FOOTER DIRECT LINK KE PAGE DETAIL BUNDLING FORMAL (TANPA TOMBOL CHECKOUT/WA/CART DI MODAL)
  const footerBox = document.getElementById('modalBundlingFooter');
  if (footerBox) {
    footerBox.innerHTML = `
      <a href="../detailbundling/index.html?sku=${bundle.sku}" class="btn-direct-detail">
        Informasi Lengkap & Pemesanan ➔
      </a>
    `;
  }

  document.getElementById('igModalBundling').classList.remove('hidden');
}

// Slider Control
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

function closeIgModalBundling() {
  document.getElementById('igModalBundling').classList.add('hidden');
}

function handleOverlayClick(e) {
  if (e.target.id === 'igModalBundling') {
    closeIgModalBundling();
  }
}

// Render Live Comments (Hanya Komentar Asli Pengunjung)
function renderLiveComments(sku) {
  const container = document.getElementById('igCommentsList');
  const countSpan = document.getElementById('commentCount');
  if (!container) return;

  const storageKey = `penabisa_comments_bundling_${sku}`;
  const realComments = JSON.parse(localStorage.getItem(storageKey)) || [];

  if (countSpan) countSpan.innerText = `${realComments.length} ulasan`;

  if (realComments.length === 0) {
    container.innerHTML = `
      <div style="padding: 0.8rem 0; text-align: center; color: #94a3b8; font-size: 0.82rem;">
        💬 Belum ada ulasan untuk paket ini.<br>
        <span style="font-size: 0.75rem; color: #cbd5e1;">Jadilah yang pertama memberikan ulasan!</span>
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
    </div>
  `).join('');
}

// Input Komentar Baru oleh Pengunjung
function submitNewComment(event) {
  event.preventDefault();
  const input = document.getElementById('commentUserInput');
  if (!input || !input.value.trim() || !currentActiveSku) return;

  const newComment = {
    username: "Pengunjung",
    avatar: "💬",
    text: input.value.trim(),
    time: "Baru saja"
  };

  const storageKey = `penabisa_comments_bundling_${currentActiveSku}`;
  const existingComments = JSON.parse(localStorage.getItem(storageKey)) || [];
  existingComments.push(newComment);

  localStorage.setItem(storageKey, JSON.stringify(existingComments));

  input.value = '';
  renderLiveComments(currentActiveSku);

  const scrollBody = document.querySelector('.ig-scrollable-body');
  if (scrollBody) scrollBody.scrollTop = scrollBody.scrollHeight;
}

// Interaksi Like Produk
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
