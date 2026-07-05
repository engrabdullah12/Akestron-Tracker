import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect database mode based on POSTGRES_URL or DATABASE_URL existence
const isPostgres = !!process.env.POSTGRES_URL || !!process.env.DATABASE_URL;

let pgPool = null;
let sqliteDb = null;

// Lazy getter for PG connection pool to prevent synchronous boot-time URL parsing crashes
const getPgPool = () => {
  if (!isPostgres) {
    throw new Error('Database is not configured for PostgreSQL mode.');
  }
  
  if (!pgPool) {
    console.log('[Database] Creating PostgreSQL connection pool...');
    let connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    // Auto-fix raw '@' in password if present in the connection string
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

// Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, ...)
const convertSqlPlaceholders = (sql) => {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

export const dbRun = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSqlPlaceholders(sql);
    let adaptedSql = pgSql;
    if (sql.trim().toUpperCase().startsWith('INSERT INTO') && !sql.toUpperCase().includes('RETURNING')) {
      adaptedSql += ' RETURNING id';
    }
    const res = await getPgPool().query(adaptedSql, params);
    const lastID = res.rows[0]?.id || null;
    return { id: lastID, changes: res.rowCount };
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) {
        return reject(new Error('SQLite database not initialized. Please configure DATABASE_URL or check your local setup.'));
      }
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

export const dbGet = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSqlPlaceholders(sql);
    const res = await getPgPool().query(pgSql, params);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) return reject(new Error('SQLite database not initialized.'));
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const dbAll = async (sql, params = []) => {
  if (isPostgres) {
    const pgSql = convertSqlPlaceholders(sql);
    const res = await getPgPool().query(pgSql, params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      if (!sqliteDb) return reject(new Error('SQLite database not initialized.'));
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize database tables
export const initDb = async () => {
  if (process.env.VERCEL && !isPostgres) {
    throw new Error('FATAL: POSTGRES_URL environment variable is missing on Vercel! Please add Vercel Postgres to your project.');
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
      console.error('[Database] Failed to load sqlite3 package dynamically:', err);
      throw new Error('Failed to load sqlite3 package for local database. Run "npm install sqlite3" or configure DATABASE_URL.');
    }
  }

  let logsTableSql = `
    CREATE TABLE IF NOT EXISTS team_time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      task_description TEXT,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0, -- 1 = active, 0 = stopped
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  if (isPostgres) {
    logsTableSql = logsTableSql.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY');
  }

  try {
    await dbRun(logsTableSql);
    console.log(`[Database] Database tables verified/created successfully on ${isPostgres ? 'PostgreSQL (Vercel/Cloud)' : 'SQLite (Local)'}.`);
  } catch (error) {
    console.error('[Database] Error initializing database tables:', error);
    throw error;
  }
};

export default { dbRun, dbGet, dbAll, initDb };


