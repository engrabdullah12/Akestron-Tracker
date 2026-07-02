import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  Users, 
  LogOut, 
  Lock, 
  Mail, 
  User, 
  Download, 
  CheckCircle2, 
  Activity, 
  TrendingUp, 
  Loader2,
  AlertCircle
} from 'lucide-react';

const API_BASE = window.location.origin.includes('5173') 
  ? 'http://localhost:5000/api' 
  : '/api';

export default function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  
  // Auth Form Fields
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active View State
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' | 'history' | 'admin'

  // Time Tracker State
  const [taskDescription, setTaskDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeLog, setActiveLog] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [myLogs, setMyLogs] = useState([]);
  const [trackerLoading, setTrackerLoading] = useState(false);

  // Admin Board State
  const [usersList, setUsersList] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [teamLogs, setTeamLogs] = useState([]);
  const [adminUserFilter, setAdminUserFilter] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Interval reference for stopwatch tick
  const timerRef = useRef(null);

  // Fetch current user details on token change
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUserProfile();
    } else {
      localStorage.removeItem('token');
      setUser(null);
      stopTimerInterval();
      setIsActive(false);
      setActiveLog(null);
      setElapsedSeconds(0);
    }
  }, [token]);

  // Fetch tracking status and logs when user context changes
  useEffect(() => {
    if (user) {
      fetchTrackerStatus();
      loadMyLogs();
      if (user.role === 'admin') {
        loadAdminData();
      }
    }
  }, [user]);

  // Handle active session seconds counting
  useEffect(() => {
    if (isActive && activeLog) {
      // Set initial count
      const startMs = new Date(activeLog.start_time).getTime();
      const currentMs = new Date().getTime();
      setElapsedSeconds(Math.max(0, Math.floor((currentMs - startMs) / 1000)));

      // Tick every second
      timerRef.current = setInterval(() => {
        const delta = Math.max(0, Math.floor((new Date().getTime() - startMs) / 1000));
        setElapsedSeconds(delta);
      }, 1000);
    } else {
      stopTimerInterval();
    }

    return () => stopTimerInterval();
  }, [isActive, activeLog]);

  const stopTimerInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Helper API Fetcher
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  };

  // User Profile
  const fetchUserProfile = async () => {
    try {
      const data = await apiFetch('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Fetch profile failed:', err.message);
      handleLogout();
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      setToken(data.token);
      setAuthSuccess('Logged in successfully!');
      // Clear forms
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Register handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      });
      setToken(data.token);
      setAuthSuccess('Account created successfully!');
      // Clear forms
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setToken('');
    setUser(null);
    setCurrentView('tracker');
  };

  // Tracker APIs
  const fetchTrackerStatus = async () => {
    try {
      const data = await apiFetch('/tracker/status');
      if (data.active) {
        setIsActive(true);
        setActiveLog(data.log);
        setTaskDescription(data.log.task_description);
      } else {
        setIsActive(false);
        setActiveLog(null);
      }
    } catch (err) {
      console.error('Error fetching tracker status:', err.message);
    }
  };

  const loadMyLogs = async () => {
    try {
      const data = await apiFetch('/tracker/my-logs');
      setMyLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err.message);
    }
  };

  const handleStartTracking = async (e) => {
    e.preventDefault();
    setTrackerLoading(true);
    try {
      const data = await apiFetch('/tracker/start', {
        method: 'POST',
        body: JSON.stringify({ task_description: taskDescription })
      });
      setActiveLog(data.log);
      setIsActive(true);
      setElapsedSeconds(0);
    } catch (err) {
      alert('Error starting time tracker: ' + err.message);
    } finally {
      setTrackerLoading(false);
    }
  };

  const handleStopTracking = async () => {
    setTrackerLoading(true);
    try {
      await apiFetch('/tracker/stop', { method: 'POST' });
      setIsActive(false);
      setActiveLog(null);
      setTaskDescription('');
      setElapsedSeconds(0);
      loadMyLogs();
      if (user?.role === 'admin') {
        loadAdminData();
      }
    } catch (err) {
      alert('Error stopping time tracker: ' + err.message);
    } finally {
      setTrackerLoading(false);
    }
  };

  // Admin APIs
  const loadAdminData = async () => {
    setAdminLoading(true);
    try {
      const activeData = await apiFetch('/admin/active');
      setActiveSessions(activeData.activeSessions || []);

      const usersData = await apiFetch('/admin/users');
      setUsersList(usersData.users || []);

      const logsData = await apiFetch(`/admin/logs${adminUserFilter ? `?userId=${adminUserFilter}` : ''}`);
      setTeamLogs(logsData.logs || []);
    } catch (err) {
      console.error('Error loading admin details:', err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  // Reload admin list when user filter is toggled
  useEffect(() => {
    if (user && user.role === 'admin') {
      loadAdminData();
    }
  }, [adminUserFilter]);

  // Utility to format seconds to HH:MM:SS
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  // Utility to format ISO dates to human-friendly local timestamps
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    }) + ' ' + date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Calculate stats for members
  const getTodayTime = () => {
    const todayStr = new Date().toDateString();
    return myLogs
      .filter(log => new Date(log.start_time).toDateString() === todayStr)
      .reduce((acc, log) => acc + log.duration_seconds, 0);
  };

  const getWeeklyTime = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return myLogs
      .filter(log => new Date(log.start_time) >= oneWeekAgo)
      .reduce((acc, log) => acc + log.duration_seconds, 0);
  };

  // Export to CSV trigger
  const exportLogsToCSV = () => {
    const logsToExport = user.role === 'admin' ? teamLogs : myLogs;
    if (logsToExport.length === 0) {
      alert('No logs available to export.');
      return;
    }

    const headers = user.role === 'admin' 
      ? ['User', 'Email', 'Task Description', 'Start Time', 'End Time', 'Duration (Seconds)', 'Duration (HH:MM:SS)']
      : ['Task Description', 'Start Time', 'End Time', 'Duration (Seconds)', 'Duration (HH:MM:SS)'];

    const rows = logsToExport.map(log => {
      const row = [];
      if (user.role === 'admin') {
        row.push(log.user_name || 'N/A');
        row.push(log.user_email || 'N/A');
      }
      row.push(log.task_description.replace(/"/g, '""'));
      row.push(log.start_time);
      row.push(log.end_time || '');
      row.push(log.duration_seconds);
      row.push(formatTime(log.duration_seconds));
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `akestron_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Authentication Screen
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <div className="auth-logo">
              <Clock className="logo-dot" size={28} />
              <span className="auth-logo-text">akestron<span style={{color: '#8b5cf6'}}>.com</span></span>
            </div>
            <h2 className="auth-title">
              {authMode === 'login' ? 'Welcome Back' : 'Join Agency'}
            </h2>
            <p className="auth-subtitle">
              {authMode === 'login' 
                ? 'Sign in to track your work hours' 
                : 'Create an account to join the Akestron team'}
            </p>
          </div>

          {authError && (
            <div className="alert alert-danger">
              <AlertCircle size={18} />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
            {authMode === 'register' && (
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#64748b' }} />
                  <input 
                    type="text" 
                    placeholder="Enter your name" 
                    className="input-field" 
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    style={{ paddingLeft: 44 }}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Work Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#64748b' }} />
                <input 
                  type="email" 
                  placeholder="name@akestron.com" 
                  className="input-field" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{ paddingLeft: 44 }}
                  required
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: 28 }}>
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#64748b' }} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="input-field" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ paddingLeft: 44 }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authLoading}>
              {authLoading ? (
                <>
                  <Loader2 size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                  Processing...
                </>
              ) : (
                authMode === 'login' ? 'Login' : 'Create Account'
              )}
            </button>
          </form>

          <div className="auth-footer">
            {authMode === 'login' ? (
              <>
                New to the team?{' '}
                <a href="#" className="auth-link" onClick={() => { setAuthMode('register'); setAuthError(''); }}>
                  Register here
                </a>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <a href="#" className="auth-link" onClick={() => { setAuthMode('login'); setAuthError(''); }}>
                  Login here
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Clock className="logo-dot" size={24} style={{ color: '#06b6d4' }} />
          <span className="logo-text">akestron<span style={{ color: '#8b5cf6' }}>.com</span></span>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${currentView === 'tracker' ? 'active' : ''}`}
            onClick={() => setCurrentView('tracker')}
          >
            <Clock size={18} />
            <span>Time Tracker</span>
          </button>
          
          <button 
            className={`menu-item ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => { setCurrentView('history'); loadMyLogs(); }}
          >
            <TrendingUp size={18} />
            <span>My Logs</span>
          </button>

          {user.role === 'admin' && (
            <button 
              className={`menu-item ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => { setCurrentView('admin'); loadAdminData(); }}
            >
              <Users size={18} />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="user-profile-info">
            <span className="user-profile-name">{user.name}</span>
            <span className="user-profile-email">{user.email}</span>
            <span className={`user-badge ${user.role === 'admin' ? 'badge-admin' : 'badge-member'}`}>
              {user.role}
            </span>
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }} onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* VIEW 1: TIME TRACKER */}
        {currentView === 'tracker' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Workspace</h1>
              <p className="page-subtitle">Track your project hours and sync with Akestron agency dashboard.</p>
            </div>

            {/* Live Stopwatch Tracker */}
            <div className="tracker-card glass-panel">
              <form onSubmit={handleStartTracking} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="tracker-inputs">
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">What are you working on?</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. Fine-tuning LLM agent models, Akestron web platform design..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      disabled={isActive}
                      required
                    />
                  </div>
                </div>

                <div className="timer-display-container">
                  <svg className="timer-circle-svg">
                    <circle cx="110" cy="110" r="100" className="timer-circle-bg" />
                    <circle 
                      cx="110" 
                      cy="110" 
                      r="100" 
                      className={`timer-circle-progress ${isActive ? 'active' : ''}`}
                      style={{
                        strokeDashoffset: isActive 
                          ? 628 - (628 * (elapsedSeconds % 60)) / 60 
                          : 628
                      }}
                    />
                  </svg>

                  <div className="timer-text-container">
                    <div className={`timer-time ${isActive ? 'active' : ''}`}>
                      {formatTime(elapsedSeconds)}
                    </div>
                    <div className="timer-label">
                      {isActive ? 'Tracking' : 'Idle'}
                    </div>
                  </div>
                </div>

                {isActive ? (
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={handleStopTracking}
                    disabled={trackerLoading}
                    style={{ width: '180px', height: '48px' }}
                  >
                    <Square size={18} fill="#fff" />
                    Stop Tracker
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    className="btn btn-success" 
                    disabled={trackerLoading}
                    style={{ width: '180px', height: '48px' }}
                  >
                    <Play size={18} fill="#fff" />
                    Start Tracker
                  </button>
                )}
              </form>
            </div>

            {/* Quick summary stats */}
            <div className="stats-grid">
              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper primary">
                  <Activity size={22} />
                </div>
                <div className="stat-content">
                  <span className="source-title stat-value">{formatTime(getTodayTime())}</span>
                  <span className="stat-label">Hours Tracked Today</span>
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper secondary">
                  <Clock size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{formatTime(getWeeklyTime())}</span>
                  <span className="stat-label">Hours Tracked 7 Days</span>
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper success">
                  <CheckCircle2 size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{myLogs.length}</span>
                  <span className="stat-label">Completed Sessions</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: LOG HISTORY */}
        {currentView === 'history' && (
          <div>
            <div className="page-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 className="page-title">Personal Logs</h1>
                  <p className="page-subtitle">Your historical timesheets logged on the Akestron network.</p>
                </div>
                <button className="btn btn-secondary" onClick={exportLogsToCSV}>
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="logs-section glass-panel">
              <div className="table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Task Description</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th style={{ textAlign: 'right' }}>Total Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="empty-state">
                          No logged sessions yet. Start your tracker from the workspace.
                        </td>
                      </tr>
                    ) : (
                      myLogs.map(log => (
                        <tr key={log.id}>
                          <td className="task-description-cell">{log.task_description}</td>
                          <td>{formatDateTime(log.start_time)}</td>
                          <td>{formatDateTime(log.end_time)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="duration-tag">{formatTime(log.duration_seconds)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ADMIN PANEL */}
        {currentView === 'admin' && user.role === 'admin' && (
          <div>
            <div className="page-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 className="page-title">Agency Dashboard</h1>
                  <p className="page-subtitle">Monitor live operations, track team logs, and review metrics.</p>
                </div>
                <button className="btn btn-primary" onClick={exportLogsToCSV}>
                  <Download size={16} />
                  Export All Logs (CSV)
                </button>
              </div>
            </div>

            {/* Section: Live Activity */}
            <div className="logs-section" style={{ marginTop: 0 }}>
              <div className="section-header-row">
                <h2 className="section-title">Live Status (Clocked In Now)</h2>
                <span className="active-pulse-indicator">
                  <span className="pulse-dot" />
                  Live Syncing
                </span>
              </div>

              {activeSessions.length === 0 ? (
                <div className="glass-panel empty-state" style={{ padding: '32px 16px' }}>
                  No members are currently tracking time.
                </div>
              ) : (
                <div className="active-users-grid">
                  {activeSessions.map(session => (
                    <div key={session.id} className="active-user-card glass-panel">
                      <div className="active-user-header">
                        <div>
                          <div className="active-user-name">{session.user_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{session.user_email}</div>
                        </div>
                        <span className="active-pulse-indicator" style={{ fontSize: '10px' }}>
                          <span className="pulse-dot" />
                          Tracking
                        </span>
                      </div>
                      <div className="active-user-task">
                        {session.task_description}
                      </div>
                      <div className="active-user-time">
                        Started: {new Date(session.start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section: Historical logs list */}
            <div className="logs-section" style={{ marginTop: 40 }}>
              <div className="section-header-row" style={{ flexWrap: 'wrap', gap: 16 }}>
                <h2 className="section-title">Team History Logs</h2>
                <div className="filters-bar">
                  <span className="input-label" style={{ margin: 0 }}>Filter member:</span>
                  <select 
                    className="filter-select"
                    value={adminUserFilter}
                    onChange={(e) => setAdminUserFilter(e.target.value)}
                  >
                    <option value="">All Users</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Task Description</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th style={{ textAlign: 'right' }}>Total Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminLoading ? (
                        <tr>
                          <td colSpan="5" className="empty-state">
                            <Loader2 size={18} className="spinner" style={{ display: 'inline', animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                            Updating logs...
                          </td>
                        </tr>
                      ) : teamLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-state">
                            No matching completed logs found.
                          </td>
                        </tr>
                      ) : (
                        teamLogs.map(log => (
                          <tr key={log.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{log.user_name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{log.user_email}</div>
                            </td>
                            <td className="task-description-cell">{log.task_description}</td>
                            <td>{formatDateTime(log.start_time)}</td>
                            <td>{formatDateTime(log.end_time)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="duration-tag">{formatTime(log.duration_seconds)}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
