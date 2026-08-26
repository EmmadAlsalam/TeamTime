import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Briefcase, 
  BarChart3, 
  Activity, 
  MessageSquare, 
  Plus, 
  LogOut, 
  MoreVertical,
  Send,
  CheckCircle,
  XCircle,
  ChevronRight,
  TrendingUp,
  Clock,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Key,
  Search,
  Calendar,
  FileDown,
  History
} from 'lucide-react';
import { dbService, Task, TimeLog, DailyReport, Message, TaskHistory } from '../services/dbService';
import { authService, UserProfile, DEPARTMENTS } from '../services/authService';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailyPDF } from '../utils/reportGenerator';
import { ThemeToggle } from './ThemeToggle';

type Tab = 'overview' | 'employees' | 'tasks' | 'activity' | 'reports' | 'history';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  
  // UI State
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState<string | null>(null);
  const [showChangePin, setShowChangePin] = useState<{id: string, name: string, currentPin: string} | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, name: string} | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState(DEPARTMENTS[0]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [selectedTaskEmployees, setSelectedTaskEmployees] = useState<string[]>([]);
  const [msgContent, setMsgContent] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');
  const [loading, setLoading] = useState(false);
  const [reportExportDate, setReportExportDate] = useState(new Date().toISOString().split('T')[0]);

  // Sorting State
  const [sortField, setSortField] = useState<'name' | 'status' | 'role' | 'pin' | 'department'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'name' | 'status' | 'role' | 'pin' | 'department') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUsers = React.useMemo(() => {
    return [...users]
      .filter(u => 
        u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.pin.includes(userSearch)
      )
      .sort((a, b) => {
        let valA = (a[sortField as keyof UserProfile] as string) || '';
        let valB = (b[sortField as keyof UserProfile] as string) || '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [users, sortField, sortDirection, userSearch]);

  const filteredReports = React.useMemo(() => {
    const now = new Date();
    return reports.filter(report => {
      const reportDate = new Date(report.date);
      // Reset hours to compare dates correctly
      const reportDateTime = new Date(reportDate.setHours(0, 0, 0, 0)).getTime();

      if (reportFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        return reportDateTime >= weekAgo.getTime();
      }
      if (reportFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        monthAgo.setHours(0, 0, 0, 0);
        return reportDateTime >= monthAgo.getTime();
      }
      if (reportFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return reportDateTime >= start.getTime() && reportDateTime <= end.getTime();
      }
      return true;
    });
  }, [reports, reportFilter, customStartDate, customEndDate]);

  useEffect(() => {
    const unsubUsers = dbService.subscribeToUsers(setUsers);
    const unsubTasks = dbService.subscribeToTasks(setTasks);
    const unsubLogs = dbService.subscribeToAllLogs(setLogs);
    const unsubReports = dbService.subscribeToReports(setReports);
    const unsubHistory = dbService.subscribeToTaskHistory(setTaskHistory);
    return () => {
      unsubUsers();
      unsubTasks();
      unsubLogs();
      unsubReports();
      unsubHistory();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.createUser(newUserName, newUserPin, newUserRole, newUserDepartment);
      setNewUserName('');
      setNewUserPin('');
      setNewUserRole('employee');
      setNewUserDepartment(DEPARTMENTS[0]);
      setShowAddUser(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await dbService.createTask({
        title: newTaskTitle,
        description: newTaskDesc,
        status: 'pending',
        assignedTo: selectedTaskEmployees,
        createdBy: user.id
      }, user.id);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setSelectedTaskEmployees([]);
      setShowAddTask(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendMessage = async () => {
    if (!showSendMessage || !msgContent || !user) return;
    await dbService.sendMessage(user.id, showSendMessage, msgContent);
    setMsgContent('');
    setShowSendMessage(null);
    alert('Meddelande skickat!');
  };

  const handleChangePin = async () => {
    if (!showChangePin || !newPinValue) return;
    if (newPinValue.length !== 4 || !/^\d+$/.test(newPinValue)) {
      alert('Pinkoden måste vara precis 4 siffror.');
      return;
    }

    try {
      setLoading(true);
      await authService.updateUserPin(showChangePin.id, showChangePin.currentPin, newPinValue);
      alert(`Pinkoden för ${showChangePin.name} har uppdaterats.`);
      setShowChangePin(null);
      setNewPinValue('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!showDeleteConfirm) return;
    const { id: userId, name: userName } = showDeleteConfirm;

    if (userId === auth.currentUser?.uid) {
      alert('Du kan inte ta bort ditt eget admin-konto.');
      setShowDeleteConfirm(null);
      return;
    }
    
    try {
      setLoading(true);
      const userToDelete = users.find(u => u.id === userId);
      if (userToDelete) {
        await authService.deleteUser(userId, userToDelete.pin);
      }
      
      await dbService.deleteUser(userId);
      setShowDeleteConfirm(null);
      alert(`${userName} har raderats permanent från systemet.`);
    } catch (err: any) {
      console.error('Delete user error:', err);
      let errorMessage = err.message;
      try {
        const parsed = JSON.parse(err.message);
        errorMessage = `Behörighetsfel: ${parsed.error} (Operation: ${parsed.operationType})`;
        if (parsed.error.includes('insufficient permissions')) {
          errorMessage = "Du har inte behörighet att ta bort användare. Kontrollera att ditt konto har admin-status i databasen.";
        }
      } catch (e) {
        // Not a JSON error
      }
      alert('Kunde inte ta bort användaren: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getDayEfficiency = () => {
    const today = new Date().toISOString().split('T')[0];
    const totalReports = reports.filter(r => r.date === today).length;
    const goodReports = reports.filter(r => r.date === today && r.mood === 'good').length;
    return totalReports === 0 ? 0 : Math.round((goodReports / totalReports) * 100);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0c0c0e] text-[#141414] dark:text-[#f3f4f6] flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#141414] dark:bg-[#121216] text-white flex flex-col pt-8 pb-4 shrink-0 border-r border-transparent dark:border-white/5">
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#141414] font-bold text-xl">
              T
            </div>
            <h1 className="text-xl font-bold tracking-tight">TeamTime Pro</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {[
            { id: 'overview', icon: BarChart3, label: 'Översikt' },
            { id: 'employees', icon: Users, label: 'Medarbetare' },
            { id: 'tasks', icon: Briefcase, label: 'Uppgifter' },
            { id: 'activity', icon: Activity, label: 'Aktivitet' },
            { id: 'reports', icon: BarChart3, label: 'Rapporter' },
            { id: 'history', icon: History, label: 'Logg' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-white text-[#141414] shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-6 pt-4 border-t border-white/10 mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                {user?.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user?.name}</p>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Admin</p>
              </div>
            </div>
            <ThemeToggle variant="icon" className="shrink-0" />
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold transition-all text-red-400"
          >
            <LogOut className="w-4 h-4" /> Logga ut
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-h-screen custom-scrollbar p-6 lg:p-10">
        {/* Header - Dynamic Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-[#141414] dark:text-white capitalize">
              {activeTab === 'overview' ? 'Dagens Översikt' : 
               activeTab === 'employees' ? 'Hantera Medarbetare' :
               activeTab === 'tasks' ? 'Arbetsuppgifter' :
               activeTab === 'activity' ? 'Realtidsaktivitet' : 
               activeTab === 'history' ? 'Uppgiftslogg' : 'Produktivitetsrapport'}
            </h2>
            <p className="text-[#9e9e9e] dark:text-zinc-400 font-serif italic mt-1">
              Välkommen tillbaka, {user?.name.split(' ')[0]}. Här är vad som händer idag.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {activeTab === 'employees' && (
              <button 
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-5 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
              >
                <Plus className="w-5 h-5" /> Lägg till medarbetare
              </button>
            )}
            {activeTab === 'tasks' && (
              <button 
                onClick={() => setShowAddTask(true)}
                className="flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-5 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
              >
                <Plus className="w-5 h-5" /> Ny uppgift
              </button>
            )}
          </div>
        </div>

        {/* Tab Views */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Aktiva medarbetare', value: users.filter(u => u.status === 'active').length, icon: Users, color: 'bg-blue-500' },
                    { label: 'Pågående uppgifter', value: tasks.filter(t => t.status === 'in-progress').length, icon: Clock, color: 'bg-orange-500' },
                    { label: 'Dagens effektivitet', value: `${getDayEfficiency()}%`, icon: TrendingUp, color: 'bg-green-500' },
                    { label: 'Nya meddelanden', value: 0, icon: MessageSquare, color: 'bg-purple-500' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-[#141418] p-6 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm flex items-center gap-4 transition-colors">
                      <div className={`p-4 rounded-2xl ${stat.color} text-white shadow-lg`}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-[#9e9e9e] dark:text-zinc-400 tracking-wider mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-[#141414] dark:text-white">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Main Dashboard Rows */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Latest Activity */}
                  <div className="lg:col-span-2 bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm flex flex-col h-[500px] transition-colors">
                    <div className="p-6 border-b border-[#e5e5e5] dark:border-white/10 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#141414] dark:text-white">Senaste Aktivitet</h3>
                      <button onClick={() => setActiveTab('activity')} className="text-xs font-bold text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white transition-colors">Visa alla</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                       {logs.slice(0, 10).map((log, i) => {
                         const actor = users.find(u => u.id === log.userId);
                         const task = tasks.find(t => t.id === log.taskId);
                         return (
                           <div key={log.id} className="flex items-center gap-4 p-4 hover:bg-[#f5f5f5] dark:hover:bg-white/5 rounded-2xl transition-colors">
                             <div className="w-10 h-10 rounded-xl bg-[#f5f5f5] dark:bg-white/10 flex items-center justify-center font-bold text-xs text-[#141414] dark:text-white">
                               {actor?.name[0]}
                             </div>
                             <div className="flex-1">
                               <p className="text-sm text-[#141414] dark:text-zinc-200">
                                 <span className="font-bold">{actor?.name}</span> 
                                 <span className="text-[#9e9e9e] dark:text-zinc-400 mx-1">{log.type === 'start' ? 'påbörjade' : 'avslutade'}</span>
                                 <span className="font-medium text-blue-600 dark:text-blue-400">{task?.title || 'Okänd uppgift'}</span>
                               </p>
                               <p className="text-[10px] uppercase font-bold text-[#9e9e9e] dark:text-zinc-500 mt-1">
                                 {log.timestamp ? log.timestamp.toDate().toLocaleTimeString('sv-SE') : 'Laddar...'}
                               </p>
                             </div>
                             <ChevronRight className="w-4 h-4 text-[#d1d1d1] dark:text-zinc-600" />
                           </div>
                         );
                       })}
                    </div>
                  </div>

                  {/* Mood Summary */}
                  <div className="bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm p-6 flex flex-col transition-colors">
                    <h3 className="text-lg font-bold mb-6 text-[#141414] dark:text-white">Medarbetarnas mående</h3>
                    <div className="space-y-6 flex-1 overflow-y-auto">
                      {reports.slice(0, 5).map(report => {
                        const reporter = users.find(u => u.id === report.userId);
                        return (
                          <div key={report.id} className="flex gap-4 p-4 rounded-2xl bg-[#f5f5f5] dark:bg-white/5">
                            <span className="text-3xl">
                              {report.mood === 'good' ? '😊' : report.mood === 'ok' ? '😐' : '😔'}
                            </span>
                            <div>
                              <p className="font-bold text-sm text-[#141414] dark:text-white">{reporter?.name}</p>
                              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 line-clamp-1 italic">"{report.summary}"</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setActiveTab('reports')} className="mt-6 w-full py-3 bg-[#f5f5f5] dark:bg-white/5 text-[#141414] dark:text-white font-bold rounded-xl text-sm border-2 border-[#e5e5e5] dark:border-white/10 hover:bg-[#e5e5e5] dark:hover:bg-white/10 transition-colors">
                      Visa alla rapporter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="space-y-8">
                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-[#141414] dark:text-white mb-1">Medarbetare</h3>
                    <p className="text-[#9e9e9e] dark:text-zinc-400 font-medium italic">Hantera ditt team och deras åtkomst.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => setShowAddUser(true)}
                      className="px-6 py-3 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ny Medarbetare
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9e9e9e] dark:text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Sök medarbetare på namn eller pinkod..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-white dark:bg-[#141418] border border-[#e5e5e5] dark:border-white/10 text-[#141414] dark:text-white rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:border-[#141414] dark:focus:border-white/30 transition-all shadow-sm"
                  />
                  {userSearch && (
                    <button 
                      onClick={() => setUserSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white"
                    >
                      Rensa
                    </button>
                  )}
                </div>

                <div className="bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-[#e5e5e5] dark:border-white/10 grid grid-cols-5 font-bold text-[10px] uppercase tracking-widest text-[#9e9e9e] dark:text-zinc-400">
                  <div className="pl-4 flex items-center gap-4">
                    <button 
                      onClick={() => toggleSort('name')}
                      className={`flex items-center gap-1 hover:text-[#141414] dark:hover:text-white transition-colors ${sortField === 'name' ? 'text-[#141414] dark:text-white' : ''}`}
                    >
                      Namn {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </button>
                    <button 
                      onClick={() => toggleSort('role')}
                      className={`flex items-center gap-1 hover:text-[#141414] dark:hover:text-white transition-colors ${sortField === 'role' ? 'text-[#141414] dark:text-white' : ''}`}
                    >
                      Roll {sortField === 'role' ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </button>
                  </div>
                  <button 
                    onClick={() => toggleSort('department')}
                    className={`flex items-center gap-1 hover:text-[#141414] dark:hover:text-white transition-colors w-fit ${sortField === 'department' ? 'text-[#141414] dark:text-white' : ''}`}
                  >
                    Avdelning {sortField === 'department' ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </button>
                  <button 
                    onClick={() => toggleSort('pin')}
                    className={`flex items-center gap-1 hover:text-[#141414] dark:hover:text-white transition-colors w-fit ${sortField === 'pin' ? 'text-[#141414] dark:text-white' : ''}`}
                  >
                    Pinkod {sortField === 'pin' ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </button>
                  <button 
                    onClick={() => toggleSort('status')}
                    className={`flex items-center gap-1 hover:text-[#141414] dark:hover:text-white transition-colors w-fit ${sortField === 'status' ? 'text-[#141414] dark:text-white' : ''}`}
                  >
                    Status {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </button>
                  <span className="text-right pr-4">Hantering</span>
                </div>
                <div className="divide-y divide-[#e5e5e5] dark:divide-white/10">
                  <AnimatePresence>
                    {sortedUsers.map(u => (
                      <motion.div 
                        key={u.id}
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-5 items-center p-4 hover:bg-[#f5f5f5] dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 pl-4">
                          <div className="w-10 h-10 rounded-xl bg-[#141414] dark:bg-white dark:text-[#141414] text-white flex items-center justify-center font-bold">
                            {u.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-[#141414] dark:text-white">{u.name}</p>
                            <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 capitalize">{u.role}</p>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-[#141414] dark:text-zinc-200 bg-white dark:bg-white/10 border border-[#e5e5e5] dark:border-white/10 px-2 py-1 rounded w-fit">
                          {u.department || 'Ej tilldelad'}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-bold bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-zinc-200 px-2 py-1 rounded w-fit">{u.pin}</code>
                          <button 
                            type="button"
                            onClick={() => setShowChangePin({ id: u.id, name: u.name, currentPin: u.pin })}
                            className="p-1 hover:text-[#141414] dark:hover:text-white text-[#9e9e9e] dark:text-zinc-400 transition-colors"
                            title="Ändra pinkod"
                          >
                            <Key className="w-3 h-3" />
                          </button>
                        </div>
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg ${
                            u.status === 'active' 
                              ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' 
                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                          }`}>
                            {u.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-2 pr-4 text-[#141414] dark:text-white min-w-[120px]">
                          <button 
                            type="button"
                            onClick={() => setShowSendMessage(u.id)}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-[#e5e5e5] dark:border-white/10 transition-transform active:scale-95"
                            title="Skicka meddelande"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => dbService.updateUserStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                            className={`p-2 rounded-lg shadow-sm border transition-all active:scale-95 ${
                              u.status === 'active' 
                                ? 'hover:bg-red-50 dark:hover:bg-red-950/30 border-[#e5e5e5] dark:border-white/10 hover:text-red-500' 
                                : 'hover:bg-green-50 dark:hover:bg-green-950/30 border-green-200 dark:border-green-800/40 text-green-600 dark:text-green-400'
                            }`}
                            title={u.status === 'active' ? 'Inaktivera' : 'Aktivera'}
                          >
                            {u.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button 
                            type="button"
                            disabled={loading || u.id === auth.currentUser?.uid}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm({ id: u.id, name: u.name });
                            }}
                            className={`p-2 rounded-lg shadow-sm border transition-all active:scale-95 ${
                              loading || u.id === auth.currentUser?.uid 
                                ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10' 
                                : 'hover:bg-red-50 dark:hover:bg-red-950/30 border-red-100 dark:border-red-900/30 text-red-500 hover:text-red-700'
                            }`}
                            title="Ta bort permanent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            )}

            {activeTab === 'tasks' && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-4">
                   <h3 className="text-lg font-bold text-[#141414] dark:text-white">Pågående uppgifter</h3>
                   {tasks.filter(t => t.status !== 'completed').map(task => (
                     <div key={task.id} className="bg-white dark:bg-[#141418] p-6 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm transition-colors">
                       <div className="flex items-start justify-between mb-4">
                         <div>
                           <h4 className="font-bold text-[#141414] dark:text-white">{task.title}</h4>
                           <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 line-clamp-2">{task.description}</p>
                         </div>
                         <span className={`text-[10px] font-bold uppercase py-1 px-2 rounded-lg ${
                           task.status === 'in-progress' 
                             ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' 
                             : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                         }`}>
                           {task.status}
                         </span>
                       </div>
                       <div className="flex items-center justify-between border-t border-[#f5f5f5] dark:border-white/5 pt-4">
                         <div className="flex -space-x-2">
                           {task.assignedTo.map(uid => (
                             <div key={uid} className="w-8 h-8 rounded-full bg-[#141414] dark:bg-zinc-800 border-2 border-white dark:border-[#141418] text-white text-[10px] flex items-center justify-center font-bold">
                               {users.find(u => u.id === uid)?.name[0] || '?'}
                             </div>
                           ))}
                         </div>
                         <div className="flex gap-2">
                           <button onClick={() => user && dbService.updateTask(task.id, { status: 'completed' }, user.id, task)} className="text-xs font-bold text-green-600 dark:text-green-400 px-3 py-2 bg-green-50 dark:bg-green-950/40 rounded-xl hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors">Slutför</button>
                           <button onClick={() => user && dbService.deleteTask(task.id, task.title, user.id)} className="text-xs font-bold text-red-500 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="space-y-4">
                   <h3 className="text-lg font-bold text-[#141414] dark:text-white">Slutförda uppgifter</h3>
                   {tasks.filter(t => t.status === 'completed').map(task => (
                     <div key={task.id} className="bg-white/60 dark:bg-[#141418]/60 p-6 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 opacity-80 backdrop-blur-sm transition-colors">
                       <h4 className="font-bold text-[#141414] dark:text-zinc-300 line-through decoration-[#9e9e9e]">{task.title}</h4>
                       <p className="text-xs text-[#9e9e9e] dark:text-zinc-500 mt-2">Avslutad {task.createdAt ? task.createdAt.toDate().toLocaleDateString('sv-SE') : 'Okänt datum'}</p>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeTab === 'history' && (
              <div className="bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-[#e5e5e5] dark:border-white/10">
                  <h3 className="text-lg font-bold text-[#141414] dark:text-white">Historik över uppgifter</h3>
                  <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 italic">Logg över tilldelningar, statusändringar och skapade uppgifter.</p>
                </div>
                <div className="divide-y divide-[#e5e5e5] dark:divide-white/10">
                  {taskHistory.length === 0 ? (
                    <div className="p-10 text-center text-[#9e9e9e] dark:text-zinc-400 italic">
                      Ingen historik tillgänglig än.
                    </div>
                  ) : (
                    taskHistory.map((item) => {
                      const admin = users.find(u => u.id === item.performedBy);
                      return (
                        <div key={item.id} className="p-6 hover:bg-[#f5f5f5] dark:hover:bg-white/5 transition-colors flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${
                            item.type === 'created' ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400' :
                            item.type === 'deleted' ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400' :
                            item.type === 'status_change' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' :
                            'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                          }`}>
                            <History className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-[#141414] dark:text-white">{item.taskTitle}</h4>
                              <span className="text-[10px] font-bold text-[#9e9e9e] dark:text-zinc-400 uppercase tracking-widest">
                                {item.timestamp?.toDate().toLocaleString('sv-SE')}
                              </span>
                            </div>
                            <p className="text-sm text-[#141414] dark:text-zinc-200 mb-2">{item.details}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-[#141414] dark:bg-white dark:text-[#141414] text-white text-[8px] flex items-center justify-center font-bold">
                                {admin?.name?.[0] || 'A'}
                              </div>
                              <span className="text-xs text-[#9e9e9e] dark:text-zinc-400">Utfördes av <span className="font-bold text-[#141414] dark:text-white">{admin?.name || 'Admin'}</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
               <div className="bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm p-6 transition-colors">
                 <div className="space-y-4">
                   {logs.map((log) => {
                     const actor = users.find(u => u.id === log.userId);
                     const task = tasks.find(t => t.id === log.taskId);
                     return (
                       <div key={log.id} className="flex items-center gap-6 p-4 rounded-[24px] border border-[#f5f5f5] dark:border-white/5 bg-transparent dark:bg-white/[0.02]">
                         <div className="w-12 h-12 rounded-2xl bg-[#141414] dark:bg-white dark:text-[#141414] text-white flex flex-col items-center justify-center font-mono text-[10px]">
                           <span className="font-bold text-lg leading-none">{log.timestamp ? log.timestamp.toDate().getDate() : '--'}</span>
                           <span className="opacity-60">{log.timestamp ? log.timestamp.toDate().toLocaleDateString('sv-SE', { month: 'short' }) : '...'}</span>
                         </div>
                         <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                             <span className="px-2 py-0.5 bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-white font-bold text-[10px] rounded-md uppercase tracking-wider">
                               {log.type === 'start' ? 'Incheckning' : 'Utcheckning'}
                             </span>
                             <span className="text-xs font-bold text-[#141414] dark:text-white">{actor?.name}</span>
                           </div>
                           <p className="text-sm font-medium text-[#9e9e9e] dark:text-zinc-400">
                             {log.type === 'start' ? 'Startade uppgiften' : 'Avslutade arbetet med'} <span className="text-[#141414] dark:text-white font-semibold">{task?.title || 'Okänd'}</span>
                           </p>
                         </div>
                         <div className="text-right">
                           <p className="font-mono text-sm font-bold text-[#141414] dark:text-white">{log.timestamp ? log.timestamp.toDate().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                           <div className="flex items-center gap-1 justify-end text-green-500">
                             <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                             <span className="text-[10px] font-bold uppercase">Realtime</span>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-8">
                 {/* Report Filters */}
                 <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#141418] p-4 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#f5f5f5] dark:bg-white/10 rounded-xl text-[#141414] dark:text-white">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sm text-[#141414] dark:text-white">Datumfilter</h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex bg-[#f5f5f5] dark:bg-white/5 p-1 rounded-xl">
                        {[
                          { id: 'all', label: 'Alla' },
                          { id: 'week', label: 'Vecka' },
                          { id: 'month', label: 'Månad' },
                          { id: 'custom', label: 'Anpassat' }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setReportFilter(f.id as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                              reportFilter === f.id ? 'bg-white dark:bg-white/10 text-[#141414] dark:text-white shadow-sm' : 'text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      {reportFilter === 'custom' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <input 
                            type="date" 
                            value={customStartDate} 
                            onChange={e => setCustomStartDate(e.target.value)}
                            className="bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-white border-none rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#141414]/10 dark:focus:ring-white/20"
                          />
                          <span className="text-[#9e9e9e] dark:text-zinc-400 font-bold">-</span>
                          <input 
                            type="date" 
                            value={customEndDate} 
                            onChange={e => setCustomEndDate(e.target.value)}
                            className="bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-white border-none rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#141414]/10 dark:focus:ring-white/20"
                          />
                        </div>
                      )}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-[#141414] dark:bg-[#121216] text-white p-8 rounded-[32px] shadow-2xl relative overflow-hidden border border-transparent dark:border-white/10">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                      <h3 className="text-2xl font-bold mb-2">Teamets hälsa</h3>
                      <p className="text-white/60 mb-8 italic">Baserat på dagliga dagsrapporter.</p>
                      
                      <div className="flex flex-wrap items-start gap-12">
                        <div className="text-center">
                          <p className="text-4xl font-bold mb-1">{filteredReports.filter(r => r.mood === 'good').length}</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-3">Bra dagar</p>
                          <div className="flex flex-col gap-1 items-center">
                            {Array.from(new Set(filteredReports.filter(r => r.mood === 'good').map(r => r.userId))).map(uid => {
                              const name = users.find(u => u.id === uid)?.name;
                              return <span key={uid} className="text-[10px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{name}</span>;
                            })}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-4xl font-bold mb-1">{filteredReports.filter(r => r.mood === 'ok').length}</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-3">Okej dagar</p>
                          <div className="flex flex-col gap-1 items-center">
                            {Array.from(new Set(filteredReports.filter(r => r.mood === 'ok').map(r => r.userId))).map(uid => {
                              const name = users.find(u => u.id === uid)?.name;
                              return <span key={uid} className="text-[10px] font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">{name}</span>;
                            })}
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-4xl font-bold mb-1">{filteredReports.filter(r => r.mood === 'bad').length}</p>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-3">Jobbiga dagar</p>
                          <div className="flex flex-col gap-1 items-center">
                            {Array.from(new Set(filteredReports.filter(r => r.mood === 'bad').map(r => r.userId))).map(uid => {
                              const name = users.find(u => u.id === uid)?.name;
                              return <span key={uid} className="text-[10px] font-medium text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">{name}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                   </div>

                   <div className="bg-white dark:bg-[#141418] p-8 rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm transition-colors">
                      <h3 className="text-xl font-bold mb-6 text-[#141414] dark:text-white">Effektivitet per medarbetare</h3>
                      <div className="space-y-4">
                        {users.filter(u => u.role === 'employee').map(u => {
                          const userLogs = logs.filter(l => l.userId === u.id);
                          const taskCount = new Set(userLogs.map(l => l.taskId)).size;
                          return (
                            <div key={u.id} className="flex items-center justify-between p-4 bg-[#f5f5f5] dark:bg-white/5 rounded-2xl">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#141414] dark:bg-white dark:text-[#141414] text-white flex items-center justify-center font-bold text-xs">{u.name[0]}</div>
                                <p className="font-bold text-sm text-[#141414] dark:text-white">{u.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg text-[#141414] dark:text-white">{taskCount}</p>
                                <p className="text-[10px] uppercase font-bold text-[#9e9e9e] dark:text-zinc-400">Portföljer</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                 </div>

                 {/* Detailed Daily Reviews */}
                 <div className="bg-white dark:bg-[#141418] rounded-[32px] border border-[#e5e5e5] dark:border-white/10 shadow-sm overflow-hidden transition-colors">
                    <div className="p-6 border-b border-[#e5e5e5] dark:border-white/10 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-[#141414] dark:text-white">Dagsrecensioner</h3>
                      <div className="flex items-center gap-3">
                        <input 
                          type="date" 
                          value={reportExportDate} 
                          onChange={e => setReportExportDate(e.target.value)}
                          className="bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-white border-none rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#141414]/10 dark:focus:ring-white/20"
                        />
                        <button 
                          onClick={() => generateDailyPDF(users, tasks, logs, reports, reportExportDate)}
                          className="flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:opacity-90 transition-all"
                        >
                          <FileDown className="w-4 h-4" /> Exportera PDF
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-[#e5e5e5] dark:divide-white/10">
                      {filteredReports.length === 0 ? (
                        <div className="p-12 text-center">
                          <Calendar className="w-12 h-12 text-[#e5e5e5] dark:text-zinc-700 mx-auto mb-4" />
                          <p className="text-[#9e9e9e] dark:text-zinc-400 font-serif italic">Inga rapporter hittades för valt datumintervall.</p>
                        </div>
                      ) : (
                        filteredReports.map(r => {
                          const reporter = users.find(u => u.id === r.userId);
                          return (
                            <div key={r.id} className="p-6 flex gap-6 hover:bg-[#f5f5f5] dark:hover:bg-white/5 transition-colors">
                              <span className="text-4xl">{r.mood === 'good' ? '😊' : r.mood === 'ok' ? '😐' : '😔'}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-bold text-[#141414] dark:text-white">{reporter?.name}</h4>
                                  <span className="text-[10px] font-bold text-[#9e9e9e] dark:text-zinc-400 uppercase">{r.date}</span>
                                </div>
                                <p className="text-sm text-[#9e9e9e] dark:text-zinc-300 italic leading-relaxed">"{r.summary}"</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                 </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddUser(false)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-2xl font-bold mb-6">Ny medarbetare</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Namn</label>
                  <input required placeholder="T.ex. Johan Arvidsson" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">4-siffrig pinkod</label>
                  <input required maxLength={4} pattern="\d{4}" placeholder="T.ex. 1234" value={newUserPin} onChange={e => setNewUserPin(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white" />
                </div>
                 <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelning</label>
                  <select 
                    value={newUserDepartment} 
                    onChange={e => setNewUserDepartment(e.target.value)}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white"
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Behörighet</label>
                  <select 
                    value={newUserRole} 
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white"
                  >
                    <option value="employee">Medarbetare</option>
                    <option value="admin">Administratör</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all pt-4">Spara medarbetare</button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTask(false)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-2xl font-bold mb-6">Skapa arbetsuppgift</h3>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Titel</label>
                  <input required placeholder="T.ex. Morgonleverans" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Beskrivning</label>
                  <textarea rows={3} placeholder="Vad behöver göras?" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none text-[#141414] dark:text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Tilldela till</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {users.filter(u => u.role === 'employee').map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedTaskEmployees(prev => prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id])}
                        className={`text-xs p-2 rounded-xl border-2 transition-all font-bold ${
                          selectedTaskEmployees.includes(emp.id) 
                            ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] border-[#141414] dark:border-white' 
                            : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 border-[#f5f5f5] dark:border-white/10 hover:border-[#d1d1d1] dark:hover:border-white/20'
                        }`}
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all">Skapa uppgift</button>
              </form>
            </motion.div>
          </div>
        )}

        {showSendMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSendMessage(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2 underline decoration-[#d1d1d1] dark:decoration-zinc-700 underline-offset-4 decoration-2">
                <Send className="w-5 h-5" /> Skicka meddelande
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 font-serif mb-6 italic">Meddelandet visas direkt i medarbetarens portal.</p>
              <textarea 
                rows={4} 
                autoFocus
                placeholder="Skriv ditt meddelande..." 
                value={msgContent} 
                onChange={e => setMsgContent(e.target.value)} 
                className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none mb-6 text-[#141414] dark:text-white" 
              />
              <button 
                onClick={handleSendMessage}
                className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Skicka nu <Send className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}

        {showChangePin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChangePin(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Key className="w-5 h-5" /> Ändra pinkod
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 tracking-wide uppercase font-bold">För {showChangePin.name}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Nuvarande pinkod</label>
                  <div className="w-full bg-[#f5f5f5] dark:bg-white/5 rounded-2xl p-4 text-sm font-bold opacity-70 text-[#141414] dark:text-white">
                    {showChangePin.currentPin}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Ny 4-siffrig pinkod</label>
                  <input 
                    autoFocus
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="T.ex. 5678"
                    value={newPinValue} 
                    onChange={e => setNewPinValue(e.target.value)} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-bold outline-none transition-all text-[#141414] dark:text-white" 
                  />
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={handleChangePin}
                    disabled={loading || newPinValue.length !== 4}
                    className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Uppdaterar...' : 'Uppdatera pinkod'}
                  </button>
                  <button 
                    onClick={() => setShowChangePin(null)}
                    disabled={loading}
                    className="w-full py-3 text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors text-sm"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-red-100 dark:border-red-900/30">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Ta bort medarbetare?</h3>
              <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 text-center mb-8">
                Är du säker på att du vill ta bort <span className="font-bold text-[#141414] dark:text-white">{showDeleteConfirm.name}</span>? 
                Denna handling raderar användaren permanent från både databasen och inloggningssystemet.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleDeleteUser}
                  disabled={loading}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Tar bort...' : 'Ja, ta bort permanent'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={loading}
                  className="w-full py-3 text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors text-sm"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
