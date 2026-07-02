import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect database mode
const isPostgres = !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

// Lazy getter for PG connection pool to prevent synchronous boot-time URL parsing crashes
const getPgPool = () => {
  if (!isPostgres) {
    throw new Error('Database is not configured for PostgreSQL mode.');
  }
  if (!pgPool) {
    console.log('[Database] Creating PostgreSQL connection pool...');
    // Handle URL encoding of password if the user pasted a raw '@' in the password
    let connString = process.env.DATABASE_URL;
    
    // Auto-fix raw '@' in password if present
    // A connection string usually looks like: postgres://user:password@host/db
    // If there are multiple '@' characters, the password contains one, which needs to be encoded.
    const parts = connString.split('@');
    if (parts.length > 2) {
      console.log('[Database] Auto-encoding special characters in database URL...');
      const hostDb = parts.pop(); // The last part is host/db
      const auth = parts.join('@'); // Join the rest (user:password)
      const protocolIndex = auth.indexOf('://');
      if (protocolIndex !== -1) {
        const protocol = auth.substring(0, protocolIndex + 3);
        const credentials = auth.substring(protocolIndex + 3);
        const credParts = credentials.split(':');
        if (credParts.length > 1) {
          const username = credParts[0];
          const password = credParts.slice(1).join(':');
          connString = `${protocol}${username}:${encodeURIComponent(password)}@${hostDb}`;
        }
      }
    }

    pgPool = new pg.Pool({
      connectionString: connString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pgPool;
};

// Convert placeholders
const convertSqlPlaceholders = (sql) => {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

export const dbRun = async (sql, params = []) => {
  const pgSql = convertSqlPlaceholders(sql);
  
  if (isPostgres) {
    let adaptedSql = pgSql;
    if (sql.trim().toUpperCase().startsWith('INSERT INTO') && !sql.toUpperCase().includes('RETURNING')) {
      adaptedSql += ' RETURNING id';
    }
    const res = await getPgPool().query(adaptedSql, params);
    const lastID = res.rows[0]?.id || null;
    return { id: lastID, changes: res.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) return reject(new Error('SQLite database not initialized'));
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
    const res = await getPgPool().query(pgSql, params);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) return reject(new Error('SQLite database not initialized'));
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
    const res = await getPgPool().query(pgSql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) return reject(new Error('SQLite database not initialized'));
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize database tables
export const initDb = async () => {
  // Validate that Vercel has the database url configured
  if (process.env.VERCEL && !isPostgres) {
    throw new Error('FATAL: DATABASE_URL environment variable is missing on Vercel! Please add your Supabase connection string in your Vercel Project Settings.');
  }

  // Dynamically import sqlite3 only in SQLite local mode
  if (!isPostgres && !sqliteDb) {
    try {
      const sqliteModuleName = 'sqlite3';
      const sqlite3Module = await import(sqliteModuleName);
      const sqlite3 = sqlite3Module.default;
      const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'database.db');
      
      sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Could not connect to SQLite database:', err.message);
        } else {
          console.log('Connected to SQLite database at:', dbPath);
        }
      });
    } catch (err) {
      console.error('Failed to dynamically load sqlite3:', err);
      throw err;
    }
  }

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
      is_active INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  if (isPostgres) {
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
