'use server'

import { getDb, initDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// Track if DB is initialized in this execution context
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export type TrackerLog = {
  id: number;
  team_member_name: string;
  task_description: string;
  start_time: Date;
  end_time: Date | null;
  duration_seconds: number;
  status: 'active' | 'completed';
  created_at: Date;
};

export async function getActiveTask(userName: string): Promise<TrackerLog | null> {
  await ensureDb();
  const db = getDb();
  try {
    const res = await db.query(
      "SELECT * FROM tracker_logs WHERE team_member_name = $1 AND status = 'active' LIMIT 1",
      [userName]
    );
    return (res.rows[0] as TrackerLog) || null;
  } catch (error) {
    console.error('Failed to fetch active task:', error);
    return null;
  }
}

export async function getAllLogs(): Promise<TrackerLog[]> {
  await ensureDb();
  const db = getDb();
  try {
    const res = await db.query(
      "SELECT * FROM tracker_logs ORDER BY start_time DESC LIMIT 100"
    );
    return res.rows as TrackerLog[];
  } catch (error) {
    console.error('Failed to fetch team logs:', error);
    return [];
  }
}

export async function startTask(userName: string, taskDescription: string) {
  await ensureDb();
  const db = getDb();
  try {
    // Stop any existing active task for this user
    await stopTask(userName);
    
    // Start new task
    const startTime = new Date().toISOString();
    await db.query(
      "INSERT INTO tracker_logs (team_member_name, task_description, start_time, status) VALUES ($1, $2, $3, 'active')",
      [userName, taskDescription, startTime]
    );
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to start task:', error);
    return { success: false, error: 'Failed to start task' };
  }
}

export async function stopTask(userName: string) {
  await ensureDb();
  const db = getDb();
  try {
    const active = await getActiveTask(userName);
    if (active) {
      const endTime = new Date();
      const start = new Date(active.start_time);
      const durationSeconds = Math.max(0, Math.round((endTime.getTime() - start.getTime()) / 1000));
      
      await db.query(
        "UPDATE tracker_logs SET end_time = $1, duration_seconds = $2, status = 'completed' WHERE id = $3",
        [endTime.toISOString(), durationSeconds, active.id]
      );
    }
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to stop task:', error);
    return { success: false, error: 'Failed to stop task' };
  }
}
