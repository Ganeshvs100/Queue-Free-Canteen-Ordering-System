const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so the client side can make AJAX requests from different origins
app.use(cors());
// Parse incoming JSON payloads
app.use(express.json());

// Serve static frontend assets (HTML, CSS, JS) from the public directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// =============================================
// DATABASE CONNECTION CONFIGURATION
// =============================================
// EDIT: Change database credentials here if your MySQL setup differs
const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'Ganeshvs@2006',
  database: process.env.MYSQLDATABASE || 'quickbite_canteen',
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('Database pool created successfully.');

    // Verification connection test
    const conn = await pool.getConnection();
    console.log('Connected to MySQL server successfully.');
    conn.release();

    // Seed default admin account if users table is empty
    await seedAdminUser();

  } catch (err) {
    console.error('Database initialization failed:', err.message);
    console.error('Please verify MySQL is running and database "quickbite_canteen" exists.');
  }
}

// Auto seed default Admin user on startup
async function seedAdminUser() {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (rows.length === 0) {
      console.log('No admin users found in database. Seeding default Admin...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Admin', 'admin@canteen.com', hashedPassword, 'admin']
      );
      console.log('Default admin user seeded successfully: admin@canteen.com / admin123');
    }
  } catch (err) {
    console.error('Failed to seed default admin:', err.message);
  }
}

// =============================================
// AUTHENTICATION API ENDPOINTS
// =============================================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email and password.' });
  }

  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // For security, admin accounts cannot be registered through this public endpoint.
    if (role === 'admin') {
      return res.status(403).json({ error: 'Registration of admin accounts is restricted for security.' });
    }
    const userRole = 'student';

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword, userRole]
    );

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: userRole
      }
    });

  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    // Find user by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Compare bcrypt hashes
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
});


// =============================================
// MENU API ENDPOINTS
// =============================================

// Get entire Menu
app.get('/api/menu', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM menu ORDER BY category, name');

    // Normalize DB data format (tinyint veg/available -> boolean) for frontend compatibility
    const items = rows.map(item => ({
      id: item.id,
      name: item.name,
      image: item.image,
      category: item.category,
      price: item.price,
      desc: item.description,
      time: item.prep_time,
      veg: item.veg === 1,
      available: item.available === 1
    }));

    res.json(items);
  } catch (err) {
    console.error('Fetch menu error:', err.message);
    res.status(500).json({ error: 'Failed to fetch menu items.' });
  }
});

// Add Menu Item (Admin)
app.post('/api/menu', async (req, res) => {
  const { name, image, category, price, desc, time, veg, available } = req.body;

  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Please provide name, category, and price.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO menu (name, image, category, price, description, prep_time, veg, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name,
        image || '🍽️',
        category,
        parseInt(price),
        desc || '',
        time || '5 min',
        veg ? 1 : 0,
        available ? 1 : 0
      ]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      image: image || '🍽️',
      category,
      price: parseInt(price),
      desc: desc || '',
      time: time || '5 min',
      veg: !!veg,
      available: !!available
    });
  } catch (err) {
    console.error('Add menu item error:', err.message);
    res.status(500).json({ error: 'Failed to add menu item.' });
  }
});

// Update Menu Item Details (Admin)
app.put('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image, category, price, desc, time, veg, available } = req.body;

  try {
    // Dynamically build update query based on fields provided
    await pool.query(
      `UPDATE menu SET 
        name = COALESCE(?, name),
        image = COALESCE(?, image),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        description = COALESCE(?, description),
        prep_time = COALESCE(?, prep_time),
        veg = COALESCE(?, veg),
        available = COALESCE(?, available)
       WHERE id = ?`,
      [
        name,
        image,
        category,
        price !== undefined ? parseInt(price) : null,
        desc,
        time,
        veg !== undefined ? (veg ? 1 : 0) : null,
        available !== undefined ? (available ? 1 : 0) : null,
        id
      ]
    );

    res.json({ message: 'Menu item updated successfully.' });
  } catch (err) {
    console.error('Update menu item error:', err.message);
    res.status(500).json({ error: 'Failed to update menu item.' });
  }
});

// Delete Menu Item (Admin)
app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM menu WHERE id = ?', [id]);
    res.json({ message: 'Menu item deleted successfully.' });
  } catch (err) {
    console.error('Delete menu item error:', err.message);
    res.status(500).json({ error: 'Failed to delete menu item. It may be linked to previous orders.' });
  }
});


// =============================================
// ORDER API ENDPOINTS (with Transactions)
// =============================================

// Place Order
app.post('/api/orders', async (req, res) => {
  const { id, token, userEmail, items, total, note, paymentMethod } = req.body;
  console.log('POST /api/orders - Placement Request received:', { id, token, userEmail, total, paymentMethod });

  if (!id || !items || items.length === 0 || !userEmail) {
    console.log('POST /api/orders - Validation failed: Missing structure fields.');
    return res.status(400).json({ error: 'Invalid order structure.' });
  }

  const conn = await pool.getConnection();

  try {
    // Start transactional process
    await conn.beginTransaction();

    // Get user ID from email
    const [users] = await conn.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (users.length === 0) {
      throw new Error(`User not found with email ${userEmail}`);
    }
    const userId = users[0].id;
    console.log(`POST /api/orders - User verified. ID resolved: ${userId}`);

    // Insert into orders table
    await conn.query(
      'INSERT INTO orders (id, token, user_id, total, status, note, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, token, userId, total, 'pending', note || '', paymentMethod]
    );
    console.log(`POST /api/orders - Main order entry inserted: ${id}`);

    // Insert order items
    for (const item of items) {
      // Find menu item ID based on name (safe fallback)
      const [menuMatch] = await conn.query('SELECT id FROM menu WHERE name = ? LIMIT 1', [item.name]);
      const menuId = menuMatch.length > 0 ? menuMatch[0].id : 1; // Default to ID 1 if not found

      await conn.query(
        'INSERT INTO order_items (order_id, menu_id, name, qty, price) VALUES (?, ?, ?, ?, ?)',
        [id, menuId, item.name, item.qty, item.price]
      );
    }
    console.log(`POST /api/orders - Items successfully inserted.`);

    // Commit Transaction
    await conn.commit();
    console.log(`POST /api/orders - Transaction committed successfully.`);
    res.status(201).json({ message: 'Order placed successfully.', orderId: id, token });

  } catch (err) {
    // Rollback changes on any error
    await conn.rollback();
    console.error('POST /api/orders - Transaction failed. Rolled back:', err.message);
    res.status(500).json({ error: 'Transaction failed. Order not placed.' });
  } finally {
    conn.release();
  }
});

// Get customer order history
app.get('/api/orders', async (req, res) => {
  const { email } = req.query;
  console.log(`GET /api/orders - Loading history for: ${email}`);

  if (!email) {
    return res.status(400).json({ error: 'User email is required.' });
  }

  try {
    // 1. Fetch user orders
    const [orders] = await pool.query(
      `SELECT o.*, u.name as userName FROM orders o 
       JOIN users u ON o.user_id = u.id 
       WHERE u.email = ? 
       ORDER BY o.created_at DESC`,
      [email]
    );

    if (orders.length === 0) {
      return res.json([]);
    }

    // 2. Load and group items for these orders
    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id IN (?)',
      [orderIds]
    );

    // Group items by order ID
    const groupedItems = {};
    items.forEach(it => {
      if (!groupedItems[it.order_id]) {
        groupedItems[it.order_id] = [];
      }
      groupedItems[it.order_id].push({
        name: it.name,
        qty: it.qty,
        price: it.price
      });
    });

    // Merge items into order objects
    const orderHistory = orders.map(o => ({
      id: o.id,
      token: o.token,
      userId: o.user_id,
      userName: o.userName,
      total: o.total,
      status: o.status,
      note: o.note,
      ts: new Date(o.created_at).getTime(),
      paymentMethod: o.payment_method,
      items: groupedItems[o.id] || []
    }));

    res.json(orderHistory);

  } catch (err) {
    console.error('GET /api/orders - Retrieval error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve order history.' });
  }
});

// Get active orders for Admin Dashboard (Pending, Preparing, Ready)
app.get('/api/admin/orders', async (req, res) => {
  console.log('GET /api/admin/orders - Loading queue...');
  try {
    // Fetch active orders (non-completed and non-cancelled)
    const [orders] = await pool.query(
      `SELECT o.*, u.name as userName, u.email as userEmail FROM orders o 
       JOIN users u ON o.user_id = u.id 
       WHERE o.status NOT IN ('completed', 'cancelled')
       ORDER BY o.created_at DESC`
    );

    console.log(`GET /api/admin/orders - Query found ${orders.length} active orders`);

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map(o => o.id);
    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id IN (?)',
      [orderIds]
    );

    // Group items by order ID
    const groupedItems = {};
    items.forEach(it => {
      if (!groupedItems[it.order_id]) groupedItems[it.order_id] = [];
      groupedItems[it.order_id].push({
        name: it.name,
        qty: it.qty,
        price: it.price
      });
    });

    const activeOrders = orders.map(o => ({
      id: o.id,
      token: o.token,
      userId: o.user_id,
      userName: o.userName,
      userEmail: o.userEmail,
      total: o.total,
      status: o.status,
      note: o.note,
      ts: new Date(o.created_at).getTime(),
      paymentMethod: o.payment_method,
      items: groupedItems[o.id] || []
    }));

    res.json(activeOrders);

  } catch (err) {
    console.error('GET /api/admin/orders - Retrieval error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve active orders.' });
  }
});

// Update order status (Admin)
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid order status.' });
  }

  try {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: `Order status updated to "${status}" successfully.` });
  } catch (err) {
    console.error('Update order status error:', err.message);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// Get analytics summaries (Admin)
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const [[totalStats]] = await pool.query(`
      SELECT 
        COUNT(id) as totalOrders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
        SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparingCount,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as readyCount,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as revenue
      FROM orders
    `);

    res.json({
      total: totalStats.totalOrders,
      pending: totalStats.pendingCount,
      preparing: totalStats.preparingCount,
      ready: totalStats.readyCount,
      revenue: totalStats.revenue
    });

  } catch (err) {
    console.error('Fetch analytics error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve sales analytics.' });
  }
});

// Get User lists (Admin)
app.get('/api/admin/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY role, name');
    res.json(users);
  } catch (err) {
    console.error('Fetch users list error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve users list.' });
  }
});

// Create User or Admin Account (Admin Console action)
app.post('/api/admin/users', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please provide name, email, password, and role.' });
  }

  const validRoles = ['student', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: role
      }
    });

  } catch (err) {
    console.error('Admin user creation error:', err.message);
    res.status(500).json({ error: 'Server error during user creation.' });
  }
});

// Initialize database connection and start listening
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Express Server running on http://localhost:${PORT}`);
  });
});
