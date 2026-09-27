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
    document.getElementById('bookAuthor').innerText = meta.penulis || 'Pena Bisa';
    document.getElementById('bookCategoryBadge').innerText = meta.kategori || 'Umum';

    // B. Hybrid ISBN & Metadata
    document.getElementById('isbnCetakVal').innerText = meta.isbn_cetak || 'Tidak Tersedia';
    document.getElementById('isbnEbookVal').innerText = meta.isbn_ebook || 'Tidak Tersedia';
    document.getElementById('tahunTerbitVal').innerText = meta.tahun_terbit || meta.tahun || '-';

    // C. Setup Image Gallery
    const images = landing.carousel_images && landing.carousel_images.length > 0 
      ? landing.carousel_images 
      : ['gambardepan.png', 'gambarbelakang.png'];

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

      const waMsg = encodeURIComponent(`Halo Admin Pena Bisa, saya mau pesan Buku Cetak: "${meta.judul}"`);
      document.getElementById('btnWaDirect').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      document.getElementById('btnAddToCart').onclick = () => {
        addToCart(meta.id || currentFolder, meta.judul, meta.harga_cetak, `${bookPath}/gambardepan.png`);
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

    // H. Render Initial Dummy Reviews
    renderDummyReviews();

  } catch (err) {
    console.error("Gagal memuat detail buku:", err);
    document.getElementById('detailLoading').innerHTML = '<p>Gagal memuat data metadata buku.</p>';
  }
}

// 5. Setup Image Gallery
function setupGallery(basePath, images) {
  const mainBox = document.getElementById('mainImageBox');
  const thumbList = document.getElementById('thumbnailList');

  mainBox.innerHTML = `<img id="mainImageDisplay" src="${basePath}/${images[0]}" alt="Sampul Utama">`;

  thumbList.innerHTML = images.map((img, idx) => `
    <img src="${basePath}/${img}" class="${idx === 0 ? 'active' : ''}" onclick="switchGalleryImg('${basePath}/${img}', this)" alt="Pratinjau ${idx + 1}">
  `).join('');
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
  alert(`"${judul}" berhasil ditambahkan ke keranjang belanja.`);
}

// 7. Review & Rating Handler
function renderDummyReviews() {
  const container = document.getElementById('reviewsList');
  if (!container) return;

  const sampleReviews = [
    { name: "Dr. Hendra S.", rating: "⭐⭐⭐⭐⭐", comment: "Buku terbitan yang sangat berkualitas. Penjelasan sistematis dan referensi lengkap." },
    { name: "Anisa P.", rating: "⭐⭐⭐⭐⭐", comment: "Cetakan rapi, pengiriman dari admin WA cepat dan ramah!" }
  ];

  container.innerHTML = sampleReviews.map(r => `
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

  const container = document.getElementById('reviewsList');
  const stars = "⭐".repeat(parseInt(ratingVal));

  const newReviewHTML = `
    <div class="review-item" style="border-color: var(--brand-orange); background: #fff7ed;">
      <div class="review-item-header">
        <strong>${name}</strong>
        <span>${stars}</span>
      </div>
      <p>${comment}</p>
    </div>
  `;

  container.insertAdjacentHTML('afterbegin', newReviewHTML);
  document.getElementById('reviewName').value = '';
  document.getElementById('reviewComment').value = '';
  alert("Ulasan Anda berhasil dikirim!");
}
