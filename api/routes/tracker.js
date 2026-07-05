import express from 'express';
import { dbGet, dbRun, dbAll } from '../database.js';

const router = express.Router();

// Get active time tracker status for current user
router.get('/status', async (req, res) => {
  const userName = req.query.userName;
  if (!userName) return res.status(400).json({ message: 'userName is required' });

  try {
    const activeLog = await dbGet(
      'SELECT id, task_description, start_time FROM team_time_logs WHERE user_name = ? AND is_active = 1',
      [userName]
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
router.post('/start', async (req, res) => {
  const { task_description, userName } = req.body;
  if (!userName) return res.status(400).json({ message: 'userName is required' });

  const startTime = new Date().toISOString();

  try {
    // 1. Automatically stop any active log running for the user
    const activeLog = await dbGet(
      'SELECT * FROM team_time_logs WHERE user_name = ? AND is_active = 1',
      [userName]
    );

    if (activeLog) {
      const endTime = new Date().toISOString();
      const duration = Math.max(0, Math.round((new Date(endTime) - new Date(activeLog.start_time)) / 1000));
      await dbRun(
        'UPDATE team_time_logs SET end_time = ?, duration_seconds = ?, is_active = 0 WHERE id = ?',
        [endTime, duration, activeLog.id]
      );
    }

    // 2. Start a new log
    const result = await dbRun(
      'INSERT INTO team_time_logs (user_name, task_description, start_time, is_active) VALUES (?, ?, ?, 1)',
      [userName, task_description || 'Working on Akestron Task', startTime]
    );

    const newLog = await dbGet('SELECT * FROM team_time_logs WHERE id = ?', [result.id]);
    res.status(201).json({ message: 'Time tracking started', log: newLog });
  } catch (error) {
    console.error('Error starting tracker:', error);
    res.status(500).json({ message: 'Error starting time tracker' });
  }
});

// Stop current tracking task
router.post('/stop', async (req, res) => {
  const { userName } = req.body;
  if (!userName) return res.status(400).json({ message: 'userName is required' });

  const endTime = new Date().toISOString();

  try {
    const activeLog = await dbGet(
      'SELECT * FROM team_time_logs WHERE user_name = ? AND is_active = 1',
      [userName]
    );

    if (!activeLog) {
      return res.status(400).json({ message: 'No active tracking session found' });
    }

    const duration = Math.max(0, Math.round((new Date(endTime) - new Date(activeLog.start_time)) / 1000));

    await dbRun(
      'UPDATE team_time_logs SET end_time = ?, duration_seconds = ?, is_active = 0 WHERE id = ?',
      [endTime, duration, activeLog.id]
    );

    const updatedLog = await dbGet('SELECT * FROM team_time_logs WHERE id = ?', [activeLog.id]);
    res.json({ message: 'Time tracking stopped', log: updatedLog });
  } catch (error) {
    console.error('Error stopping tracker:', error);
    res.status(500).json({ message: 'Error stopping time tracker' });
  }
});

// Get team's completed logs
router.get('/team-logs', async (req, res) => {
  try {
    const logs = await dbAll(
      'SELECT * FROM team_time_logs WHERE is_active = 0 ORDER BY start_time DESC LIMIT 100'
    );
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching team logs:', error);
    res.status(500).json({ message: 'Error fetching time logs' });
  }
});

export default router;
