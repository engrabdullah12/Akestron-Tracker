'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, Activity, CheckCircle2, UserCircle2, Loader2, ArrowRight } from 'lucide-react';
import { startTask, stopTask, type TrackerLog } from '@/app/actions';
import { useRouter } from 'next/navigation';

export default function TrackerUI({ initialLogs }: { initialLogs: TrackerLog[] }) {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [isReady, setIsReady] = useState(false);
  
  const [taskDesc, setTaskDesc] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [elapsed, setElapsed] = useState(0);

  // Load username from local storage
  useEffect(() => {
    const saved = localStorage.getItem('akestron_username');
    if (saved) {
      setUserName(saved);
    }
    setIsReady(true);
  }, []);

  const activeTask = initialLogs.find(l => l.team_member_name === userName && l.status === 'active');
  const teamLogs = initialLogs;

  // Live timer for active task
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTask) {
      const start = new Date(activeTask.start_time).getTime();
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeTask]);

  const handleSaveName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get('name') as string;
    if (name.trim()) {
      localStorage.setItem('akestron_username', name.trim());
      setUserName(name.trim());
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesc.trim()) return;
    setLoading(true);
    await startTask(userName, taskDesc);
    setTaskDesc('');
    setLoading(false);
    router.refresh();
  };

  const handleStop = async () => {
    setLoading(true);
    await stopTask(userName);
    setLoading(false);
    router.refresh();
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatShortTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isReady) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  if (!userName) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center">
              <UserCircle2 className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome to Akestron</h1>
          <p className="text-slate-400 text-center mb-8">Enter your name to start tracking time.</p>
          <form onSubmit={handleSaveName} className="space-y-4">
            <input 
              name="name" 
              type="text" 
              required
              placeholder="e.g. John Doe" 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="text-blue-500" />
              Akestron Tracker
            </h1>
            <p className="text-slate-400 mt-1">Live team activity board.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-full">
            <UserCircle2 className="text-slate-400 w-5 h-5" />
            <span className="text-white font-medium">{userName}</span>
            <button 
              onClick={() => { localStorage.removeItem('akestron_username'); setUserName(''); }}
              className="ml-2 text-xs text-slate-500 hover:text-red-400 underline"
            >
              Change
            </button>
          </div>
        </header>

        {/* Action Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
            {activeTask ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Currently Tracking
                  </div>
                  <h2 className="text-xl font-medium text-white truncate pr-4" title={activeTask.task_description}>
                    {activeTask.task_description}
                  </h2>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-3xl font-mono text-white tracking-tight">{formatTime(elapsed)}</div>
                  <button 
                    onClick={handleStop}
                    disabled={loading}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 p-4 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Square className="w-6 h-6 fill-current" />}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleStart} className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="What are you working on?" 
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-lg"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !taskDesc.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-8 py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-3 text-lg"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                  Start
                </button>
              </form>
            )}
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-center items-center text-center">
             <div className="text-slate-400 mb-2 font-medium">Your Total Today</div>
             <div className="text-4xl font-bold text-white">
               {formatTime(
                 teamLogs
                   .filter(l => l.team_member_name === userName && l.status === 'completed' && new Date(l.start_time).toDateString() === new Date().toDateString())
                   .reduce((acc, l) => acc + (l.duration_seconds || 0), 0)
               )}
             </div>
          </div>
        </div>

        {/* Live Board & History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Active Team */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Active Team
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {teamLogs.filter(l => l.status === 'active').length === 0 ? (
                <div className="p-8 text-center text-slate-500">No one is currently tracking time.</div>
              ) : (
                <ul className="divide-y divide-slate-800/50">
                  {teamLogs.filter(l => l.status === 'active').map(log => (
                    <li key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-medium shrink-0">
                          {log.team_member_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-slate-200">{log.team_member_name}</div>
                          <div className="text-sm text-slate-400 truncate" title={log.task_description}>{log.task_description}</div>
                        </div>
                      </div>
                      <div className="text-sm font-mono text-blue-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Started {formatShortTime(log.start_time)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent History */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-400" /> Recent Activity
            </h3>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar">
              {teamLogs.filter(l => l.status === 'completed').length === 0 ? (
                <div className="p-8 text-center text-slate-500">No recent activity.</div>
              ) : (
                <ul className="divide-y divide-slate-800/50">
                  {teamLogs.filter(l => l.status === 'completed').map(log => (
                    <li key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-slate-300">{log.team_member_name}</div>
                        <div className="text-sm font-mono text-slate-400">{formatTime(log.duration_seconds)}</div>
                      </div>
                      <div className="text-slate-400 text-sm mb-2">{log.task_description}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{formatShortTime(log.start_time)} - {log.end_time ? formatShortTime(log.end_time) : ''}</span>
                        <span>&bull;</span>
                        <span>{new Date(log.start_time).toLocaleDateString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
