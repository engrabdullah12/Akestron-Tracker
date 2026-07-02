import express from 'express';
import { dbAll } from '../database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply auth & admin checks to all routes in this router
router.use(authenticateToken);
router.use(requireAdmin);

// Get list of all users in the agency (for filters / management)
router.get('/users', async (req, res) => {
  try {
    const users = await dbAll(
      'SELECT id, name, email, role, created_at FROM users ORDER BY name ASC'
    );
    res.json({ users });
  } catch (error) {
    console.error('Error fetching admin users list:', error);
    res.status(500).json({ message: 'Error fetching users list' });
  }
});

// Get currently active tracking sessions for all users
router.get('/active', async (req, res) => {
  try {
    const activeSessions = await dbAll(`
      SELECT 
        tl.id, 
        tl.user_id, 
        tl.task_description, 
        tl.start_time,
        u.name as user_name,
        u.email as user_email
      FROM time_logs tl
      JOIN users u ON tl.user_id = u.id
      WHERE tl.is_active = 1
      ORDER BY tl.start_time DESC
    `);
    res.json({ activeSessions });
  } catch (error) {
    console.error('Error fetching active admin sessions:', error);
    res.status(500).json({ message: 'Error fetching active tracking sessions' });
  }
});

// Get all completed logs across the team, with optional userId filter
router.get('/logs', async (req, res) => {
  const { userId } = req.query;
  let sql = `
    SELECT 
      tl.id, 
      tl.user_id, 
      tl.task_description, 
      tl.start_time, 
      tl.end_time, 
      tl.duration_seconds,
      u.name as user_name,
      u.email as user_email
    FROM time_logs tl
    JOIN users u ON tl.user_id = u.id
    WHERE tl.is_active = 0
  `;
  const params = [];

  if (userId) {
    sql += ' AND tl.user_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY tl.start_time DESC LIMIT 1000';

  try {
    const logs = await dbAll(sql, params);
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching all logs for admin:', error);
    res.status(500).json({ message: 'Error fetching team logs' });
  }
});

export default router;
