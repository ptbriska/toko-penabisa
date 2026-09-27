/* ==========================================================================
   Bundling Module Logic - Dynamic WMS SKU Integration & Feed Grid
   ========================================================================== */

const WA_NUMBER = "6282268118842";

let masterIndexData = null;
let bundlingList = [];
let booksDatabase = {}; // Map SKU ke Metadata Buku
let activeTags = new Set();

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

    // C. Render Sidebar Tags & Grid
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

  // Kumpulkan seluruh unique tag dari semua bundling
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
    // Match Format
    let matchFormat = true;
    if (isCetak && !isEbook) matchFormat = (b.jenis === 'Cetak');
    if (isEbook && !isCetak) matchFormat = (b.jenis === 'Ebook');

    // Match Tags
    let matchTag = true;
    if (activeTags.size > 0) {
      matchTag = (b.tags || []).some(t => activeTags.has(t));
    }

    // Match Harga
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

// 7. Pop-Up Modal IG Web + Dynamic WMS SKU Reconstruction
async function openIgModalBundling(sku) {
  const bundle = bundlingList.find(b => b.sku === sku);
  if (!bundle) return;

  const folderPath = `../bundling/${bundle.folder}`;

  // Populate Poster
  const posterBox = document.getElementById('posterBox');
  posterBox.innerHTML = `<img src="${folderPath}/Poster.png" alt="${bundle.judul_bundling}" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x500?text=Poster';">`;

  // Populate Header
  document.getElementById('modalBundlingTitle').innerText = bundle.judul_bundling;
  document.getElementById('modalBundlingSku').innerText = `SKU Bundling: ${bundle.sku}`;

  // Populate Tags & Price
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
              <small>SKU: ${itemSku} | Penulis: ${bookData.meta.penulis || '-'}</small>
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

  // Fetch Deskripsi Markdown
  const mdBox = document.getElementById('modalBundlingMarkdown');
  try {
    const mdRes = await fetch(`${folderPath}/deskripsibundling.md`);
    if (mdRes.ok) {
      const mdText = await mdRes.text();
      mdBox.innerHTML = window.marked ? marked.parse(mdText) : mdText;
    } else {
      mdBox.innerText = "Deskripsi paket bundling belum tersedia.";
    }
  } catch (e) {
    mdBox.innerText = "Deskripsi paket bundling belum tersedia.";
  }

  // Render Footer Action Buttons
  const footerBox = document.getElementById('modalBundlingFooter');
  if (bundle.jenis === 'Ebook' && bundle.link_mayar) {
    footerBox.innerHTML = `
      <a href="${bundle.link_mayar}" target="_blank" class="btn-act-mayar">
        ⚡ Beli Paket E-Book (Mayar Direct) ➔
      </a>
    `;
  } else {
    const waText = encodeURIComponent(`Halo Admin Pena Bisa, saya berminat membeli Paket Bundling:\n*Judul:* ${bundle.judul_bundling}\n*SKU:* ${bundle.sku}\n*Harga:* Rp ${(bundle.harga_bundling || 0).toLocaleString('id-ID')}`);
    
    footerBox.innerHTML = `
      <a href="https://wa.me/${WA_NUMBER}?text=${waText}" target="_blank" class="btn-act-wa">
        📱 Beli Langsung via WA (CS)
      </a>
      <button type="button" class="btn-act-cart" onclick="addBundlingToCart('${bundle.sku}', '${bundle.judul_bundling}', ${bundle.harga_bundling || 0}, '${folderPath}/Poster.png')">
        🛒 + Masukkan Keranjang Belanja
      </button>
    `;
  }

  document.getElementById('igModalBundling').classList.remove('hidden');
}

function closeIgModalBundling() {
  document.getElementById('igModalBundling').classList.add('hidden');
}

function handleOverlayClick(e) {
  if (e.target.id === 'igModalBundling') {
    closeIgModalBundling();
  }
}

// Tambahkan Paket Bundling ke Keranjang Belanja
function addBundlingToCart(sku, judul, harga, cover) {
  let cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  const existing = cart.find(item => item.id === sku);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: sku, judul: `[Paket] ${judul}`, harga, cover, qty: 1 });
  }

  localStorage.setItem('penabisa_cart', JSON.stringify(cart));
  updateCartBadge();
  alert(`✅ Paket "${judul}" berhasil dimasukkan ke keranjang belanja.`);
}
