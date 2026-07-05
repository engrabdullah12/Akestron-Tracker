import { Pool } from 'pg';

const isPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
let pool: Pool | null = null;

export const getDb = () => {
  if (!isPostgres) {
    throw new Error('Database URL is missing. Set DATABASE_URL or POSTGRES_URL.');
  }

  if (!pool) {
    let connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    // Auto-fix raw '@' in password if present
    if (connString) {
      const parts = connString.split('@');
      if (parts.length > 2) {
        const hostDb = parts.pop(); 
        const auth = parts.join('@'); 
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
    }

    pool = new Pool({
      connectionString: connString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  return pool;
};

export async function initDb() {
  const db = getDb();
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tracker_logs (
      id SERIAL PRIMARY KEY,
      team_member_name TEXT NOT NULL,
      task_description TEXT NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', -- 'active' or 'completed'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await db.query(createTableQuery);
    console.log('[Database] tracker_logs table initialized successfully.');
  } catch (err) {
    console.error('[Database] Failed to initialize table:', err);
  }
}
