/* ==========================================================================
   Detail Buku Module Logic - Hybrid Lookup (Folder & SKU Support)
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

// 4. Inisialisasi Data Detail Buku (Dukungan Hybrid Folder & SKU)
async function initBookDetailPage() {
  const params = new URLSearchParams(window.location.search);
  let paramValue = params.get('folder') || params.get('sku');

  if (!paramValue) {
    document.getElementById('detailLoading').innerHTML = '<p style="color:#ef4444; padding:2rem; text-align:center;">⚠️ Error: Parameter buku tidak ditemukan di URL.</p>';
    return;
  }

  // A. FITUR RECOVERY: Resolve Folder Name jika paramValue berupa SKU
  currentFolder = await resolveFolderName(paramValue);

  const bookPath = `../books/${currentFolder}`;

  try {
    // B. Fetch Data Metadata & Markdown
    const [meta, landing, mdText] = await Promise.all([
      fetch(`${bookPath}/metabuku.json`).then(r => {
        if (!r.ok) throw new Error("metabuku.json tidak ditemukan");
        return r.json();
      }),
      fetch(`${bookPath}/landingpage.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${bookPath}/deskripsibuku.md`).then(r => r.text()).catch(() => "Deskripsi buku belum tersedia.")
    ]);

    currentBookMeta = meta;

    // C. Populate Basic Info & Breadcrumb
    document.title = `${meta.judul} - Toko Penerbit Pena Bisa`;
    if (document.getElementById('breadcrumbTitle')) document.getElementById('breadcrumbTitle').innerText = meta.judul;
    if (document.getElementById('bookTitle')) document.getElementById('bookTitle').innerText = meta.judul;
    if (document.getElementById('bookCategoryBadge')) document.getElementById('bookCategoryBadge').innerText = meta.kategori || 'Buku Reguler';

    // D. Metadata Identitas Buku Lengkap
    if (document.getElementById('metaPenulisVal')) document.getElementById('metaPenulisVal').innerText = meta.penulis || 'Tim Penulis Pena Bisa';
    if (document.getElementById('metaPenerbitVal')) document.getElementById('metaPenerbitVal').innerText = meta.penerbit || 'Penerbit Pena Bisa';
    if (document.getElementById('metaTebalVal')) document.getElementById('metaTebalVal').innerText = meta.tebal ? `${meta.tebal} Hlm` : '-';
    if (document.getElementById('metaBeratVal')) document.getElementById('metaBeratVal').innerText = meta.berat ? `${meta.berat} gram` : '-';
    if (document.getElementById('metaCetakanVal')) document.getElementById('metaCetakanVal').innerText = meta.cetakan || 'HVS, Full Color / BW';
    if (document.getElementById('metaUkuranVal')) document.getElementById('metaUkuranVal').innerText = meta.ukuran || '19 x 26 cm';
    if (document.getElementById('metaTerbitVal')) document.getElementById('metaTerbitVal').innerText = meta.terbit || meta.tahun_terbit || meta.tahun || '-';
    if (document.getElementById('metaSkuVal')) document.getElementById('metaSkuVal').innerText = meta.sku || meta.id || currentFolder;
    if (document.getElementById('isbnCetakVal')) document.getElementById('isbnCetakVal').innerText = meta.isbn_cetak || '-';
    if (document.getElementById('isbnEbookVal')) document.getElementById('isbnEbookVal').innerText = meta.isbn_ebook || '-';
    if (document.getElementById('metaInfoLainVal')) document.getElementById('metaInfoLainVal').innerText = meta.informasi_lainnya || meta.catatan || '-';

    // E. Setup Image Gallery
    const images = landing.carousel_images && landing.carousel_images.length > 0 
      ? landing.carousel_images 
      : ['gambardepan.png'];

    setupGallery(bookPath, images);

    // F. Setup E-Book Option (Mayar Direct)
    if (meta.links && meta.links.mayar_ebook) {
      const ebookBox = document.getElementById('optionEbookBox');
      if (ebookBox) ebookBox.classList.remove('hidden');
      if (document.getElementById('priceEbookTag')) document.getElementById('priceEbookTag').innerText = meta.harga_ebook ? `Rp ${meta.harga_ebook.toLocaleString('id-ID')}` : 'Akses Mayar';
      if (document.getElementById('btnMayarEbook')) document.getElementById('btnMayarEbook').href = meta.links.mayar_ebook;
    }

    // G. Setup Cetak Option (Marketplace, WA, & Cart)
    if (meta.harga_cetak) {
      const cetakBox = document.getElementById('optionCetakBox');
      if (cetakBox) cetakBox.classList.remove('hidden');
      if (document.getElementById('priceCetakTag')) document.getElementById('priceCetakTag').innerText = `Rp ${meta.harga_cetak.toLocaleString('id-ID')}`;

      if (meta.links && meta.links.shopee) {
        const btnShopee = document.getElementById('btnShopee');
        if (btnShopee) {
          btnShopee.href = meta.links.shopee;
          btnShopee.classList.remove('hidden');
        }
      }

      if (meta.links && meta.links.tokopedia) {
        const btnTokped = document.getElementById('btnTokopedia');
        if (btnTokped) {
          btnTokped.href = meta.links.tokopedia;
          btnTokped.classList.remove('hidden');
        }
      }

      const waMsg = encodeURIComponent(`Halo Admin Pena Bisa, saya mau pesan Buku Cetak:\n*Judul:* ${meta.judul}\n*SKU:* ${meta.sku || currentFolder}\n*Harga:* Rp ${meta.harga_cetak.toLocaleString('id-ID')}`);
      if (document.getElementById('btnWaDirect')) document.getElementById('btnWaDirect').href = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;

      if (document.getElementById('btnAddToCart')) {
        document.getElementById('btnAddToCart').onclick = () => {
          addToCart(meta.id || meta.sku || currentFolder, meta.judul, meta.harga_cetak, `${bookPath}/${images[0]}`);
        };
      }
    }

    // H. Parse & Render Markdown
    if (typeof marked !== 'undefined' && document.getElementById('bookMarkdownContent')) {
      document.getElementById('bookMarkdownContent').innerHTML = marked.parse(mdText);
    } else if (document.getElementById('bookMarkdownContent')) {
      document.getElementById('bookMarkdownContent').innerText = mdText;
    }

    // I. Switch Visibility
    document.getElementById('detailLoading').classList.add('hidden');
    if (document.getElementById('bookWrapper')) document.getElementById('bookWrapper').classList.remove('hidden');
    if (document.getElementById('bookExtraSection')) document.getElementById('bookExtraSection').classList.remove('hidden');

    // J. Render User Reviews
    renderRealReviews();

  } catch (err) {
    console.error("Gagal memuat detail buku:", err);
    document.getElementById('detailLoading').innerHTML = `<p style="color:#ef4444; padding:2rem; text-align:center;">⚠️ Gagal memuat metadata buku untuk "${currentFolder}". Pastikan folder tersebut ada di repositori.</p>`;
  }
}

// 5. Helper Function: Resolve Parameter (Ganti SKU ke Nama Folder Asli Jika Perlu)
async function resolveFolderName(inputParam) {
  try {
    const res = await fetch('../index-katalog.json');
    if (!res.ok) return inputParam;
    
    const indexData = await res.json();
    const books = indexData.books || [];

    // Jika inputParam sudah merupakan nama folder yang terdaftar
    if (books.includes(inputParam)) {
      return inputParam;
    }

    // Cari folder yang memiliki metabuku.json dengan SKU / ID yang cocok
    for (const folder of books) {
      try {
        const bRes = await fetch(`../books/${folder}/metabuku.json`);
        if (bRes.ok) {
          const bMeta = await bRes.json();
          if (bMeta.sku === inputParam || bMeta.id === inputParam) {
            return folder; // Kembalikan nama folder fisiknya
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  return inputParam; // Fallback ke inputParam asal
}

// 6. Setup Image Gallery
function setupGallery(basePath, images) {
  const mainBox = document.getElementById('mainImageBox');
  const thumbList = document.getElementById('thumbnailList');

  if (mainBox) {
    mainBox.innerHTML = `<img id="mainImageDisplay" src="${basePath}/${images[0]}" alt="Sampul Utama" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x500?text=Sampul+Buku';">`;
  }

  if (thumbList) {
    if (images.length > 1) {
      thumbList.innerHTML = images.map((img, idx) => `
        <img src="${basePath}/${img}" class="${idx === 0 ? 'active' : ''}" onclick="switchGalleryImg('${basePath}/${img}', this)" alt="Pratinjau ${idx + 1}" onerror="this.onerror=null; this.src='https://via.placeholder.com/80x100?text=Pratinjau';">
      `).join('');
    } else {
      thumbList.innerHTML = '';
    }
  }
}

function switchGalleryImg(fullPath, element) {
  const mainDisplay = document.getElementById('mainImageDisplay');
  if (mainDisplay) mainDisplay.src = fullPath;
  document.querySelectorAll('#thumbnailList img').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
}

// 7. Sistem Keranjang (LocalStorage)
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

// 8. Review & Rating Handler
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
  const nameInput = document.getElementById('reviewName');
  const commentInput = document.getElementById('reviewComment');
  const ratingInput = document.getElementById('reviewRating');

  if (!nameInput || !commentInput || !currentFolder) return;

  const name = nameInput.value.trim();
  const comment = commentInput.value.trim();
  const ratingVal = ratingInput ? ratingInput.value : "5";

  if (!name || !comment) {
    alert("Mohon isi nama dan pesan ulasan Anda.");
    return;
  }

  const stars = "⭐".repeat(parseInt(ratingVal));
  const newReview = { name, comment, rating: stars };

  const storageKey = `penabisa_reviews_${currentFolder}`;
  const existingReviews = JSON.parse(localStorage.getItem(storageKey)) || [];
  existingReviews.unshift(newReview);

  localStorage.setItem(storageKey, JSON.stringify(existingReviews));

  nameInput.value = '';
  commentInput.value = '';

  renderRealReviews();
  alert("Terima kasih! Ulasan Anda telah berhasil dikirim.");
}
