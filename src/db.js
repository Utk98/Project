const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const isVercel = !!process.env.VERCEL;
const DB_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'db');
const DB_PATH = path.join(DB_DIR, 'app.sqlite');

function ensureDatabaseDirectoryExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function openDatabase() {
  ensureDatabaseDirectoryExists();
  const database = new sqlite3.Database(DB_PATH);
  return database;
}

function initializeSchema(database) {
  database.serialize(() => {
    database.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );

    database.run(
      `CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'announcement',
        attachment_path TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY(created_by) REFERENCES users(id)
      )`
    );

    database.run(
      `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT,
        phone TEXT,
        email TEXT
      )`
    );

    database.run(
      `CREATE TABLE IF NOT EXISTS market_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('buy','sell','rent','general')),
        price REAL,
        attachment_path TEXT,
        contact_name TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY(created_by) REFERENCES users(id)
      )`
    );
  });
}

module.exports = {
  getDatabase() {
    const database = openDatabase();
    initializeSchema(database);
    return database;
  },
  DB_PATH,
};


