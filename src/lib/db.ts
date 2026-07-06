import { Pool } from 'pg';

let pool: Pool | null = null;

export const getDb = () => {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    throw new Error('Database URL is missing. Set DATABASE_URL or POSTGRES_URL.');
  }

  if (!pool) {
    let finalConnString = connString;
    
    // Auto-fix raw '@' in password if present
    if (finalConnString) {
      const parts = finalConnString.split('@');
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
            finalConnString = `${protocol}${username}:${encodeURIComponent(password)}@${hostDb}`;
          }
        }
      }
    }

    pool = new Pool({
      connectionString: finalConnString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  return pool;
};

export async function initDb() {
  try {
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
    await db.query(createTableQuery);
    console.log('[Database] tracker_logs table initialized successfully.');
  } catch (err) {
    console.error('[Database] Failed to initialize table:', err);
  }
}
