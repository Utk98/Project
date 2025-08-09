require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const morgan = require('morgan');
const dayjs = require('dayjs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { getDatabase, DB_PATH } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VIEWS_DIR = path.join(__dirname, '..', 'views');
const DB_DIR = path.join(__dirname, '..', 'db');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// View engine
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

app.locals.dayjs = dayjs;
app.locals.isImage = function isImageAttachment(filePath) {
  return !!(filePath && /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath));
};
app.locals.isPdf = function isPdfAttachment(filePath) {
  return !!(filePath && /\.pdf$/i.test(filePath));
};

app.use(
  session({
    store: new SQLiteStore({ dir: DB_DIR, db: 'sessions.sqlite' }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Make current user available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// File uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename: function (_req, file, cb) {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, `${timestamp}_${safeName}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Database
const db = getDatabase();

// Seed admin user if none exists
function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.get('SELECT COUNT(*) as count FROM users', [], async (err, row) => {
    if (err) {
      console.error('Failed to check users table:', err);
      return;
    }
    if (row && row.count === 0) {
      try {
        const hash = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [
          username,
          hash,
          'admin',
        ]);
        console.log(`Admin user created: ${username} (change the password in .env)`);
      } catch (e) {
        console.error('Error seeding admin user:', e);
      }
    }
  });
}
ensureAdminUser();

// Auth helpers
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/admin/login');
}

// Public routes
app.get('/', (req, res) => {
  db.all(
    `SELECT id, title, content, category, attachment_path, created_at
     FROM notices WHERE is_published = 1
     ORDER BY created_at DESC LIMIT 10`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Database error');
      res.render('index', { user: req.session.user, notices: rows });
    }
  );
});

app.get('/notices', (req, res) => {
  const category = req.query.category || '';
  let sql = 'SELECT id, title, category, created_at FROM notices WHERE is_published = 1';
  const params = [];
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY created_at DESC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('notices/list', { user: req.session.user, notices: rows, category });
  });
});

app.get('/notices/:id', (req, res) => {
  db.get('SELECT * FROM notices WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Notice not found');
    res.render('notices/detail', { user: req.session.user, notice: row });
  });
});

app.get('/contacts', (_req, res) => {
  db.all('SELECT * FROM contacts ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('contacts/list', { user: null, contacts: rows });
  });
});

// Auth routes (admin + normal users)
app.get('/admin/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.render('admin/login', { error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.render('admin/login', { error: 'Invalid credentials' });
    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/market');
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Registration (normal users)
app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/market');
  res.render('auth/register', { error: null });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render('auth/register', { error: 'Username and password required' });
  db.get('SELECT id FROM users WHERE username = ?', [username], async (err, existing) => {
    if (err) return res.render('auth/register', { error: 'Database error' });
    if (existing) return res.render('auth/register', { error: 'Username already taken' });
    try {
      const hash = await bcrypt.hash(password, 10);
      db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, 'user'], function (e2) {
        if (e2) return res.render('auth/register', { error: 'Failed to register' });
        req.session.user = { id: this.lastID, username, role: 'user' };
        res.redirect('/market');
      });
    } catch (e) {
      return res.render('auth/register', { error: 'Failed to register' });
    }
  });
});

// Role guard
function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  return res.status(403).send('Admins only');
}

// Marketplace (buy/sell/rent/general)
app.get('/market', (req, res) => {
  const category = req.query.category || '';
  let sql = 'SELECT mp.*, u.username as author FROM market_posts mp LEFT JOIN users u ON u.id = mp.created_by WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND mp.category = ?'; params.push(category); }
  sql += ' ORDER BY mp.created_at DESC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send('Database error');
    res.render('market/list', { posts: rows, category });
  });
});

app.get('/market/new', requireAuth, (req, res) => {
  res.render('market/form', { post: null, error: null });
});

app.post('/market/new', requireAuth, upload.single('attachment'), (req, res) => {
  const { title, description, category, price, contact_name, contact_phone, contact_email } = req.body;
  if (!title || !description || !category) return res.render('market/form', { post: null, error: 'Title, description and category required' });
  const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
  db.run(
    `INSERT INTO market_posts (title, description, category, price, attachment_path, contact_name, contact_phone, contact_email, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, category, price || null, attachmentPath, contact_name || '', contact_phone || '', contact_email || '', req.session.user.id],
    function (err) {
      if (err) return res.render('market/form', { post: null, error: 'Failed to create post' });
      res.redirect(`/market/${this.lastID}`);
    }
  );
});

app.get('/market/:id', (req, res) => {
  db.get('SELECT mp.*, u.username as author FROM market_posts mp LEFT JOIN users u ON u.id = mp.created_by WHERE mp.id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Post not found');
    res.render('market/detail', { post: row });
  });
});

function canEditPost(req, post) {
  if (!req.session?.user) return false;
  if (req.session.user.role === 'admin') return true;
  return req.session.user.id === post.created_by;
}

app.get('/market/:id/edit', requireAuth, (req, res) => {
  db.get('SELECT * FROM market_posts WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Post not found');
    if (!canEditPost(req, row)) return res.status(403).send('Forbidden');
    res.render('market/form', { post: row, error: null });
  });
});

app.post('/market/:id/edit', requireAuth, upload.single('attachment'), (req, res) => {
  const { title, description, category, price, contact_name, contact_phone, contact_email } = req.body;
  db.get('SELECT * FROM market_posts WHERE id = ?', [req.params.id], (err, existing) => {
    if (err || !existing) return res.status(404).send('Post not found');
    if (!canEditPost(req, existing)) return res.status(403).send('Forbidden');
    const attachmentPath = req.file ? `/uploads/${req.file.filename}` : existing.attachment_path;
    db.run(
      `UPDATE market_posts SET title = ?, description = ?, category = ?, price = ?, attachment_path = ?, contact_name = ?, contact_phone = ?, contact_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, description, category, price || null, attachmentPath, contact_name || '', contact_phone || '', contact_email || '', req.params.id],
      function (e2) {
        if (e2) return res.render('market/form', { post: existing, error: 'Failed to update' });
        res.redirect(`/market/${req.params.id}`);
      }
    );
  });
});

app.post('/market/:id/delete', requireAuth, (req, res) => {
  db.get('SELECT * FROM market_posts WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Post not found');
    if (!canEditPost(req, row)) return res.status(403).send('Forbidden');
    db.run('DELETE FROM market_posts WHERE id = ?', [req.params.id], function (e2) {
      if (e2) return res.status(500).send('Failed to delete');
      res.redirect('/market');
    });
  });
});

// Admin routes
app.get('/admin/dashboard', requireAuth, (req, res) => {
  db.get('SELECT COUNT(*) as c FROM notices', [], (e1, n) => {
    db.get('SELECT COUNT(*) as c FROM contacts', [], (e2, c) => {
      res.render('admin/dashboard', {
        user: req.session.user,
        counts: { notices: n ? n.c : 0, contacts: c ? c.c : 0 },
        dbPath: DB_PATH,
      });
    });
  });
});

// Create notice
app.get('/admin/notices/new', requireAuth, (req, res) => {
  res.render('admin/notices/form', { notice: null, error: null });
});

app.post('/admin/notices/new', requireAuth, upload.single('attachment'), (req, res) => {
  const { title, content, category } = req.body;
  const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
  if (!title || !content) return res.render('admin/notices/form', { notice: null, error: 'Title and content are required' });
  db.run(
    `INSERT INTO notices (title, content, category, attachment_path, created_by) VALUES (?, ?, ?, ?, ?)`,
    [title, content, category || 'announcement', attachmentPath, req.session.user.id],
    function (err) {
      if (err) return res.render('admin/notices/form', { notice: null, error: 'Failed to create notice' });
      res.redirect(`/notices/${this.lastID}`);
    }
  );
});

// Edit notice
app.get('/admin/notices/:id/edit', requireAuth, (req, res) => {
  db.get('SELECT * FROM notices WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Notice not found');
    res.render('admin/notices/form', { notice: row, error: null });
  });
});

app.post('/admin/notices/:id/edit', requireAuth, upload.single('attachment'), (req, res) => {
  const { title, content, category, is_published } = req.body;
  const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;
  db.get('SELECT * FROM notices WHERE id = ?', [req.params.id], (err, existing) => {
    if (err || !existing) return res.status(404).send('Notice not found');
    const newAttachment = attachmentPath || existing.attachment_path;
    db.run(
      `UPDATE notices SET title = ?, content = ?, category = ?, attachment_path = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, content, category || existing.category, newAttachment, is_published ? 1 : 0, req.params.id],
      function (e2) {
        if (e2) return res.render('admin/notices/form', { notice: existing, error: 'Failed to update notice' });
        res.redirect(`/notices/${req.params.id}`);
      }
    );
  });
});

app.post('/admin/notices/:id/delete', requireAuth, (req, res) => {
  db.run('DELETE FROM notices WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).send('Failed to delete');
    res.redirect('/');
  });
});

// Contacts admin
app.get('/admin/contacts/new', requireAuth, (req, res) => {
  res.render('admin/contacts/form', { contact: null, error: null });
});

app.post('/admin/contacts/new', requireAuth, (req, res) => {
  const { name, role, phone, email } = req.body;
  if (!name) return res.render('admin/contacts/form', { contact: null, error: 'Name is required' });
  db.run(
    'INSERT INTO contacts (name, role, phone, email) VALUES (?, ?, ?, ?)',
    [name, role || '', phone || '', email || ''],
    function (err) {
      if (err) return res.render('admin/contacts/form', { contact: null, error: 'Failed to add contact' });
      res.redirect('/contacts');
    }
  );
});

app.get('/admin/contacts/:id/edit', requireAuth, (req, res) => {
  db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row) return res.status(404).send('Contact not found');
    res.render('admin/contacts/form', { contact: row, error: null });
  });
});

app.post('/admin/contacts/:id/edit', requireAuth, (req, res) => {
  const { name, role, phone, email } = req.body;
  db.run(
    'UPDATE contacts SET name = ?, role = ?, phone = ?, email = ? WHERE id = ?',
    [name, role || '', phone || '', email || '', req.params.id],
    function (err) {
      if (err) return res.render('admin/contacts/form', { contact: { id: req.params.id, name, role, phone, email }, error: 'Failed to update contact' });
      res.redirect('/contacts');
    }
  );
});

app.post('/admin/contacts/:id/delete', requireAuth, (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).send('Failed to delete contact');
    res.redirect('/contacts');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`School Notice Board running on http://localhost:${PORT}`);
});


