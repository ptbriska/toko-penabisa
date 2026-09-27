/* ==========================================================================
   Cart Module Logic - LocalStorage & WhatsApp Rekap Engine
   ========================================================================== */

const WA_NUMBER = "6282268118842";
let cart = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSharedComponents();
  loadCartFromStorage();
  renderCartPage();
});

// 1. Load Shared Components (Header & Footer)
async function loadSharedComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('../components/header.html'),
      fetch('../components/footer.html')
    ]);

    if (headerRes.ok) document.getElementById('globalHeader').innerHTML = await headerRes.text();
    if (footerRes.ok) document.getElementById('globalFooter').innerHTML = await footerRes.text();

  } catch (err) {
    console.warn("Shared components error:", err);
  }
}

// 2. Load Data Keranjang dari LocalStorage
function loadCartFromStorage() {
  cart = JSON.parse(localStorage.getItem('penabisa_cart')) || [];
  updateCartBadge();
}

// 3. Save Data Keranjang ke LocalStorage
function saveCartToStorage() {
  localStorage.setItem('penabisa_cart', JSON.stringify(cart));
  updateCartBadge();
}

// 4. Update Badge Keranjang di Header
function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge) badge.innerText = totalQty;
}

// 5. Render Halaman Keranjang Belanja
function renderCartPage() {
  const tbody = document.getElementById('cartTableBody');
  const emptyState = document.getElementById('emptyCartState');
  const contentWrapper = document.getElementById('cartContentWrapper');

  if (!tbody || !emptyState || !contentWrapper) return;

  if (cart.length === 0) {
    emptyState.classList.remove('hidden');
    contentWrapper.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  contentWrapper.classList.remove('hidden');

  let totalPrice = 0;
  let totalItems = 0;

  tbody.innerHTML = cart.map((item, index) => {
    const subtotal = item.harga * item.qty;
    totalPrice += subtotal;
    totalItems += item.qty;

    return `
      <tr>
        <td>
          <div class="cart-item-product">
            <img src="${item.cover}" alt="${item.judul}" onerror="this.onerror=null; this.src='https://via.placeholder.com/60x80?text=Buku';">
            <div>
              <h4>${item.judul}</h4>
              <small style="color:var(--text-muted);">SKU/ID: ${item.id}</small>
            </div>
          </div>
        </td>
        <td>Rp ${item.harga.toLocaleString('id-ID')}</td>
        <td>
          <div class="qty-control">
            <button type="button" onclick="changeQty(${index}, -1)">-</button>
            <input type="number" value="${item.qty}" min="1" readonly>
            <button type="button" onclick="changeQty(${index}, 1)">+</button>
          </div>
        </td>
        <td><strong>Rp ${subtotal.toLocaleString('id-ID')}</strong></td>
        <td>
          <button type="button" class="btn-remove-item" onclick="removeItem(${index})" title="Hapus Item">❌</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('summaryTotalItems').innerText = `${totalItems} item (${cart.length} judul)`;
  document.getElementById('summaryTotalPrice').innerText = `Rp ${totalPrice.toLocaleString('id-ID')}`;
}

// 6. Ubah Jumlah (Qty)
function changeQty(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    saveCartToStorage();
    renderCartPage();
  }
}

// 7. Hapus Item Tunggal
function removeItem(index) {
  if (confirm(`Apakah Anda yakin ingin menghapus "${cart[index].judul}" dari keranjang?`)) {
    cart.splice(index, 1);
    saveCartToStorage();
    renderCartPage();
  }
}

// 8. Kosongkan Seluruh Keranjang
function clearCartConfirm() {
  if (confirm("Apakah Anda yakin ingin mengosongkan seluruh isi keranjang belanja?")) {
    cart = [];
    saveCartToStorage();
    renderCartPage();
  }
}

// 9. Checkout Rekap WhatsApp Engine
function checkoutViaWA() {
  if (cart.length === 0) {
    alert("Keranjang belanja Anda masih kosong.");
    return;
  }

  const name = document.getElementById('buyerName').value.trim();
  const phone = document.getElementById('buyerPhone').value.trim();
  const address = document.getElementById('buyerAddress').value.trim();
  const courier = document.getElementById('courierOption').value;
  const notes = document.getElementById('buyerNotes').value.trim();

  if (!name || !phone || !address) {
    alert("Mohon lengkapi Nama, Nomor WA, dan Alamat Lengkap Pengiriman terlebih dahulu.");
    return;
  }

  let text = `*PESANAN BUKU CETAK - TOKO PENA BISA*\n`;
  text += `====================================\n\n`;
  text += `👤 *DATA PEMBELI:*\n`;
  text += `• *Nama:* ${name}\n`;
  text += `• *No. WA:* ${phone}\n`;
  text += `• *Alamat Lengkap:* ${address}\n`;
  text += `• *Ekspedisi Pilihan:* ${courier}\n`;
  if (notes) text += `• *Catatan:* ${notes}\n`;

  text += `\n📦 *RINCIAN BUKU PESANAN:*\n`;
  let totalPrice = 0;
  let totalItems = 0;

  cart.forEach((item, i) => {
    const subtotal = item.harga * item.qty;
    totalPrice += subtotal;
    totalItems += item.qty;
    text += `${i + 1}. *${item.judul}*\n   (${item.qty}x @ Rp ${item.harga.toLocaleString('id-ID')}) = Rp ${subtotal.toLocaleString('id-ID')}\n`;
  });

  text += `\n====================================\n`;
  text += `📚 *Total Item:* ${totalItems} Buku\n`;
  text += `💰 *Total Harga Buku:* Rp ${totalPrice.toLocaleString('id-ID')}\n`;
  text += `====================================\n\n`;
  text += `Mohon diinfokan total ongkos kirim dan nomor rekening pembayarannya. Terima kasih CS Pena Bisa!`;

  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}
