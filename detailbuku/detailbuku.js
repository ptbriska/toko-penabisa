/* ==========================================================================
   Detail Buku Module Logic - Isolated
   ========================================================================== */

const WA_NUMBER = "6282268118842";
let currentFolder = null;
let currentBookMeta = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  updateCartBadge();
  await initBookDetailPage();
});

// 1. Memuat Header dan Footer Shared
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
    const keyword = event.target.value.trim();
    if (keyword) {
      window.location.href = `../katalog/index.html?search=${encodeURIComponent(keyword)}`;
    }
  }
}

// 4. Inisialisasi Data Detail Buku
async function initBookDetailPage() {
  const params = new URLSearchParams(window.location.search);
  currentFolder = params.get('folder');

  if (!currentFolder) {
    document.getElementById('detailLoading').innerHTML = '<p>Error: Folder buku tidak ditentukan.</p>';
    return;
  }

  const bookPath = `../books/${currentFolder}`;

  try {
    const [meta, landing, mdText] = await Promise.all([
      fetch(`${bookPath}/metabuku.json`).then(r => r.json()),
      fetch(`${bookPath}/landingpage.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${bookPath}/deskripsibuku.md`).then(r => r.text()).catch(() => "Deskripsi belum tersedia.")
    ]);

    currentBookMeta = meta;

    // A. Populate Basic Info & Breadcrumb
    document.title = `${meta.judul} - Toko Penerbit Pena Bisa`;
    document.getElementById('breadcrumbTitle').innerText = meta.judul;
    document.getElementById('bookTitle').innerText = meta.judul;
    document.getElementById('bookCategoryBadge').innerText = meta.kategori || 'Buku Reguler';

    // B. Metadata Identitas Buku Lengkap
    document.getElementById('metaPenulisVal').innerText = meta.penulis || 'Tim Penulis Pena Bisa';
    document.getElementById('metaPenerbitVal').innerText = meta.penerbit || 'Penerbit Pena Bisa';
    document.getElementById('metaTebalVal').innerText = meta.tebal ? `${meta.tebal} Hlm` : '-';
    document.getElementById('metaBeratVal').innerText = meta.berat ? `${meta.berat} gram` : '-';
    document.getElementById('metaCetakanVal').innerText = meta.cetakan || 'HVS, Full Color / BW';
    document.getElementById('metaUkuranVal').innerText = meta.ukuran || '19 x 26 cm';
    document.getElementById('metaTerbitVal').innerText = meta.terbit || meta.tahun_terbit || meta.tahun || '-';
    document.getElementById('metaSkuVal').innerText = meta.sku || meta.id || currentFolder;
    document.getElementById('isbnCetakVal').innerText = meta.isbn_cetak || '-';
    document.getElementById('isbnEbookVal').innerText = meta.isbn_ebook || '-';
    document.getElementById('metaInfoLainVal').innerText = meta.informasi_lainnya || meta.catatan || '-';

    // C. Setup Image Gallery
    const images = landing.carousel_images && landing.carousel_images.length > 0 
      ? landing.carousel_images 
      : ['gambardepan.png'];

    setupGallery(bookPath, images);

    // D. Setup E-Book Option (Mayar Direct)
    if (meta.links && meta.links.mayar_ebook) {
      const ebookBox = document.getElementById('optionEbookBox');
      ebookBox.classList.remove('hidden');
      document.getElementById('priceEbookTag').innerText = meta.harga_ebook ? `Rp ${meta.harga_ebook.toLocaleString('id-ID')}` : 'Akses Mayar';
      document.getElementById('btnMayarEbook').href = meta.links.mayar_ebook;
    }

    // E. Setup Cetak Option (Marketplace, WA, & Cart)
    if (meta.harga_cetak) {
      const cetakBox = document.getElementById('optionCetakBox');
      cetakBox.classList.remove('hidden');
      document.getElementById('priceCetakTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

      if (meta.links && meta.links.shopee) {
        const btnShopee = document.getElementById('btnShopee');
        btnShopee.href = meta.links.shopee;
        btnShopee.classList.remove('hidden');
      }

      if (meta.links && meta.links.tokopedia) {
        const btnTokped = document.getElementById('btnTokopedia');
        btnTokped.href = meta.links.tokopedia;
        btnTokped.classList.remove('hidden');
      }

      const waMsg = encodeURIComponent(`Halo Admin Pena Bisa, saya mau pesan Buku Cetak:\n*Judul:* ${meta.judul}\n*SKU:* ${meta.sku || currentFolder}\n*Harga:* Rp ${meta.harga_cetak.toLocaleString('id-ID')}`);
      document.getElementById('btnWaDirect').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      document.getElementById('btnAddToCart').onclick = () => {
        addToCart(meta.id || meta.sku || currentFolder, meta.judul, meta.harga_cetak, `${bookPath}/${images[0]}`);
      };
    }

    // F. Parse & Render Markdown
    if (typeof marked !== 'undefined') {
      document.getElementById('bookMarkdownContent').innerHTML = marked.parse(mdText);
    } else {
      document.getElementById('bookMarkdownContent').innerText = mdText;
    }

    // G. Switch Visibility
    document.getElementById('detailLoading').classList.add('hidden');
    document.getElementById('bookWrapper').classList.remove('hidden');
    document.getElementById('bookExtraSection').classList.remove('hidden');

    // H. Render User Reviews
    renderRealReviews();

  } catch (err) {
    console.error("Gagal memuat detail buku:", err);
    document.getElementById('detailLoading').innerHTML = '<p style="color:#ef4444;">Gagal memuat data metadata buku.</p>';
  }
}

// 5. Setup Image Gallery
function setupGallery(basePath, images) {
  const mainBox = document.getElementById('mainImageBox');
  const thumbList = document.getElementById('thumbnailList');

  mainBox.innerHTML = `<img id="mainImageDisplay" src="${basePath}/${images[0]}" alt="Sampul Utama" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x500?text=Sampul+Buku';">`;

  if (images.length > 1) {
    thumbList.innerHTML = images.map((img, idx) => `
      <img src="${basePath}/${img}" class="${idx === 0 ? 'active' : ''}" onclick="switchGalleryImg('${basePath}/${img}', this)" alt="Pratinjau ${idx + 1}" onerror="this.onerror=null; this.src='https://via.placeholder.com/80x100?text=Pratinjau';">
    `).join('');
  } else {
    thumbList.innerHTML = '';
  }
}

function switchGalleryImg(fullPath, element) {
  document.getElementById('mainImageDisplay').src = fullPath;
  document.querySelectorAll('#thumbnailList img').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
}

// 6. Sistem Keranjang (LocalStorage)
function addToCart(id, judul, harga, cover) {
  let cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, judul, harga, cover, qty: 1 });
  }

  localStorage.setItem('penabisa_cart', JSON.stringify(cart));
  updateCartBadge();
  alert(`✅ "${judul}" berhasil ditambahkan ke keranjang belanja.`);
}

// 7. Review & Rating Handler (Transparan & Asli)
function renderRealReviews() {
  const container = document.getElementById('reviewsList');
  if (!container || !currentFolder) return;

  const storageKey = `penabisa_reviews_${currentFolder}`;
  const reviews = JSON.parse(localStorage.getItem(storageKey)) || [];

  if (reviews.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.88rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        💬 Belum ada ulasan untuk buku ini.<br>
        <span style="font-size: 0.8rem; color: #cbd5e1;">Jadilah yang pertama memberikan ulasan atau kesan membaca Anda!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="review-item-header">
        <strong>${r.name}</strong>
        <span>${r.rating}</span>
      </div>
      <p>${r.comment}</p>
    </div>
  `).join('');
}

function submitReview() {
  const name = document.getElementById('reviewName').value.trim();
  const comment = document.getElementById('reviewComment').value.trim();
  const ratingVal = document.getElementById('reviewRating').value;

  if (!name || !comment) {
    alert("Mohon isi nama dan pesan ulasan Anda.");
    return;
  }

  if (!currentFolder) return;

  const stars = "⭐".repeat(parseInt(ratingVal));
  const newReview = { name, comment, rating: stars };

  const storageKey = `penabisa_reviews_${currentFolder}`;
  const existingReviews = JSON.parse(localStorage.getItem(storageKey)) || [];
  existingReviews.unshift(newReview);

  localStorage.setItem(storageKey, JSON.stringify(existingReviews));

  document.getElementById('reviewName').value = '';
  document.getElementById('reviewComment').value = '';

  renderRealReviews();
  alert("Terima kasih! Ulasan Anda telah berhasil dikirim.");
}
