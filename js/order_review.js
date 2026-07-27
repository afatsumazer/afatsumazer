// js/order_review.js

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
  // Data order review sekarang ada di Firestore (koleksi "config", dokumen "orderReview"),
  // bukan di Realtime Database — mengikuti perubahan yang sama di panel admin.
  import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  // Konfigurasi sama persis dengan panel admin — satu project Firebase yang sama
  const firebaseConfig = {
    apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
    authDomain: "afatsumazer-app.firebaseapp.com",
    databaseURL: "https://afatsumazer-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "afatsumazer-app",
    storageBucket: "afatsumazer-app.firebasestorage.app",
    messagingSenderId: "16280759060",
    appId: "1:16280759060:web:fd4deacafdf5cadd777001",
    measurementId: "G-WB9YW9D726"
  };

  const app = initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  function formatMoney(n) {
    const num = Number(n) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  let addonSelected = false;
  let current = {};

  function render() {
    const d = current;
    document.querySelector('[data-field="product_name"]').textContent = d.productName || 'Product name';
    document.querySelector('[data-field="product_spec"]').textContent = d.productSpec || '';
    document.querySelector('[data-field="product_price"]').textContent = formatMoney(d.productPrice);

    const thumb = document.querySelector('[data-field="product_image"]');
    if (d.productImage) {
      thumb.innerHTML = `<img src="${d.productImage}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    }

    document.querySelector('[data-field="addon_name"]').textContent = d.addonName || 'Add-on name';
    document.querySelector('[data-field="addon_desc"]').textContent = d.addonDesc || '';
    document.querySelector('[data-field="addon_price"]').innerHTML = formatMoney(d.addonPrice) + '<span>/month</span>';

    const noteEl = document.querySelector('[data-field="addon_note"]');
    if (d.addonNote) {
      noteEl.textContent = d.addonNote;
      noteEl.style.display = '';
    } else {
      noteEl.style.display = 'none';
    }

    document.querySelector('[data-field="shipping"]').textContent = d.shippingLabel || 'Free';
    document.querySelector('[data-field="checkout_label"]').textContent = d.checkoutLabel || 'Continue to Payment';

    const qrWrap = document.querySelector('[data-field="checkout_qr_wrap"]');
    const qrImg = document.querySelector('[data-field="checkout_qr_img"]');
    if (d.checkoutQr) {
      qrImg.src = d.checkoutQr;
      qrWrap.style.display = '';
    } else {
      qrWrap.style.display = 'none';
    }

    updateTotals();
  }

  function updateTotals() {
    const d = current;
    const productPrice = Number(d.productPrice) || 0;
    const addonPrice = Number(d.addonPrice) || 0;
    const total = productPrice + (addonSelected ? addonPrice : 0);

    document.querySelector('[data-field="subtotal"]').textContent = formatMoney(productPrice) + '.00';
    document.querySelector('[data-field="total"]').textContent = formatMoney(total);
  }

  const addBtn = document.querySelector('.add-btn');
  addBtn.addEventListener('click', () => {
    addonSelected = !addonSelected;
    addBtn.textContent = addonSelected ? 'Added' : 'Add';
    updateTotals();
  });

  const checkoutBtn = document.querySelector('.cta button');
  checkoutBtn.addEventListener('click', () => {
    if (current.checkoutLink) {
      window.open(current.checkoutLink, '_blank');
    }
  });

  onSnapshot(doc(firestore, 'config', 'orderReview'), (snap) => {
    current = snap.exists() ? snap.data() : {};
    render();
  });
