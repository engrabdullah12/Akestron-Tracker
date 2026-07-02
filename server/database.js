import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect if we should use PostgreSQL (production/cloud) or SQLite (local development)
const isPostgres = !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  console.log('[Database] Connecting to PostgreSQL database (Production Mode)...');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for hosted databases like Supabase and Neon
    }
  });
} else {
  console.log('[Database] Connecting to SQLite database (Local Dev)...');
  const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'database.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Could not connect to SQLite database:', err.message);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
    }
  });
}

// Helper to convert SQLite "?" placeholders to PostgreSQL "$1, $2, ..." placeholders
const convertSqlPlaceholders = (sql) => {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

export const dbRun = async (sql, params = []) => {
  const pgSql = convertSqlPlaceholders(sql);
  
  if (isPostgres) {
    let adaptedSql = pgSql;
    // PostgreSQL requires a RETURNING clause to get the inserted record's ID
    if (sql.trim().toUpperCase().startsWith('INSERT INTO') && !sql.toUpperCase().includes('RETURNING')) {
      adaptedSql += ' RETURNING id';
    }

    const res = await pgPool.query(adaptedSql, params);
    const lastID = res.rows[0]?.id || null;
    return { id: lastID, changes: res.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

export const dbGet = async (sql, params = []) => {
  const pgSql = convertSqlPlaceholders(sql);
  
  if (isPostgres) {
    const res = await pgPool.query(pgSql, params);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const dbAll = async (sql, params = []) => {
  const pgSql = convertSqlPlaceholders(sql);
  
  if (isPostgres) {
    const res = await pgPool.query(pgSql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize database tables
export const initDb = async () => {
  let usersTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  let logsTableSql = `
    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_description TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0, -- 1 = active, 0 = stopped
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  if (isPostgres) {
    // Adapt tables to PostgreSQL types
    usersTableSql = usersTableSql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY');
    logsTableSql = logsTableSql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY');
  }

  try {
    await dbRun(usersTableSql);
    await dbRun(logsTableSql);
    console.log('[Database] Database tables verified/created successfully.');
  } catch (error) {
    console.error('[Database] Error initializing database tables:', error);
    throw error;
  }
};

export default { dbRun, dbGet, dbAll, initDb };
