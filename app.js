/* =============================================
   QuickBite – Queue-Free Canteen | app.js
   All functionality: menu, cart, orders, auth, admin.
   EDIT GUIDE: Search for "EDIT" comments below.
   ============================================= */

'use strict';
// 'use strict' — catches common coding mistakes, keeps code clean

// =============================================
// MENU DATA
// =============================================
// EDIT: Add, remove, or change menu items here.
// Each item has: id, name, image, category, price, desc, time, veg, available
// - id:        unique number (don't repeat)
// - name:      item display name
// - image:     URL of the food photo (can be a web URL or local path like 'images/dosa.jpg')
//              HOW TO USE YOUR OWN PHOTO:
//              1. Create a folder named 'images' inside the canteen folder
//              2. Put your photo inside it (e.g. dosa.jpg)
//              3. Change image value to: 'images/dosa.jpg'
// - category:  must match one of the CATEGORIES below
// - price:     in rupees (number only, no ₹)
// - desc:      short description shown on card
// - time:      preparation time shown in detail modal
// - veg:       true = vegetarian, false = non-vegetarian
// - available: true = can be ordered, false = greyed out
// Global settings config
function getApiUrl() {
  const hostname = window.location.hostname;
  const isLocal = window.location.protocol === 'file:' ||
                  hostname === 'localhost' ||
                  hostname === '127.0.0.1' ||
                  hostname.startsWith('192.168.') ||
                  hostname.startsWith('10.') ||
                  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
  
  if (isLocal) {
    if (window.location.protocol === 'file:') {
      return 'http://localhost:5000/api';
    }
    return `${window.location.protocol}//${hostname}:5000/api`;
  }
  
  // If deployed frontend and backend are on different domains, replace the return below:
  return 'https://queue-free-canteen-ordering-system.onrender.com';
  // return window.location.origin + '/api';
}
const API_URL = getApiUrl();
let MENU = [];
let CATEGORIES = ['All'];

async function fetchMenu() {
  try {
    const res = await fetch(`${API_URL}/menu`);
    if (res.ok) {
      MENU = await res.json();
      CATEGORIES = ['All', ...new Set(MENU.map(i => i.category))];
    } else {
      showToast('Failed to load menu from server.');
    }
  } catch (err) {
    console.error('Error fetching menu:', err);
    showToast('Backend server is offline.');
  }
}
// ...new Set() removes duplicates automatically


// =============================================
// APP STATE (data that changes during use)
// =============================================
let currentUser = JSON.parse(localStorage.getItem('qb_user') || 'null');
// currentUser: the logged-in user object, or null if not logged in
// localStorage keeps user logged in even after page refresh

let cart = [];
// cart: array of { item, qty } objects — items the user has added

let orders = JSON.parse(localStorage.getItem('qb_orders') || '[]');
// orders: all placed orders, loaded from localStorage (persists on refresh)

let activeCategory = 'All';
// activeCategory: which category filter pill is currently selected

let tokenCounter = parseInt(localStorage.getItem('qb_token') || '1');
// tokenCounter: auto-incrementing token number for orders
// EDIT: Change '1' to start tokens from a different number

let isLoginMode = true;
// isLoginMode: true = Login form, false = Register form


// =============================================
// DATA HELPERS (localStorage read/write)
// =============================================

// Get all registered users from localStorage
function getUsers() { return JSON.parse(localStorage.getItem('qb_users') || '[]'); }

// Save updated users list to localStorage
function saveUsers(u) { localStorage.setItem('qb_users', JSON.stringify(u)); }

// Save all orders to localStorage
function saveOrders() { localStorage.setItem('qb_orders', JSON.stringify(orders)); }

// Get next unique token number and save counter
function nextToken() {
  const t = tokenCounter++; // Get current value, then increment
  localStorage.setItem('qb_token', tokenCounter); // Save incremented counter
  return t; // Return the token number for this order
}


// =============================================
// DOM ELEMENT REFERENCES
// =============================================
// $ is a shortcut for document.getElementById
// These variables point to HTML elements we need to update
const $ = id => document.getElementById(id);

const menuGrid = $('menuGrid');      // The menu items grid container
const categoryPills = $('categoryPills'); // Category filter buttons container
const searchInput = $('searchInput');   // Search text input
const cartBtn = $('cartBtn');       // Cart icon in header
const cartBadge = $('cartBadge');     // Item count badge on cart
const cartSidebar = $('cartSidebar');   // Cart sidebar panel
const overlay = $('overlay');       // Dark overlay behind cart/modal
const closeCart = $('closeCart');     // Close button inside cart
const cartItemsEl = $('cartItems');     // Cart items list container
const cartFooter = $('cartFooter');    // Cart total + place order section
const cartTotalEl = $('cartTotal');     // Total price display in cart
const placeOrderBtn = $('placeOrderBtn'); // "Place Order" button
const loginBtn = $('loginBtn');      // Login/Logout button in header

// All page sections (for tab switching)
const pages = {
  menu: $('menuPage'),   // Menu browsing page
  orders: $('ordersPage'), // My Order history page
  admin: $('adminPage'),  // Admin panel page
};


// =============================================
// UTILITY FUNCTIONS
// =============================================

// Format a number as Indian Rupees: 45 → "₹45"
function formatPrice(p) { return `₹${p}`; }

// Show how long ago an order was placed
function timeAgo(ts) {
  const diff = Date.now() - ts; // Difference in milliseconds
  if (diff < 60000) return 'Just now';               // Less than 1 minute
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`; // Minutes
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Time
}

// Returns array of step objects for the order timeline
// Each step: { label, done, current }
function statusSteps(status) {
  const steps = ['Pending', 'Preparing', 'Ready', 'Completed'];
  // EDIT: Change step labels here if you want different stage names
  const idx = steps.findIndex(s => s.toLowerCase() === status.toLowerCase());
  return steps.map((s, i) => ({
    label: s,
    done: i < idx,  // Step is completed (before current)
    current: i === idx // Step is current
  }));
}


// =============================================
// MENU RENDERING
// =============================================

// Render the category filter pills (buttons)
function renderCategories() {
  categoryPills.innerHTML = ''; // Clear existing pills

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' + (cat === activeCategory ? ' active' : '');
    // Add 'active' class to currently selected category

    btn.textContent = catEmoji(cat) + ' ' + cat; // e.g. "🍕 Snacks"

    btn.addEventListener('click', () => {
      activeCategory = cat; // Update selected category
      renderCategories();   // Re-render pills (updates active state)
      renderMenu();         // Re-render menu grid with new filter
    });

    categoryPills.appendChild(btn); // Add pill to DOM
  });
}

// EDIT: Map category names to emojis for the pills
function catEmoji(cat) {
  const map = {
    All: '🍽️',
    Breakfast: '🌅',
    Lunch: '☀️',
    Snacks: '🥨',
    Drinks: '🥤',
    Desserts: '🍬',
    // EDIT: Add more categories here matching your MENU items
  };
  return map[cat] || '🍴'; // Default emoji if category not mapped
}

// Render the food item cards in the menu grid
function renderMenu() {
  // Get search query (lowercase for case-insensitive match)
  const q = searchInput.value.toLowerCase().trim();

  // Filter by category
  let items = activeCategory === 'All' ? MENU : MENU.filter(i => i.category === activeCategory);

  // Also filter by search query (checks name and description)
  if (q) items = items.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.desc.toLowerCase().includes(q)
  );

  // Show message if no items match
  if (!items.length) {
    menuGrid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">No items found. Try a different search.</p>';
    return;
  }

  // Build HTML for all matching items
  menuGrid.innerHTML = items.map(item => {
    const cartEntry = cart.find(c => c.item.id === item.id); // Check if item is in cart
    const qty = cartEntry ? cartEntry.qty : 0;               // Quantity in cart (0 if not added)

    return `
    <div class="menu-card${item.available ? '' : ' unavailable'}" id="card-${item.id}">
      <!-- "unavailable" class greys out the card and disables clicks -->

      ${!item.available ? '<span class="unavail-tag">Not Available</span>' : ''}
      <!-- Shows "Not Available" badge on card if item.available = false -->

      <!-- Food image area (click to open detail modal) -->
      <!-- EDIT: image URL comes from the item.image field in MENU array above -->
      <div class="card-img-wrap" data-id="${item.id}">
        <img
          src="${item.image}"
          alt="${item.name}"
          class="card-img"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
        />
        <!-- onerror: if image fails to load, hides it and shows fallback emoji below -->
        <div class="card-img-fallback" style="display:none">
          🍽️
          <!-- EDIT: Change this fallback emoji shown when image fails to load -->
        </div>
        <!-- Veg/Non-veg dot indicator (green = veg, red = non-veg) -->
        <div class="veg-badge ${item.veg ? 'veg' : 'nonveg'}"></div>
        <!-- "View Details" overlay is added by CSS :hover -->
      </div>

      <div class="card-body">
        <p class="card-category">${item.category}</p>
        <h3 class="card-name">${item.name}</h3>
        <p class="card-desc" title="${item.desc}">${item.desc}</p>
        <!-- title shows full desc in tooltip on hover -->

        <div class="card-footer">
          <span class="card-price">${formatPrice(item.price)}</span>

          ${qty === 0
        /* If not in cart: show "+ Add" button */
        ? `<button class="add-btn" data-id="${item.id}">+ Add</button>`
        /* If in cart: show quantity control (− qty +) */
        : `<div class="qty-control">
                 <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
                 <span class="qty-num">${qty}</span>
                 <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
               </div>`
      }
        </div>
      </div>
    </div>`;
  }).join(''); // Join all card HTML strings together
}


// =============================================
// CART FUNCTIONS
// =============================================

// Calculate total price of all items in cart
function cartTotal() {
  return cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);
}

// Calculate total number of items in cart (counts quantities)
function cartCount() {
  return cart.reduce((sum, c) => sum + c.qty, 0);
}

// Update the cart badge number and play bump animation
function updateCartBadge() {
  const n = cartCount();
  cartBadge.textContent = n; // Update the displayed count
  cartBadge.classList.add('bump');
  setTimeout(() => cartBadge.classList.remove('bump'), 200); // Remove after animation
}

// Add item to cart (called when "+ Add" is clicked)
function addToCart(id) {
  if (!currentUser) { window.location.href = 'login.html'; return; }
  // Must be logged in to add items. Opens login modal if not.

  const item = MENU.find(i => i.id === Number(id)); // Find item by ID
  if (!item || !item.available) return;             // Safety check

  const entry = cart.find(c => c.item.id === item.id); // Check if already in cart
  if (entry) {
    entry.qty++; // Increase quantity if already exists
  } else {
    cart.push({ item, qty: 1 }); // Add new entry with qty 1
  }

  updateCartBadge();  // Refresh badge count
  renderMenu();       // Refresh menu (shows qty control instead of "+ Add")
  renderCartItems();  // Refresh cart sidebar
}

// Increase or decrease quantity of an item in cart
function changeQty(id, action) {
  const idx = cart.findIndex(c => c.item.id === Number(id)); // Find item index
  if (idx === -1) return; // Item not in cart, do nothing

  if (action === 'inc') {
    cart[idx].qty++; // Increase quantity
  } else {
    cart[idx].qty--;             // Decrease quantity
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1);       // Remove from cart if qty reaches 0
    }
  }

  updateCartBadge();
  renderMenu();
  renderCartItems();
}

// Remove an item completely from cart
function removeFromCart(id) {
  cart = cart.filter(c => c.item.id !== Number(id)); // Keep all items except this one
  updateCartBadge();
  renderMenu();
  renderCartItems();
}

// Build and display items inside the cart sidebar
function renderCartItems() {
  if (!cart.length) {
    // Cart is empty
    cartItemsEl.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
    cartFooter.style.display = 'none'; // Hide total + place order section
    return;
  }

  cartFooter.style.display = 'block'; // Show total + place order section

  // Build cart item HTML for each item
  cartItemsEl.innerHTML = cart.map(c => `
    <div class="cart-item">
      <!-- Item thumbnail image in cart. Falls back to emoji if image fails -->
      <div class="cart-item-thumb">
        <img
          src="${c.item.image}"
          alt="${c.item.name}"
          onerror="this.style.display='none'"
        />
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">
          ${c.item.name}
          <span style="color:var(--text-muted)">×${c.qty}</span>
          <!-- Shows item name and quantity -->
        </div>
        <div class="cart-item-price">${formatPrice(c.item.price * c.qty)}</div>
        <!-- Shows subtotal: price × quantity -->
      </div>
      <!-- Quantity control in cart -->
      <div class="qty-control" style="margin-right:8px">
        <button class="qty-btn" data-action="dec" data-id="${c.item.id}">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" data-action="inc" data-id="${c.item.id}">+</button>
      </div>
      <!-- Remove button -->
      <button class="cart-item-remove" data-rmv="${c.item.id}">🗑</button>
    </div>
  `).join('');

  cartTotalEl.textContent = formatPrice(cartTotal()); // Update total price display
}

// Open cart sidebar
function openCart() {
  cartSidebar.classList.add('open');   // Slides cart in
  overlay.classList.add('show');       // Shows dark overlay
}

// Close cart sidebar
function closeCartFn() {
  cartSidebar.classList.remove('open'); // Slides cart out
  overlay.classList.remove('show');     // Hides dark overlay
}


// =============================================
// PAYMENT SYSTEM
// =============================================
// Opens the payment modal instead of placing order directly.
// Payment flow: Cart → Payment Modal → (Cash/UPI/Card) → Order Confirmed
function placeOrder() {
  if (!currentUser) { window.location.href = 'login.html'; return; }
  // Must be logged in to place order

  if (!cart.length) return;
  // Don't place empty order

  closeCartFn();            // Close cart sidebar
  openModal('paymentModal'); // Open payment modal

  // Show total amount in payment modal
  $('paymentTotalDisplay').textContent = formatPrice(cartTotal());
}

// Called after user chooses a payment method and confirms payment
async function finaliseOrder(paymentMethod) {
  const token = nextToken(); // Get a unique token number
  const note = $('specialNote').value.trim(); // Get special instructions

  // Build order object
  const order = {
    id: `QB-${Date.now()}`,  // Unique order ID using timestamp
    token,                          // Token number customer collects with
    userEmail: currentUser.email,    // Who placed the order
    items: cart.map(c => ({      // Snapshot of ordered items
      name: c.item.name,
      qty: c.qty,
      price: c.item.price,
    })),
    total: cartTotal(),           // Total amount
    note,                           // Special instructions
    paymentMethod,                  // How the customer paid: 'cash', 'upi', or 'card'
  };

  try {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!res.ok) {
      let errData = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errData = await res.json();
      }
      showToast(errData.error || `Server error: ${res.status} ${res.statusText}`);
      return;
    }

    // Reset cart and form
    cart = [];
    $('specialNote').value = '';
    updateCartBadge();
    renderMenu();      // Restore "+ Add" buttons
    renderCartItems(); // Show empty cart

    closeModal('paymentModal'); // Close payment modal

    // Show order confirmation popup with token number
    $('confirmToken').textContent = `#${token}`;
    $('confirmPayMethod').textContent = paymentMethod === 'cash' ? '💵 Cash on Pickup'
      : paymentMethod === 'upi' ? '📲 UPI'
        : '💳 Card'; // Show which payment method was used
    openModal('confirmModal');
    renderOrders(); // Pre-render orders page in background

  } catch (err) {
    console.error('Error finalising order:', err);
    showToast('Failed to connect to backend server.');
  }
}

// =============================================
// PAYMENT MODAL LOGIC
// =============================================
let selectedPayMethod = 'cash'; // Default payment method: 'cash', 'upi', or 'card'

// Switch between payment method tabs (Cash / UPI / Card)
function selectPayMethod(method) {
  selectedPayMethod = method; // Save selected method

  // Update tab button styles
  ['cash', 'upi', 'card'].forEach(m => {
    const btn = $('payTab-' + m);
    btn.classList.toggle('active', m === method); // Highlight selected tab
  });

  // Show/hide the correct method panel
  ['cash', 'upi', 'card'].forEach(m => {
    $('payPanel-' + m).style.display = m === method ? 'block' : 'none';
  });
}

// Called when user clicks "Pay Now" / "Confirm" button in payment modal
function submitPayment() {
  const method = selectedPayMethod;

  if (method === 'card') {
    // Basic card validation
    const num = $('cardNumber').value.replace(/\s/g, '');
    const exp = $('cardExpiry').value.trim();
    const cvv = $('cardCVV').value.trim();
    const name = $('cardName').value.trim();
    if (num.length < 16) { showToast('Enter a valid 16-digit card number'); return; }
    if (!exp) { showToast('Enter card expiry date'); return; }
    if (cvv.length < 3) { showToast('Enter a valid CVV'); return; }
    if (!name) { showToast('Enter cardholder name'); return; }
    // In production: send to a real payment gateway like Razorpay or Stripe here
  }

  if (method === 'upi') {
    const upiId = $('upiId').value.trim();
    if (!upiId) { showToast('Enter your UPI ID'); return; }
    // In production: trigger actual UPI payment initiation here
  }

  // Simulate payment processing with a brief loading state
  const payBtn = $('payNowBtn');
  payBtn.textContent = 'Processing…';
  payBtn.disabled = true;

  setTimeout(() => {
    payBtn.textContent = 'Pay Now';
    payBtn.disabled = false;
    finaliseOrder(method); // Place the order with payment info
  }, 1500); // EDIT: Change 1500ms to adjust the fake "processing" delay
}


// =============================================
// MY ORDERS PAGE RENDERING
// =============================================
async function renderOrders() {
  const container = $('ordersContainer');
  if (!currentUser) {
    container.innerHTML = '<p class="empty-msg">Please log in to view your orders.</p>';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/orders?email=${currentUser.email}`);
    if (!res.ok) {
      container.innerHTML = '<p class="empty-msg">Failed to retrieve order history.</p>';
      return;
    }
    const myOrders = await res.json();

    // Show message if user has no orders yet
    if (!myOrders.length) {
      container.innerHTML = '<p class="empty-msg">No orders yet. Start ordering from the menu!</p>';
      return;
    }

    // Emoji icons for each step of timeline
    const stepIcons = ['📋', '🍳', '🔔', '✅'];

    // Build HTML for each order card
    container.innerHTML = myOrders.map(order => {
      const steps = statusSteps(order.status); // Get timeline steps for this order

      return `
      <div class="order-card">

        <!-- Order header: ID, time, token number -->
        <div class="order-card-header">
          <div class="order-meta">
            <span class="order-id">Order ${order.id}</span>
            <span class="order-date">${timeAgo(order.ts)}</span>
            ${order.note ? `<span class="order-date">📝 ${order.note}</span>` : ''}
          </div>
          <div class="order-token">
            <div class="order-token-label">Token</div>
            <div class="order-token-num">#${order.token}</div>
          </div>
        </div>

        <!-- List of items in this order -->
        <div class="order-items-list">
          ${order.items.map(it => `
            <div class="order-item-row">
              <strong>${it.name}</strong>
              <span>×${it.qty} — ${formatPrice(it.price * it.qty)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Order footer: total price and status badge -->
        <div class="order-footer">
          <div>
            <div class="order-total-label">Total paid</div>
            <div class="order-total-amt">${formatPrice(order.total)}</div>
          </div>
          <span class="status-badge status-${order.status}">${order.status}</span>
        </div>

        <!-- Progress timeline -->
        <div class="order-timeline" style="margin-top:20px">
          ${steps.map((s, i) => `
            <div class="tl-step ${s.done ? 'done' : ''} ${s.current ? 'current' : ''}">
              <div class="tl-dot">${s.done ? '✓' : stepIcons[i]}</div>
              <span class="tl-label">${s.label}</span>
            </div>
          `).join('')}
        </div>

      </div>`;
    }).join('');

  } catch (err) {
    console.error('Error rendering orders:', err);
    container.innerHTML = '<p class="empty-msg">Error loading orders. Backend offline.</p>';
  }
}


// Admin rendering and update handlers are now managed in /admin/admin.js



// =============================================
// ITEM DETAIL MODAL
// ======================``=======================
// Opens when user clicks on a food card emoji
function openItemDetail(id) {
  const item = MENU.find(i => i.id === Number(id)); // Find item by ID
  if (!item) return;

  const cartEntry = cart.find(c => c.item.id === item.id);
  const qty = cartEntry ? cartEntry.qty : 0; // Current quantity in cart

  // Build detail modal content
  $('itemModalContent').innerHTML = `
    <!-- Item detail photo (large) -->
    <div class="item-modal-img-wrap">
      <img
        src="${item.image}"
        alt="${item.name}"
        class="item-modal-img"
        onerror="this.style.display='none'"
      />
      <!-- If image fails to load it just hides cleanly -->
    </div>
    <div class="item-modal-name">${item.name}</div>

    <!-- Tags row: Veg/Non-veg, Category, Prep time -->
    <div class="item-modal-meta">
      <span class="item-tag ${item.veg ? 'tag-veg' : 'tag-nonveg'}">${item.veg ? '🟢 Veg' : '🔴 Non-Veg'}</span>
      <span class="item-tag tag-cat">${item.category}</span>
      <span class="item-tag tag-time">⏱ ${item.time}</span>
    </div>

    <div class="item-modal-desc">${item.desc}</div>
    <div class="item-modal-price">${formatPrice(item.price)}</div>

    ${item.available
      ? (qty === 0
        /* Not in cart: show Add button */
        ? `<button class="btn-primary w-full" id="modalAddBtn" data-id="${item.id}">+ Add to Cart</button>`
        /* In cart: show quantity control */
        : `<div class="qty-control" style="justify-content:center;background:var(--surface);padding:10px 20px;border-radius:99px">
               <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
               <span class="qty-num" style="font-size:1.1rem">${qty}</span>
               <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
             </div>`)
      /* Item unavailable: show message */
      : `<p style="color:var(--red);text-align:center;font-weight:700">❌ Currently Not Available</p>`
    }
  `;

  openModal('itemModal'); // Show the modal
}


// =============================================
// AUTHENTICATION (Login / Register / Logout)
// =============================================

// Update UI based on whether user is logged in
function updateAuthUI() {
  const navOrders = $('navOrders');
  const navAdmin = $('navAdmin');

  if (currentUser) {
    // Logged in: show first name + arrow on button
    loginBtn.textContent = `${currentUser.name.split(' ')[0]} ↓`;

    if (currentUser.role === 'admin') {
      // Admin logged in: change "My Orders" tab to "Live Orders" redirecting to admin portal
      if (navOrders) {
        navOrders.textContent = '📋 Live Orders';
        navOrders.dataset.page = 'admin';
      }
      if (navAdmin) navAdmin.classList.add('hidden'); // Hide redundant admin tab
    } else {
      // Student logged in
      if (navOrders) {
        navOrders.textContent = '📋 My Orders';
        navOrders.dataset.page = 'orders';
      }
      if (navAdmin) navAdmin.classList.add('hidden');
    }
  } else {
    // Logged out: show "Login" button
    loginBtn.textContent = 'Login';
    if (navOrders) {
      navOrders.textContent = '📋 My Orders';
      navOrders.dataset.page = 'orders';
    }
    if (navAdmin) navAdmin.classList.add('hidden');
  }
  renderOrders(); // Refresh orders page
}

// Log out the current user
function logout() {
  currentUser = null;
  localStorage.removeItem('qb_user'); // Clear from localStorage

  // Reset cart
  cart = [];
  updateCartBadge();
  renderMenu();
  renderCartItems();

  updateAuthUI();     // Update header button
  switchPage('menu'); // Go back to menu
  showToast('Logged out. See you soon!');
}


// =============================================
// MODAL OPEN / CLOSE
// =============================================

// Open a modal by adding "open" class
function openModal(id) { const el = $(id); if (el) el.classList.add('open'); }

// Close a modal by removing "open" class
function closeModal(id) { const el = $(id); if (el) el.classList.remove('open'); }


// =============================================
// TOAST NOTIFICATION (temporary message popup)
// =============================================
function showToast(msg) {
  // Remove existing toast if any
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  // Create toast element
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;

  // Inline styles for toast (not in CSS since it's created dynamically)
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
    background:var(--surface2); color:var(--text); border:1px solid var(--border);
    padding:12px 24px; border-radius:99px; font-size:0.9rem; font-weight:600;
    z-index:9999; box-shadow:var(--shadow); opacity:0;
    transition:opacity 0.3s, transform 0.3s; pointer-events:none;
    backdrop-filter:blur(10px); white-space:nowrap;
  `;
  // EDIT: Change padding, font-size, or bottom position for toast appearance

  document.body.appendChild(t);

  // Animate in
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });

  // Auto remove after 2.8 seconds
  // EDIT: Change 2800 to show toast longer or shorter (milliseconds)
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => t.remove(), 400); // Remove from DOM after fade out
  }, 2800);
}


// =============================================
// PAGE SWITCHING (tab navigation)
// =============================================
function switchPage(name) {
  if (name === 'admin') {
    window.location.href = 'admin/dashboard.html';
    return;
  }

  // Hide all pages
  Object.values(pages).forEach(p => p.classList.remove('active'));
  // Remove active from all tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Show selected page
  const page = pages[name];
  const tab = document.querySelector(`.nav-tab[data-page="${name}"]`);
  if (page) page.classList.add('active'); // Show page
  if (tab) tab.classList.add('active');  // Highlight tab

  // Refresh data for specific pages when switched to
  if (name === 'orders') renderOrders();
}


// =============================================
// EVENT DELEGATION
// =============================================
// One listener on document handles all clicks efficiently
// It checks what was clicked using .closest() to find the right element
document.addEventListener('click', e => {

  // ── Nav tab click ──
  const navTab = e.target.closest('.nav-tab');
  if (navTab) { switchPage(navTab.dataset.page); return; }

  // ── "+ Add" button on menu card ──
  const addBtn = e.target.closest('.add-btn');
  if (addBtn) { addToCart(addBtn.dataset.id); return; }

  // ── Quantity +/− buttons (works both in menu and cart) ──
  const qtyBtn = e.target.closest('.qty-btn');
  if (qtyBtn) {
    const inCart = e.target.closest('.cart-sidebar'); // Check if click is inside cart
    changeQty(qtyBtn.dataset.id, qtyBtn.dataset.action);
    // If item detail modal is open, refresh it to show updated qty
    if (!inCart && $('itemModal').classList.contains('open')) {
      openItemDetail(qtyBtn.dataset.id);
    }
    return;
  }

  // ── Remove (🗑) button in cart ──
  const rmvBtn = e.target.closest('[data-rmv]');
  if (rmvBtn) { removeFromCart(rmvBtn.dataset.rmv); return; }

  // ── Food IMAGE area on card (opens item detail) ──
  // Changed from card-emoji-wrap to card-img-wrap
  const imgWrap = e.target.closest('.card-img-wrap');
  if (imgWrap) { openItemDetail(imgWrap.dataset.id); return; }

  // ── "Add to Cart" button inside item detail modal ──
  const modalAdd = e.target.closest('#modalAddBtn');
  if (modalAdd) {
    addToCart(modalAdd.dataset.id);
    openItemDetail(modalAdd.dataset.id); // Refresh modal to show qty control
    return;
  }

  // ── Admin status update buttons (Prepare / Ready / Done) ──
  const adminBtn = e.target.closest('[data-oid]');
  if (adminBtn) { updateOrderStatus(adminBtn.dataset.oid, adminBtn.dataset.ns); return; }
});


// ── Cart open/close events ──
cartBtn.addEventListener('click', openCart);
closeCart.addEventListener('click', closeCartFn);

// Clicking the dark overlay closes cart and modals
overlay.addEventListener('click', () => {
  closeCartFn();
  closeModal('loginModal');
  closeModal('itemModal');
  closeModal('paymentModal'); // Also close payment modal if open
});

// ── Place Order button ──
placeOrderBtn.addEventListener('click', placeOrder);

// ── Order confirmation "Got it!" button ──
$('closeConfirm').addEventListener('click', () => {
  closeModal('confirmModal');
  switchPage('orders'); // Switch to My Orders tab
});

// ── Item detail modal close ──
$('closeItem').addEventListener('click', () => closeModal('itemModal'));

// ── Payment modal close button ──
$('closePayment').addEventListener('click', () => closeModal('paymentModal'));
// Note: Closing payment modal restores cart state so user can still edit cart

// ── Login/Logout button in header ──
loginBtn.addEventListener('click', () => {
  if (currentUser) {
    if (confirm(`Logout as ${currentUser.name}?`)) logout(); // Ask before logging out
  } else {
    window.location.href = 'login.html'; // Redirect to login page
  }
});

// ── Search input: filter menu on each keystroke ──
searchInput.addEventListener('input', renderMenu);


// Auto status simulation is removed since status is managed in the Admin Portal database


// =============================================
// INITIALIZATION (runs when page loads)
// =============================================
async function init() {
  await fetchMenu();
  renderCategories(); // Build category filter pills from CATEGORIES array
  renderMenu();       // Build menu item cards from MENU array
  updateCartBadge();  // Show "0" on cart badge
  updateAuthUI();     // Set header button based on saved session
}

init(); // Run initialization when page loads
