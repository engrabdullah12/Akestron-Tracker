import express from 'express';
import { dbGet, dbRun, dbAll } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get active time tracker status for current user
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const activeLog = await dbGet(
      'SELECT id, task_description, start_time FROM time_logs WHERE user_id = ? AND is_active = 1',
      [req.user.id]
    );
    if (activeLog) {
      return res.json({ active: true, log: activeLog });
    }
    return res.json({ active: false });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ message: 'Error checking tracker status' });
  }
});

// Start tracking a task
router.post('/start', authenticateToken, async (req, res) => {
  const { task_description } = req.body;
  const userId = req.user.id;
  const startTime = new Date().toISOString();

  try {
    // 1. Automatically stop any active log running for the user to prevent orphaned sessions
    const activeLog = await dbGet(
      'SELECT * FROM time_logs WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    if (activeLog) {
      const endTime = new Date().toISOString();
      const duration = Math.max(0, Math.round((new Date(endTime) - new Date(activeLog.start_time)) / 1000));
      await dbRun(
        'UPDATE time_logs SET end_time = ?, duration_seconds = ?, is_active = 0 WHERE id = ?',
        [endTime, duration, activeLog.id]
      );
    }

    // 2. Start a new log
    const result = await dbRun(
      'INSERT INTO time_logs (user_id, task_description, start_time, is_active) VALUES (?, ?, ?, 1)',
      [userId, task_description || 'Working on Akestron Task', startTime]
    );

    const newLog = await dbGet('SELECT * FROM time_logs WHERE id = ?', [result.id]);
    res.status(201).json({ message: 'Time tracking started', log: newLog });
  } catch (error) {
    console.error('Error starting tracker:', error);
    res.status(500).json({ message: 'Error starting time tracker' });
  }
});

// Stop current tracking task
router.post('/stop', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const endTime = new Date().toISOString();

  try {
    const activeLog = await dbGet(
      'SELECT * FROM time_logs WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    if (!activeLog) {
      return res.status(400).json({ message: 'No active tracking session found' });
    }

    const duration = Math.max(0, Math.round((new Date(endTime) - new Date(activeLog.start_time)) / 1000));

    await dbRun(
      'UPDATE time_logs SET end_time = ?, duration_seconds = ?, is_active = 0 WHERE id = ?',
      [endTime, duration, activeLog.id]
    );

    const updatedLog = await dbGet('SELECT * FROM time_logs WHERE id = ?', [activeLog.id]);
    res.json({ message: 'Time tracking stopped', log: updatedLog });
  } catch (error) {
    console.error('Error stopping tracker:', error);
    res.status(500).json({ message: 'Error stopping time tracker' });
  }
});

// Get user's completed logs
router.get('/my-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await dbAll(
      'SELECT * FROM time_logs WHERE user_id = ? AND is_active = 0 ORDER BY start_time DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching user logs:', error);
    res.status(500).json({ message: 'Error fetching time logs' });
  }
});

export default router;
