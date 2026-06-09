// =============================================
// QuickBite Admin Console Panel | admin.js
// =============================================

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
   return 'https://queue-free-canteen-ordering-system.onrender.com/api';
  // return window.location.origin + '/api';
}
const API_URL = getApiUrl();

// Current Section State
let activeSection = 'dashboard';

// Dynamic Data Store
let orders = [];
let menuItems = [];
let users = [];

// =============================================
// ACCESS PROTECTION & ROLE VERIFICATION
// =============================================
function checkAdminAccess() {
  const user = JSON.parse(localStorage.getItem('qb_user') || 'null');
  
  if (!user || user.role !== 'admin') {
    alert('Access Denied. Canteen Admin credentials required.');
    window.location.href = '../index.html';
    return;
  }
  
  // Credentials approved. Customize display and hide loader.
  document.getElementById('adminNameDisplay').textContent = user.name;
  
  setTimeout(() => {
    const overlay = document.getElementById('protectionOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 400); // Remove from DOM after fade out
    }
  }, 600);
}

// Initialise authentication check immediately
checkAdminAccess();

// =============================================
// SECTION SWITCHING CONTROL
// =============================================
function switchSection(sectionId) {
  activeSection = sectionId;
  
  // 1. Update navigation active styles
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Match index based on order
  const tabs = ['dashboard', 'orders', 'menu', 'users'];
  const idx = tabs.indexOf(sectionId);
  if (idx !== -1) {
    document.querySelectorAll('.nav-item')[idx].classList.add('active');
  }

  // 2. Display the correct section block
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(`sec-${sectionId}`).classList.add('active');

  // 3. Customize main headers
  const titleEl = document.getElementById('currentSectionTitle');
  const subEl = document.getElementById('currentSectionSub');

  if (sectionId === 'dashboard') {
    titleEl.textContent = 'Analytics Dashboard';
    subEl.textContent = 'Overview of your canteen\'s sales and performance.';
  } else if (sectionId === 'orders') {
    titleEl.textContent = 'Live Orders Queue';
    subEl.textContent = 'Drag, track, and update preparation pipeline in real-time.';
  } else if (sectionId === 'menu') {
    titleEl.textContent = 'Menu Management';
    subEl.textContent = 'Add, remove, toggle stock availability, and adjust pricing.';
  } else if (sectionId === 'users') {
    titleEl.textContent = 'User Registry';
    subEl.textContent = 'Listing of all registered customers and managers.';
  }
  
  reloadData();
}

// =============================================
// BACKEND API AJAX CONTEXT
// =============================================

// Refresh data from backend Express REST routes
async function reloadData() {
  const refreshBtn = document.querySelector('.btn-refresh');
  if (refreshBtn) refreshBtn.textContent = '🔄 Loading...';

  try {
    await Promise.all([
      fetchAnalytics(),
      fetchOrders(),
      fetchMenu(),
      fetchUsers()
    ]);
  } catch (err) {
    console.error('Error loading backend data:', err);
    showToast('Failed to pull fresh data from server.');
  } finally {
    if (refreshBtn) refreshBtn.textContent = '🔄 Refresh Data';
  }
}

// Load metric counters from database
async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_URL}/admin/analytics`);
    if (!res.ok) throw new Error('Failed to load metrics.');
    
    const stats = await res.json();
    document.getElementById('statRevenue').textContent = formatPrice(stats.revenue);
    document.getElementById('statOrders').textContent = stats.total;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statPreparing').textContent = stats.preparing;
    document.getElementById('statReady').textContent = stats.ready;
  } catch (err) {
    console.error(err);
  }
}

// Load live orders queue
async function fetchOrders() {
  try {
    const res = await fetch(`${API_URL}/admin/orders`);
    if (!res.ok) throw new Error('Failed to load active orders.');
    
    orders = await res.json();
    renderOrdersBoard();
  } catch (err) {
    console.error(err);
  }
}

// Load dynamic menu items list
async function fetchMenu() {
  try {
    const res = await fetch(`${API_URL}/menu`);
    if (!res.ok) throw new Error('Failed to load menu list.');
    
    menuItems = await res.json();
    renderMenuTable();
  } catch (err) {
    console.error(err);
  }
}

// Load registered user registry
async function fetchUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`);
    if (!res.ok) throw new Error('Failed to load users list.');
    
    users = await res.json();
    renderUsersTable();
  } catch (err) {
    console.error(err);
  }
}

// =============================================
// DOM RENDERING METHODS
// =============================================

// Renders columns in the Kanban order pipeline
function renderOrdersBoard() {
  const pendingCol = document.getElementById('list-pending');
  const preparingCol = document.getElementById('list-preparing');
  const readyCol = document.getElementById('list-ready');

  // Filter lists by status
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  // Set column header badge counts
  document.getElementById('badge-pending').textContent = pendingOrders.length;
  document.getElementById('badge-preparing').textContent = preparingOrders.length;
  document.getElementById('badge-ready').textContent = readyOrders.length;
  
  // Sidebar notification badge
  const sidebarBadge = document.getElementById('liveOrdersBadge');
  const totalActive = pendingOrders.length + preparingOrders.length + readyOrders.length;
  if (totalActive > 0) {
    sidebarBadge.textContent = totalActive;
    sidebarBadge.style.display = 'inline-block';
  } else {
    sidebarBadge.style.display = 'none';
  }

  // Populate Pending Column
  if (pendingOrders.length === 0) {
    pendingCol.innerHTML = '<p class="empty-msg">No pending orders.</p>';
  } else {
    pendingCol.innerHTML = pendingOrders.map(o => renderOrderCard(o, 'pending')).join('');
  }

  // Populate Preparing Column
  if (preparingOrders.length === 0) {
    preparingCol.innerHTML = '<p class="empty-msg">No orders being prepared.</p>';
  } else {
    preparingCol.innerHTML = preparingOrders.map(o => renderOrderCard(o, 'preparing')).join('');
  }

  // Populate Ready Column
  if (readyOrders.length === 0) {
    readyCol.innerHTML = '<p class="empty-msg">No orders ready.</p>';
  } else {
    readyCol.innerHTML = readyOrders.map(o => renderOrderCard(o, 'ready')).join('');
  }
}

// Generate single card markup
function renderOrderCard(order, columnStatus) {
  // Format items list
  const itemsList = order.items.map(it => `${it.name} ×${it.qty}`).join(', ');

  // Action buttons
  let actionButtons = '';
  if (columnStatus === 'pending') {
    actionButtons = `
      <div class="admin-card-actions">
        <button class="btn-card-action cancel" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
        <button class="btn-card-action accept" onclick="updateOrderStatus('${order.id}', 'preparing')">▶ Prepare</button>
      </div>
    `;
  } else if (columnStatus === 'preparing') {
    actionButtons = `
      <div class="admin-card-actions">
        <button class="btn-card-action ready" onclick="updateOrderStatus('${order.id}', 'ready')">🔔 Ready</button>
      </div>
    `;
  } else if (columnStatus === 'ready') {
    actionButtons = `
      <div class="admin-card-actions">
        <button class="btn-card-action complete" onclick="updateOrderStatus('${order.id}', 'completed')">✓ Deliver</button>
      </div>
    `;
  }

  return `
    <div class="order-card" id="card-${order.id}">
      <div class="order-card-top">
        <span class="order-card-token">Token #${order.token}</span>
        <span class="order-card-time">${timeAgo(order.ts)}</span>
      </div>
      <div class="order-card-user">👤 ${order.userName}</div>
      <div class="order-card-items">${itemsList}</div>
      ${order.note ? `<div class="order-card-note">📝 Note: ${order.note}</div>` : ''}
      <div class="order-card-bottom">
        <span class="order-card-price">${formatPrice(order.total)}</span>
        <span class="order-card-time">${order.paymentMethod.toUpperCase()}</span>
      </div>
      ${actionButtons}
    </div>
  `;
}

// Renders Menu list table
function renderMenuTable() {
  const tbody = document.getElementById('menuTableBody');
  if (menuItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted)">No menu items found.</td></tr>';
    return;
  }

  tbody.innerHTML = menuItems.map(item => {
    return `
      <tr id="menu-row-${item.id}">
        <td>
          <img src="${item.image}" alt="${item.name}" class="table-thumb" onerror="this.src='../images/fallback.png';this.style.display='none'" />
        </td>
        <td><strong>${item.name}</strong><br><small style="color:var(--text-muted)">${item.desc || 'No description'}</small></td>
        <td>${item.category}</td>
        <td><strong>${formatPrice(item.price)}</strong></td>
        <td>
          <span class="table-badge ${item.veg ? 'veg' : 'nonveg'}">${item.veg ? 'Veg' : 'Non-Veg'}</span>
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" ${item.available ? 'checked' : ''} onchange="toggleAvailability(${item.id}, ${item.available})" />
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-table-icon" onclick="openEditMenuModal(${item.id})" title="Edit Item">✏️</button>
            <button class="btn-table-icon delete" onclick="deleteMenuItem(${item.id})" title="Delete Item">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Renders user registry table
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted)">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const formattedDate = new Date(u.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    return `
      <tr>
        <td>#${u.id}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td><span class="table-badge" style="background:var(--surface); color:var(--text)">${u.role.toUpperCase()}</span></td>
        <td>${formattedDate}</td>
      </tr>
    `;
  }).join('');
}

// =============================================
// INTERACTIVE STATUS ACTIONS
// =============================================

// Update status of order
async function updateOrderStatus(orderId, nextStatus) {
  try {
    const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!res.ok) throw new Error('Failed to update status.');
    
    showToast(`Order status updated to ${nextStatus}.`);
    reloadData(); // Refresh metrics and pipeline columns
  } catch (err) {
    console.error(err);
    showToast('Failed to update order status.');
  }
}

// Toggle availability slider directly on the table
async function toggleAvailability(itemId, currentAvailable) {
  try {
    const res = await fetch(`${API_URL}/menu/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !currentAvailable })
    });

    if (!res.ok) throw new Error('Failed to update availability.');
    
    showToast('Item stock status updated.');
    reloadData();
  } catch (err) {
    console.error(err);
    showToast('Failed to update item status.');
  }
}

// Delete a menu item from database
async function deleteMenuItem(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  if (!confirm(`Are you sure you want to permanently delete "${item.name}" from the menu?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/menu/${itemId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      let data = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      }
      throw new Error(data.error || `Server error: ${res.status} ${res.statusText}`);
    }

    showToast(`"${item.name}" deleted from menu.`);
    reloadData();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Cannot delete item (linked to active orders).');
    reloadData(); // resets checkboxes
  }
}

// =============================================
// MODAL FORMS MANAGEMENT (ADD / EDIT)
// =============================================
function openAddMenuModal() {
  document.getElementById('modalTitle').textContent = 'Add Food Item';
  document.getElementById('menuForm').reset();
  document.getElementById('menuItemId').value = '';
  document.getElementById('menuModal').classList.add('open');
}

function openEditMenuModal(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('modalTitle').textContent = 'Edit Food Item';
  document.getElementById('menuItemId').value = item.id;
  document.getElementById('menuName').value = item.name;
  document.getElementById('menuImage').value = item.image;
  document.getElementById('menuCategory').value = item.category;
  document.getElementById('menuPrice').value = item.price;
  document.getElementById('menuTime').value = item.time;
  document.getElementById('menuVeg').value = item.veg ? 'true' : 'false';
  document.getElementById('menuDesc').value = item.desc || '';
  document.getElementById('menuAvailable').checked = item.available;

  document.getElementById('menuModal').classList.add('open');
}

function closeMenuModal() {
  document.getElementById('menuModal').classList.remove('open');
}

// Save MenuItem (Handles both post and put)
async function saveMenuItem(e) {
  e.preventDefault();

  const id = document.getElementById('menuItemId').value;
  const name = document.getElementById('menuName').value.trim();
  const image = document.getElementById('menuImage').value.trim();
  const category = document.getElementById('menuCategory').value;
  const price = document.getElementById('menuPrice').value;
  const time = document.getElementById('menuTime').value.trim();
  const veg = document.getElementById('menuVeg').value === 'true';
  const desc = document.getElementById('menuDesc').value.trim();
  const available = document.getElementById('menuAvailable').checked;

  const payload = { name, image, category, price, time, veg, desc, available };

  try {
    let res;
    if (id) {
      // --- UPDATE (PUT) ---
      res = await fetch(`${API_URL}/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // --- CREATE (POST) ---
      res = await fetch(`${API_URL}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) throw new Error('Save failed.');

    showToast(id ? 'Menu item updated successfully.' : 'New food item added.');
    closeMenuModal();
    reloadData();

  } catch (err) {
    console.error(err);
    showToast('Failed to save menu item.');
  }
}

// =============================================
// USER MANAGER MODAL (ADD NEW USER / ADMIN)
// =============================================
function openAddUserModal() {
  document.getElementById('userForm').reset();
  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('open');
}

async function saveUser(e) {
  e.preventDefault();

  const name = document.getElementById('userRegName').value.trim();
  const email = document.getElementById('userRegEmail').value.trim();
  const password = document.getElementById('userRegPassword').value;
  const role = document.getElementById('userRegRole').value;

  const payload = { name, email, password, role };

  try {
    const res = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    }

    if (!res.ok) {
      throw new Error(data.error || `Server error: ${res.status} ${res.statusText}`);
    }

    showToast(`User "${name}" created successfully as ${role.toUpperCase()}!`);
    closeUserModal();
    reloadData(); // Refresh the table and analytics count

  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to create user.');
  }
}

// =============================================
// UTILITIES (TIME / PRICE / LOGOUT / TOAST)
// =============================================

function formatPrice(p) {
  return `₹${p}`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)} min ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function logoutAdmin() {
  localStorage.removeItem('qb_user'); // log out session
  window.location.href = '../index.html'; // back to client home
}

// Temporary popup message toast
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;

  t.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: var(--surface2); color: var(--text); border: 1px solid var(--border);
    padding: 12px 24px; border-radius: 99px; font-size: 0.9rem; font-weight: 600;
    z-index: 9999; box-shadow: var(--shadow); opacity: 0;
    transition: opacity 0.3s, transform 0.3s; pointer-events: none;
    backdrop-filter: blur(10px); white-space: nowrap;
  `;
  document.body.appendChild(t);

  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => t.remove(), 400);
  }, 2600);
}

// Initial load
reloadData();

// Auto-refresh orders and stats every 30 seconds for live panel feel
setInterval(() => {
  if (activeSection === 'orders' || activeSection === 'dashboard') {
    fetchOrders();
    fetchAnalytics();
  }
}, 30000);
