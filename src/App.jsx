import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Activity, Loader2 } from 'lucide-react';

const API_BASE = window.location.origin.includes('5173') 
  ? 'http://localhost:5000/api' 
  : '/api';

export default function App() {
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [nameInput, setNameInput] = useState('');

  const [taskDescription, setTaskDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeLog, setActiveLog] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [teamLogs, setTeamLogs] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (userName) {
      fetchTrackerStatus();
      loadTeamLogs();
    }
  }, [userName]);

  useEffect(() => {
    if (isActive && activeLog) {
      const startMs = new Date(activeLog.start_time).getTime();
      const currentMs = new Date().getTime();
      setElapsedSeconds(Math.max(0, Math.floor((currentMs - startMs) / 1000)));

      timerRef.current = setInterval(() => {
        const delta = Math.max(0, Math.floor((new Date().getTime() - startMs) / 1000));
        setElapsedSeconds(delta);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, activeLog]);

  const fetchTrackerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/tracker/status?userName=${encodeURIComponent(userName)}`);
      const data = await res.json();
      if (data.active) {
        setIsActive(true);
        setActiveLog(data.log);
        setTaskDescription(data.log.task_description || '');
      } else {
        setIsActive(false);
        setActiveLog(null);
      }
    } catch (err) {
      console.error('Failed to fetch status', err);
    }
  };

  const loadTeamLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/tracker/team-logs`);
      const data = await res.json();
      setTeamLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const handleStartTracking = async (e) => {
    e.preventDefault();
    setTrackerLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tracker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_description: taskDescription, userName })
      });
      const data = await res.json();
      if (res.ok) {
        setIsActive(true);
        setActiveLog(data.log);
      } else {
        alert(data.message || 'Failed to start tracking');
      }
    } catch (err) {
      console.error('Start tracking error:', err);
    } finally {
      setTrackerLoading(false);
      loadTeamLogs();
    }
  };

  const handleStopTracking = async () => {
    setTrackerLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tracker/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName })
      });
      if (res.ok) {
        setIsActive(false);
        setActiveLog(null);
        setElapsedSeconds(0);
        setTaskDescription('');
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to stop tracking');
      }
    } catch (err) {
      console.error('Stop tracking error:', err);
    } finally {
      setTrackerLoading(false);
      loadTeamLogs();
    }
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      localStorage.setItem('userName', nameInput.trim());
      setUserName(nameInput.trim());
    }
  };

  if (!userName) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="bg-neutral-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-neutral-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
              <Clock size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-6">Welcome to Tracker</h2>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">What is your name?</label>
              <input 
                type="text" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
                required
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium transition-colors"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
            <Clock size={24} />
          </div>
          <h1 className="text-xl font-bold">Akestron Tracker</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-400 text-sm">Logged in as <strong className="text-white">{userName}</strong></span>
          <button 
            onClick={() => {
              localStorage.removeItem('userName');
              setUserName('');
            }}
            className="text-xs text-neutral-500 hover:text-white"
          >
            Change
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Tracker */}
        <div className="md:col-span-1 space-y-6">
          <div className={`p-6 rounded-2xl border ${isActive ? 'bg-blue-900/10 border-blue-800/50' : 'bg-neutral-800 border-neutral-700'}`}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} className={isActive ? 'text-blue-400' : 'text-neutral-500'} />
              Time Tracker
            </h2>
            
            <form onSubmit={handleStartTracking}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-400 mb-2">What are you working on?</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  disabled={isActive || trackerLoading}
                  placeholder="e.g., Designing the new homepage..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none h-24"
                  required
                />
              </div>

              {isActive ? (
                <div className="text-center space-y-4">
                  <div className="text-5xl font-mono font-bold text-white tracking-wider font-variant-numeric">
                    {formatDuration(elapsedSeconds)}
                  </div>
                  <button
                    type="button"
                    onClick={handleStopTracking}
                    disabled={trackerLoading}
                    className="w-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 group"
                  >
                    {trackerLoading ? <Loader2 className="animate-spin" /> : <Square size={20} className="group-hover:fill-current" />}
                    Stop Tracking
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={trackerLoading || !taskDescription.trim()}
                  className="w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 group"
                >
                  {trackerLoading ? <Loader2 className="animate-spin" /> : <Play size={20} className="group-hover:fill-current" />}
                  Start Task
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="md:col-span-2">
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6 h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={20} className="text-neutral-500" />
                Team Activity
              </h2>
              <button onClick={loadTeamLogs} className="text-sm text-blue-400 hover:text-blue-300">
                Refresh
              </button>
            </div>

            {teamLogs.length === 0 ? (
              <div className="text-center text-neutral-500 py-12">
                No tracked time yet.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {teamLogs.map(log => (
                  <div key={log.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {log.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-neutral-300 truncate">{log.user_name}</span>
                      </div>
                      <p className="text-white text-sm sm:text-base break-words line-clamp-2">{log.task_description}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {new Date(log.start_time).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-lg font-mono font-semibold text-blue-400">
                        {formatDuration(log.duration_seconds)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
