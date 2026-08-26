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
  CheckCircle2,
  CircleDot,
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
  History,
  Building2,
  Edit3,
  UserPlus,
  Shield,
  Sparkles
} from 'lucide-react';
import { dbService, Task, TimeLog, DailyReport, Message, TaskHistory, DepartmentItem, DEFAULT_DEPARTMENTS } from '../services/dbService';
import { authService, UserProfile } from '../services/authService';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailyPDF } from '../utils/reportGenerator';
import { ThemeToggle } from './ThemeToggle';

const QUICK_TASK_TEMPLATES: Record<string, { title: string; desc: string }[]> = {
  'Inlagring': [
    { title: 'Inlagring Pallgods', desc: 'Lagra in ankommet pallgods på höglagerplatser.' },
    { title: 'Inlagring Småplock', desc: 'Fylla på hyllfack och flödesgenomlopp.' },
    { title: 'Omlokalisering & Optimering', desc: 'Flytta artiklar till optimerade plockplatser.' },
    { title: 'Pallsortering', desc: 'Grovsortera inkommet gods inför inlagring.' }
  ],
  'Mottagning': [
    { title: 'Ankomstkontroll', desc: 'Kontrollera inkommande paket och pallar mot följesedel.' },
    { title: 'Sortering Mottagning', desc: 'Sortera artiklar till rätt inlagringszoner.' },
    { title: 'Avvikelsehantering', desc: 'Registrera skadade eller felaktiga leveranser.' }
  ],
  'Plock': [
    { title: 'Plock Zon 1', desc: 'Plocka artiklar och orderrader inom Zon 1.' },
    { title: 'Plock Zon 2', desc: 'Plocka artiklar och orderrader inom Zon 2.' },
    { title: 'Plock Zon 3', desc: 'Plocka artiklar och orderrader inom Zon 3.' },
    { title: 'Plock Zon 4', desc: 'Plocka artiklar och orderrader inom Zon 4.' },
    { title: 'Plock Zon 5', desc: 'Plocka artiklar och orderrader inom Zon 5.' },
    { title: 'Plock Zon 6', desc: 'Plocka artiklar och orderrader inom Zon 6.' },
    { title: 'Plock Zon 7', desc: 'Plocka artiklar och orderrader inom Zon 7.' },
  ],
  'Pack': [
    { title: 'Packstation 1', desc: 'Emballera och kontrollväga färdigplockade ordrar.' },
    { title: 'Packstation 2', desc: 'Skriva ut fraktetiketter och packa paket.' },
    { title: 'Pallpack & Plastning', desc: 'Plasta och etikettera färdiga helpallar.' }
  ],
  'Utlastning': [
    { title: 'Lastning Avgångar', desc: 'Ställa upp och lasta gods på transportbilar.' },
    { title: 'Bokning & Fraktsedlar', desc: 'Kvittera fraktsedlar och överlämna till speditörer.' }
  ],
  'Returer': [
    { title: 'Returkontroll', desc: 'Granska och bedöma returnerade varor.' },
    { title: 'Återinlagring Retur', desc: 'Återföra godkända returartiklar till lagersaldo.' }
  ],
  'Inventering': [
    { title: 'Löpande Differenskontroll', desc: 'Kontrollräkna nollställda eller avvikande fack.' },
    { title: 'Sektionsinventering', desc: 'Inventera specifik lagersektion.' }
  ]
};

type Tab = 'overview' | 'employees' | 'departments' | 'tasks' | 'activity' | 'reports' | 'history';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);

  const deptList = React.useMemo(() => {
    return departments.length > 0 ? departments.map(d => d.name) : DEFAULT_DEPARTMENTS;
  }, [departments]);
  
  // UI State
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [editDeptData, setEditDeptData] = useState<{ id: string; name: string; oldName: string; description: string } | null>(null);
  const [showDeleteDeptConfirm, setShowDeleteDeptConfirm] = useState<{ id: string; name: string; userCount: number; taskCount: number } | null>(null);
  const [deptSearch, setDeptSearch] = useState('');

  const [editTaskData, setEditTaskData] = useState<{
    id: string;
    title: string;
    description: string;
    department?: string;
    status: 'pending' | 'in-progress' | 'completed';
    assignedTo: string[];
    oldTask: Task;
  } | null>(null);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState<{ id: string; title: string } | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');

  const [showSendMessage, setShowSendMessage] = useState<string | null>(null);
  const [showChangePin, setShowChangePin] = useState<{id: string, name: string, currentPin: string} | null>(null);
  const [showEditDept, setShowEditDept] = useState<{id: string, name: string, currentDept: string} | null>(null);
  const [selectedDeptValue, setSelectedDeptValue] = useState<string>(DEFAULT_DEPARTMENTS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, name: string, role?: string} | null>(null);
  const [editUserData, setEditUserData] = useState<{
    id: string;
    name: string;
    pin: string;
    currentPin: string;
    role: 'admin' | 'employee';
    department: string;
    status: 'active' | 'inactive';
  } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState(DEFAULT_DEPARTMENTS[0]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDept, setNewTaskDept] = useState('Plock');
  const [selectedTaskEmployees, setSelectedTaskEmployees] = useState<string[]>([]);
  const [msgContent, setMsgContent] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'employee'>('employee');
  const [loading, setLoading] = useState(false);
  const [reportExportDate, setReportExportDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskDeptFilter, setTaskDeptFilter] = useState<string>('all');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('all');

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
      .filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.pin.includes(userSearch);
        const matchesDept = userDeptFilter === 'all' || u.department === userDeptFilter;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => {
        let valA = (a[sortField as keyof UserProfile] as string) || '';
        let valB = (b[sortField as keyof UserProfile] as string) || '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [users, sortField, sortDirection, userSearch, userDeptFilter]);

  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      // Search
      const matchesSearch = !taskSearch || 
        task.title.toLowerCase().includes(taskSearch.toLowerCase()) || 
        task.description.toLowerCase().includes(taskSearch.toLowerCase());
      
      // Status
      const matchesStatus = taskStatusFilter === 'all' || task.status === taskStatusFilter;

      // Department
      let matchesDept = true;
      if (taskDeptFilter !== 'all') {
        if (task.department) {
          matchesDept = task.department === taskDeptFilter;
        } else if (task.assignedTo.length > 0) {
          const assignedUsers = users.filter(u => task.assignedTo.includes(u.id));
          matchesDept = assignedUsers.some(u => u.department === taskDeptFilter);
        } else {
          matchesDept = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [tasks, users, taskDeptFilter, taskStatusFilter, taskSearch]);

  const filteredDepartments = React.useMemo(() => {
    return departments.filter(d => 
      d.name.toLowerCase().includes(deptSearch.toLowerCase()) || 
      (d.description && d.description.toLowerCase().includes(deptSearch.toLowerCase()))
    );
  }, [departments, deptSearch]);

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
    const unsubDepts = dbService.subscribeToDepartments(setDepartments);
    const unsubLogs = dbService.subscribeToAllLogs(setLogs);
    const unsubReports = dbService.subscribeToReports(setReports);
    const unsubHistory = dbService.subscribeToTaskHistory(setTaskHistory);
    return () => {
      unsubUsers();
      unsubTasks();
      unsubDepts();
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
      setNewUserDepartment(deptList[0] || DEFAULT_DEPARTMENTS[0]);
      setShowAddUser(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setLoading(true);
      await dbService.createTask({
        title: newTaskTitle,
        description: newTaskDesc,
        department: newTaskDept || undefined,
        status: 'pending',
        assignedTo: selectedTaskEmployees,
        createdBy: user.id
      }, user.id);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDept(deptList[0] || 'Plock');
      setSelectedTaskEmployees([]);
      setShowAddTask(false);
    } catch (err: any) {
      alert(err.message || 'Kunde inte skapa uppgift');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTaskData || !user) return;
    try {
      setLoading(true);
      await dbService.updateTask(
        editTaskData.id,
        {
          title: editTaskData.title,
          description: editTaskData.description,
          department: editTaskData.department || undefined,
          status: editTaskData.status,
          assignedTo: editTaskData.assignedTo
        },
        user.id,
        editTaskData.oldTask
      );
      setEditTaskData(null);
    } catch (err: any) {
      alert(err.message || 'Kunde inte uppdatera uppgift');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!showDeleteTaskConfirm || !user) return;
    try {
      setLoading(true);
      await dbService.deleteTask(showDeleteTaskConfirm.id, showDeleteTaskConfirm.title, user.id);
      setShowDeleteTaskConfirm(null);
    } catch (err: any) {
      alert(err.message || 'Kunde inte ta bort uppgift');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateTask = async (deptName: string, title: string, desc: string) => {
    if (!user) return;
    try {
      setLoading(true);
      const deptEmps = users.filter(u => u.role === 'employee' && u.department === deptName).map(u => u.id);
      await dbService.createTask({
        title,
        description: desc,
        department: deptName,
        status: 'pending',
        assignedTo: deptEmps,
        createdBy: user.id
      }, user.id);
    } catch (err: any) {
      alert(err.message || 'Kunde inte skapa uppgift');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickToggleTaskStatus = async (task: Task, newStatus: 'pending' | 'in-progress' | 'completed') => {
    if (!user) return;
    try {
      await dbService.updateTask(task.id, { status: newStatus }, user.id, task);
    } catch (err: any) {
      alert(err.message || 'Kunde inte uppdatera status');
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      setLoading(true);
      await dbService.createDepartment(newDeptName, newDeptDesc);
      setNewDeptName('');
      setNewDeptDesc('');
      setShowAddDept(false);
    } catch (err: any) {
      alert(err.message || 'Kunde inte skapa avdelning');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDeptData || !editDeptData.name.trim()) return;
    try {
      setLoading(true);
      await dbService.updateDepartment(
        editDeptData.id,
        editDeptData.oldName,
        editDeptData.name,
        editDeptData.description
      );
      setEditDeptData(null);
    } catch (err: any) {
      alert(err.message || 'Kunde inte uppdatera avdelning');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!showDeleteDeptConfirm) return;
    try {
      setLoading(true);
      await dbService.deleteDepartment(showDeleteDeptConfirm.id, showDeleteDeptConfirm.name);
      setShowDeleteDeptConfirm(null);
    } catch (err: any) {
      alert(err.message || 'Kunde inte ta bort avdelning');
    } finally {
      setLoading(false);
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

  const handleUpdateDepartment = async () => {
    if (!showEditDept || !selectedDeptValue) return;
    try {
      setLoading(true);
      await dbService.updateUserDepartment(showEditDept.id, selectedDeptValue);
      setShowEditDept(null);
    } catch (err: any) {
      alert('Kunde inte uppdatera avdelning: ' + (err.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserData) return;

    if (editUserData.pin.length !== 4 || !/^\d+$/.test(editUserData.pin)) {
      alert('Pinkoden måste bestå av exakt 4 siffror.');
      return;
    }

    try {
      setLoading(true);
      await authService.updateUserFull(editUserData.id, editUserData.currentPin, {
        name: editUserData.name,
        role: editUserData.role,
        department: editUserData.department,
        pin: editUserData.pin,
        status: editUserData.status
      });
      alert(`Användaren ${editUserData.name} har uppdaterats.`);
      setEditUserData(null);
    } catch (err: any) {
      alert('Kunde inte uppdatera användaren: ' + (err.message || 'Okänt fel'));
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
            { id: 'departments', icon: Building2, label: 'Avdelningar' },
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
               activeTab === 'departments' ? 'Hantera Avdelningar' :
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
            {activeTab === 'departments' && (
              <button 
                onClick={() => setShowAddDept(true)}
                className="flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-5 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all"
              >
                <Plus className="w-5 h-5" /> Ny avdelning
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
                    <h3 className="text-2xl font-bold text-[#141414] dark:text-white mb-1 flex items-center gap-2">
                      <Users className="w-6 h-6" /> Användare & Medarbetare
                    </h3>
                    <p className="text-[#9e9e9e] dark:text-zinc-400 font-medium italic">
                      Fullständig hantering: Lägg till, redigera/ändra, uppdatera och ta bort medarbetare samt administratörer.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => {
                        setNewUserName('');
                        setNewUserPin('');
                        setNewUserDepartment(deptList[0] || DEFAULT_DEPARTMENTS[0]);
                        setNewUserRole('employee');
                        setShowAddUser(true);
                      }}
                      className="px-6 py-3 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Lägg till användare
                    </button>
                  </div>
                </div>

                {/* Search Bar & Department Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9e9e9e] dark:text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Sök medarbetare eller administratör på namn eller pinkod..."
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

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e9e9e] dark:text-zinc-500 whitespace-nowrap pl-1">
                      Avdelning:
                    </span>
                    <button
                      onClick={() => setUserDeptFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        userDeptFilter === 'all'
                          ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] shadow'
                          : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white border border-[#e5e5e5] dark:border-white/10'
                      }`}
                    >
                      Alla ({users.length})
                    </button>
                    {deptList.map(dept => {
                      const count = users.filter(u => u.department === dept).length;
                      return (
                        <button
                          key={dept}
                          onClick={() => setUserDeptFilter(dept)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            userDeptFilter === dept
                              ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] shadow'
                              : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white border border-[#e5e5e5] dark:border-white/10'
                          }`}
                        >
                          {dept} ({count})
                        </button>
                      );
                    })}
                  </div>
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
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            u.role === 'admin' 
                              ? 'bg-amber-500 text-white shadow-sm' 
                              : 'bg-[#141414] dark:bg-white dark:text-[#141414] text-white'
                          }`}>
                            {u.role === 'admin' ? <Shield className="w-4 h-4" /> : u.name[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-[#141414] dark:text-white">{u.name}</p>
                              {u.id === auth.currentUser?.uid && (
                                <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded">
                                  Du
                                </span>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 ${
                              u.role === 'admin'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
                            }`}>
                              {u.role === 'admin' ? 'Administratör' : 'Medarbetare'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#141414] dark:text-zinc-200 bg-white dark:bg-white/10 border border-[#e5e5e5] dark:border-white/10 px-2 py-1 rounded w-fit">
                            {u.department || 'Ej tilldelad'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeptValue(u.department || deptList[0] || DEFAULT_DEPARTMENTS[0]);
                              setShowEditDept({ id: u.id, name: u.name, currentDept: u.department || '' });
                            }}
                            className="p-1 hover:text-[#141414] dark:hover:text-white text-[#9e9e9e] dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 rounded transition-colors"
                            title="Snabbändra avdelning"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-bold bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-zinc-200 px-2 py-1 rounded w-fit">{u.pin}</code>
                          <button 
                            type="button"
                            onClick={() => setShowChangePin({ id: u.id, name: u.name, currentPin: u.pin })}
                            className="p-1 hover:text-[#141414] dark:hover:text-white text-[#9e9e9e] dark:text-zinc-400 transition-colors"
                            title="Snabbändra pinkod"
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
                        <div className="flex items-center justify-end gap-1.5 pr-4 text-[#141414] dark:text-white min-w-[150px]">
                          {/* Full Edit Button */}
                          <button 
                            type="button"
                            onClick={() => setEditUserData({
                              id: u.id,
                              name: u.name,
                              pin: u.pin,
                              currentPin: u.pin,
                              role: u.role,
                              department: u.department || deptList[0] || DEFAULT_DEPARTMENTS[0],
                              status: u.status || 'active'
                            })}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 transition-transform active:scale-95"
                            title="Redigera användare (Namn, Roll, Avdelning, Pinkod, Status)"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Message */}
                          <button 
                            type="button"
                            onClick={() => setShowSendMessage(u.id)}
                            className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-[#e5e5e5] dark:border-white/10 transition-transform active:scale-95"
                            title="Skicka meddelande"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Toggle status */}
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

                          {/* Delete */}
                          <button 
                            type="button"
                            disabled={loading || u.id === auth.currentUser?.uid}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm({ id: u.id, name: u.name, role: u.role });
                            }}
                            className={`p-2 rounded-lg shadow-sm border transition-all active:scale-95 ${
                              loading || u.id === auth.currentUser?.uid 
                                ? 'opacity-30 cursor-not-allowed bg-gray-50 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10' 
                                : 'hover:bg-red-50 dark:hover:bg-red-950/30 border-red-100 dark:border-red-900/30 text-red-500 hover:text-red-700'
                            }`}
                            title={u.id === auth.currentUser?.uid ? 'Du kan inte ta bort ditt eget konto' : 'Ta bort användare permanent'}
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

            {activeTab === 'departments' && (
              <div className="space-y-6">
                {/* Search & Stats Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-[#141418] p-4 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9e9e9e] dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Sök avdelning..."
                      value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)}
                      className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#9e9e9e] dark:text-zinc-400">
                      Totalt: <span className="text-[#141414] dark:text-white">{departments.length}</span> avdelningar
                    </span>
                    <button
                      onClick={() => setShowAddDept(true)}
                      className="flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-4 py-2.5 rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all"
                    >
                      <Plus className="w-4 h-4" /> Ny avdelning
                    </button>
                  </div>
                </div>

                {/* Departments Grid */}
                {filteredDepartments.length === 0 ? (
                  <div className="bg-white dark:bg-[#141418] p-12 rounded-[32px] border border-[#e5e5e5] dark:border-white/10 text-center">
                    <Building2 className="w-12 h-12 text-[#9e9e9e] dark:text-zinc-600 mx-auto mb-3 opacity-50" />
                    <h4 className="text-base font-bold text-[#141414] dark:text-white mb-1">Inga avdelningar hittades</h4>
                    <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-4">Skapa din första avdelning för att organisera personal och uppgifter.</p>
                    <button
                      onClick={() => setShowAddDept(true)}
                      className="inline-flex items-center gap-2 bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-5 py-2.5 rounded-xl text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" /> Skapa avdelning
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {filteredDepartments.map((dept) => {
                      const deptUsers = users.filter(u => u.department === dept.name);
                      const deptTasks = tasks.filter(t => t.department === dept.name || (t.assignedTo.length > 0 && users.filter(u => t.assignedTo.includes(u.id)).some(u => u.department === dept.name)));
                      const activeTasksCount = deptTasks.filter(t => t.status !== 'completed').length;
                      const completedTasksCount = deptTasks.filter(t => t.status === 'completed').length;
                      const templates = QUICK_TASK_TEMPLATES[dept.name] || [];

                      return (
                        <div
                          key={dept.id}
                          className="bg-white dark:bg-[#141418] rounded-[28px] border border-[#e5e5e5] dark:border-white/10 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[#141414] dark:bg-white dark:text-[#141414] text-white flex items-center justify-center font-bold shadow-sm">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-base text-[#141414] dark:text-white leading-tight">{dept.name}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                      {deptUsers.length} medarbetare
                                    </span>
                                    <span className="text-[10px] text-[#9e9e9e] dark:text-zinc-500">•</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e9e9e] dark:text-zinc-400">
                                      {deptTasks.length} uppgifter
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditDeptData({ id: dept.id, name: dept.name, oldName: dept.name, description: dept.description || '' })}
                                  className="p-2 hover:bg-[#f5f5f5] dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 rounded-xl transition-colors"
                                  title="Redigera avdelning"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowDeleteDeptConfirm({ id: dept.id, name: dept.name, userCount: deptUsers.length, taskCount: deptTasks.length })}
                                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-xl transition-colors"
                                  title="Ta bort avdelning"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 line-clamp-2 mb-4">
                              {dept.description || 'Ingen beskrivning angiven.'}
                            </p>

                            {/* Employees in Department */}
                            <div className="bg-[#f5f5f5] dark:bg-white/5 p-3 rounded-2xl mb-4 border border-[#e5e5e5]/50 dark:border-white/5">
                              <p className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 tracking-wider mb-2 flex items-center justify-between">
                                <span>Medarbetare ({deptUsers.length})</span>
                              </p>
                              {deptUsers.length === 0 ? (
                                <p className="text-[11px] text-[#9e9e9e] dark:text-zinc-500 italic">Inga medarbetare tilldelade än.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {deptUsers.slice(0, 8).map(u => (
                                    <span
                                      key={u.id}
                                      className="text-[11px] font-medium bg-white dark:bg-white/10 text-[#141414] dark:text-white px-2.5 py-1 rounded-lg shadow-2xs border border-[#e5e5e5]/50 dark:border-white/5"
                                    >
                                      {u.name}
                                    </span>
                                  ))}
                                  {deptUsers.length > 8 && (
                                    <span className="text-[10px] font-bold text-[#9e9e9e] dark:text-zinc-400 self-center px-1">
                                      +{deptUsers.length - 8} till
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Arbetsuppgifter som ingår i avdelningen */}
                            <div className="bg-[#f5f5f5] dark:bg-white/5 p-4 rounded-2xl mb-4 border border-[#e5e5e5]/60 dark:border-white/10">
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-4 h-4 text-[#141414] dark:text-white" />
                                  <span className="text-xs font-bold text-[#141414] dark:text-white">
                                    Arbetsuppgifter ({deptTasks.length})
                                  </span>
                                  {deptTasks.length > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-white/10 text-[#9e9e9e] dark:text-zinc-400">
                                      {activeTasksCount} aktiva
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewTaskDept(dept.name);
                                    setNewTaskTitle('');
                                    setNewTaskDesc('');
                                    const deptEmps = users.filter(u => u.role === 'employee' && u.department === dept.name).map(u => u.id);
                                    setSelectedTaskEmployees(deptEmps);
                                    setShowAddTask(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#141414] dark:bg-white text-white dark:text-[#141414] px-2.5 py-1 rounded-lg hover:opacity-90 transition-all shadow-2xs"
                                >
                                  <Plus className="w-3 h-3" /> Ny uppgift
                                </button>
                              </div>

                              {/* Quick template suggestions for this department */}
                              {templates.length > 0 && (
                                <div className="mb-3 pt-1">
                                  <p className="text-[9px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 tracking-wider mb-1.5 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-blue-500" /> Snabbmallar ({dept.name}):
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {templates.map((tmpl) => (
                                      <button
                                        key={tmpl.title}
                                        type="button"
                                        onClick={() => handleQuickCreateTask(dept.name, tmpl.title, tmpl.desc)}
                                        className="text-[10px] font-semibold py-1 px-2 bg-white dark:bg-white/10 text-[#141414] dark:text-white rounded-lg border border-[#e5e5e5] dark:border-white/10 hover:bg-[#141414] hover:text-white dark:hover:bg-white dark:hover:text-[#141414] transition-all text-left flex items-center gap-1"
                                        title={tmpl.desc}
                                      >
                                        <Plus className="w-2.5 h-2.5 opacity-60" /> {tmpl.title}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Task List */}
                              {deptTasks.length === 0 ? (
                                <div className="bg-white/60 dark:bg-white/5 rounded-xl p-4 text-center border border-dashed border-[#e5e5e5] dark:border-white/10">
                                  <p className="text-[11px] text-[#9e9e9e] dark:text-zinc-400 mb-2">
                                    Inga arbetsuppgifter skapade för {dept.name} än.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewTaskDept(dept.name);
                                      setNewTaskTitle('');
                                      setNewTaskDesc('');
                                      const deptEmps = users.filter(u => u.role === 'employee' && u.department === dept.name).map(u => u.id);
                                      setSelectedTaskEmployees(deptEmps);
                                      setShowAddTask(true);
                                    }}
                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    + Skapa första uppgiften
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                  {deptTasks.map((t) => {
                                    const assignedNames = users
                                      .filter(u => t.assignedTo.includes(u.id))
                                      .map(u => u.name);

                                    return (
                                      <div
                                        key={t.id}
                                        className="bg-white dark:bg-[#18181c] p-3 rounded-xl border border-[#e5e5e5] dark:border-white/10 shadow-2xs hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col gap-2"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <h5 className="text-xs font-bold text-[#141414] dark:text-white leading-tight">
                                                {t.title}
                                              </h5>
                                              {/* Status Pill with Quick Toggle */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextStatus: Record<string, 'pending' | 'in-progress' | 'completed'> = {
                                                    'pending': 'in-progress',
                                                    'in-progress': 'completed',
                                                    'completed': 'pending'
                                                  };
                                                  handleQuickToggleTaskStatus(t, nextStatus[t.status] || 'pending');
                                                }}
                                                title="Klicka för att ändra status"
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
                                                  t.status === 'completed'
                                                    ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300'
                                                    : t.status === 'in-progress'
                                                    ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                                                    : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                                                }`}
                                              >
                                                {t.status === 'completed' ? (
                                                  <><CheckCircle2 className="w-2.5 h-2.5" /> Slutförd</>
                                                ) : t.status === 'in-progress' ? (
                                                  <><Clock className="w-2.5 h-2.5" /> Pågår</>
                                                ) : (
                                                  <><CircleDot className="w-2.5 h-2.5" /> Väntar</>
                                                )}
                                              </button>
                                            </div>
                                            {t.description && (
                                              <p className="text-[11px] text-[#9e9e9e] dark:text-zinc-400 mt-1 line-clamp-2">
                                                {t.description}
                                              </p>
                                            )}
                                          </div>

                                          {/* Task Actions */}
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => setEditTaskData({
                                                id: t.id,
                                                title: t.title,
                                                description: t.description || '',
                                                department: t.department || dept.name,
                                                status: t.status,
                                                assignedTo: t.assignedTo || [],
                                                oldTask: t
                                              })}
                                              className="p-1 hover:bg-[#f5f5f5] dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 rounded transition-colors"
                                              title="Redigera uppgift"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setShowDeleteTaskConfirm({ id: t.id, title: t.title })}
                                              className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded transition-colors"
                                              title="Ta bort uppgift"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Assigned to footer */}
                                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-[#f5f5f5] dark:border-white/5">
                                          <span className="text-[#9e9e9e] dark:text-zinc-500">
                                            {assignedNames.length > 0 ? (
                                              <>Tilldelad: <strong className="text-[#141414] dark:text-zinc-300">{assignedNames.join(', ')}</strong></>
                                            ) : (
                                              <span className="italic">Alla i avdelningen</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="flex items-center justify-between pt-4 border-t border-[#f5f5f5] dark:border-white/5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${
                                activeTasksCount > 0 
                                  ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' 
                                  : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {activeTasksCount} aktiva
                              </span>
                              {completedTasksCount > 0 && (
                                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300">
                                  {completedTasksCount} klara
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewTaskDept(dept.name);
                                  setNewTaskTitle('');
                                  setNewTaskDesc('');
                                  const deptEmps = users.filter(u => u.role === 'employee' && u.department === dept.name).map(u => u.id);
                                  setSelectedTaskEmployees(deptEmps);
                                  setShowAddTask(true);
                                }}
                                className="text-xs font-bold text-[#141414] dark:text-white hover:underline decoration-1 flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Lägg till uppgift
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                {/* Search & Status Filters */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-[#141418] p-4 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9e9e9e] dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Sök uppgift eller beskrivning..."
                      value={taskSearch}
                      onChange={e => setTaskSearch(e.target.value)}
                      className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white"
                    />
                  </div>

                  {/* Status Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: 'Alla status' },
                      { id: 'pending', label: 'Väntar' },
                      { id: 'in-progress', label: 'Pågår' },
                      { id: 'completed', label: 'Slutförda' }
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => setTaskStatusFilter(s.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          taskStatusFilter === s.id
                            ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] shadow'
                            : 'bg-[#f5f5f5] dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department Filter for Tasks */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9e9e9e] dark:text-zinc-500 whitespace-nowrap pl-1">
                    Avdelning:
                  </span>
                  <button
                    onClick={() => setTaskDeptFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      taskDeptFilter === 'all'
                        ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] shadow'
                        : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white border border-[#e5e5e5] dark:border-white/10'
                    }`}
                  >
                    Alla Avdelningar ({tasks.length})
                  </button>
                  {deptList.map(dept => {
                    const count = tasks.filter(t => {
                      if (t.department) return t.department === dept;
                      const assignedUsers = users.filter(u => t.assignedTo.includes(u.id));
                      return assignedUsers.some(u => u.department === dept);
                    }).length;
                    return (
                      <button
                        key={dept}
                        onClick={() => setTaskDeptFilter(dept)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          taskDeptFilter === dept
                            ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] shadow'
                            : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 hover:text-[#141414] dark:hover:text-white border border-[#e5e5e5] dark:border-white/10'
                        }`}
                      >
                        {dept} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Active / In-progress tasks */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#141414] dark:text-white">
                        Aktiva / Väntande uppgifter {taskDeptFilter !== 'all' && <span className="text-sm font-normal text-[#9e9e9e] dark:text-zinc-400">({taskDeptFilter})</span>}
                      </h3>
                      <span className="text-xs font-bold text-[#9e9e9e] dark:text-zinc-500">
                        {filteredTasks.filter(t => t.status !== 'completed').length} st
                      </span>
                    </div>

                    {filteredTasks.filter(t => t.status !== 'completed').length === 0 ? (
                      <div className="bg-white dark:bg-[#141418] p-8 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 text-center">
                        <Briefcase className="w-8 h-8 text-[#9e9e9e] dark:text-zinc-600 mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 italic">Inga aktiva uppgifter för valt filter.</p>
                      </div>
                    ) : (
                      filteredTasks.filter(t => t.status !== 'completed').map(task => {
                        const assignedUsers = users.filter(u => task.assignedTo.includes(u.id));
                        const displayDept = task.department || Array.from(new Set(assignedUsers.map(u => u.department).filter(Boolean)))[0];
                        return (
                          <div key={task.id} className="bg-white dark:bg-[#141418] p-6 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 shadow-sm transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-[#141414] dark:text-white text-base">{task.title}</h4>
                                <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 line-clamp-2 mt-1">{task.description}</p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase py-1 px-2.5 rounded-lg shrink-0 ${
                                task.status === 'in-progress' 
                                  ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' 
                                  : 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400'
                              }`}>
                                {task.status === 'in-progress' ? 'Pågår' : 'Väntar'}
                              </span>
                            </div>

                            {/* Department Tags */}
                            {displayDept && (
                              <div className="flex flex-wrap gap-1.5 mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f5f5f5] dark:bg-white/10 text-[#141414] dark:text-zinc-300 px-2 py-0.5 rounded-md">
                                  {displayDept}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-[#f5f5f5] dark:border-white/5 pt-4">
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                  {task.assignedTo.map(uid => (
                                    <div key={uid} title={users.find(u => u.id === uid)?.name} className="w-8 h-8 rounded-full bg-[#141414] dark:bg-zinc-800 border-2 border-white dark:border-[#141418] text-white text-[10px] flex items-center justify-center font-bold">
                                      {users.find(u => u.id === uid)?.name[0] || '?'}
                                    </div>
                                  ))}
                                </div>
                                <span className="text-xs text-[#9e9e9e] dark:text-zinc-500 font-medium">
                                  {task.assignedTo.length > 0 ? `${task.assignedTo.length} tilldelade` : 'Alla i avdelningen'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditTaskData({
                                    id: task.id,
                                    title: task.title,
                                    description: task.description,
                                    department: task.department || displayDept || deptList[0],
                                    status: task.status,
                                    assignedTo: task.assignedTo,
                                    oldTask: task
                                  })}
                                  className="text-xs font-bold text-blue-600 dark:text-blue-400 p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
                                  title="Redigera uppgift"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => user && dbService.updateTask(task.id, { status: 'completed' }, user.id, task)} 
                                  className="text-xs font-bold text-green-600 dark:text-green-400 px-3 py-2 bg-green-50 dark:bg-green-950/40 rounded-xl hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors"
                                >
                                  Slutför
                                </button>
                                <button 
                                  onClick={() => setShowDeleteTaskConfirm({ id: task.id, title: task.title })} 
                                  className="text-xs font-bold text-red-500 dark:text-red-400 p-2 bg-red-50 dark:bg-red-950/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
                                  title="Ta bort uppgift"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Completed tasks */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#141414] dark:text-white">Slutförda uppgifter</h3>
                      <span className="text-xs font-bold text-[#9e9e9e] dark:text-zinc-500">
                        {filteredTasks.filter(t => t.status === 'completed').length} st
                      </span>
                    </div>

                    {filteredTasks.filter(t => t.status === 'completed').length === 0 ? (
                      <div className="bg-white/60 dark:bg-[#141418]/60 p-8 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 text-center">
                        <p className="text-sm text-[#9e9e9e] dark:text-zinc-500 italic">Inga slutförda uppgifter för valt filter.</p>
                      </div>
                    ) : (
                      filteredTasks.filter(t => t.status === 'completed').map(task => (
                        <div key={task.id} className="bg-white/60 dark:bg-[#141418]/60 p-6 rounded-[24px] border border-[#e5e5e5] dark:border-white/10 opacity-80 backdrop-blur-sm transition-colors flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-[#141414] dark:text-zinc-300 line-through decoration-[#9e9e9e]">{task.title}</h4>
                            <p className="text-xs text-[#9e9e9e] dark:text-zinc-500 mt-1">{task.description}</p>
                            <p className="text-[10px] text-[#9e9e9e] dark:text-zinc-500 mt-1">Avslutad {task.completedAt ? task.completedAt.toDate().toLocaleDateString('sv-SE') : 'Tidigare'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => user && dbService.updateTask(task.id, { status: 'in-progress' }, user.id, task)}
                              className="text-xs font-bold text-amber-600 dark:text-amber-400 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg hover:bg-amber-100 transition-colors"
                              title="Återaktivera uppgift"
                            >
                              Återaktivera
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDeleteTaskConfirm({ id: task.id, title: task.title })}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title="Ta bort"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
        {/* ADD USER MODAL */}
        {showAddUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddUser(false)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <UserPlus className="w-6 h-6" /> Lägg till användare
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 italic">Skapa en ny medarbetare eller administratör i systemet.</p>
              
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Fullständigt namn</label>
                  <input required placeholder="T.ex. Johan Arvidsson" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">4-siffrig pinkod (för inloggning)</label>
                  <input required maxLength={4} pattern="\d{4}" placeholder="T.ex. 1234" value={newUserPin} onChange={e => setNewUserPin(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-mono font-bold outline-none transition-all text-[#141414] dark:text-white mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelning</label>
                  <select 
                    value={newUserDepartment} 
                    onChange={e => setNewUserDepartment(e.target.value)}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    {deptList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Behörighet / Roll</label>
                  <select 
                    value={newUserRole} 
                    onChange={e => setNewUserRole(e.target.value as any)}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    <option value="employee">Medarbetare</option>
                    <option value="admin">Administratör (Admin-behörighet)</option>
                  </select>
                </div>
                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={loading} className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                    {loading ? 'Skapar användare...' : 'Skapa användare'}
                  </button>
                  <button type="button" onClick={() => setShowAddUser(false)} className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* ADD DEPARTMENT MODAL */}
        {showAddDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddDept(false)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Building2 className="w-6 h-6" /> Ny avdelning
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 italic">Lägg till en ny avdelning för att strukturera team och uppgifter.</p>
              
              <form onSubmit={handleAddDepartment} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelningens namn</label>
                  <input 
                    required 
                    placeholder="T.ex. Kvalitetskontroll eller Logistik" 
                    value={newDeptName} 
                    onChange={e => setNewDeptName(e.target.value)} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white mt-1" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Beskrivning (valfritt)</label>
                  <textarea 
                    rows={3} 
                    placeholder="Beskriv avdelningens ansvarsområde..." 
                    value={newDeptDesc} 
                    onChange={e => setNewDeptDesc(e.target.value)} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none text-[#141414] dark:text-white mt-1" 
                  />
                </div>
                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={loading || !newDeptName.trim()} className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                    {loading ? 'Skapar avdelning...' : 'Skapa avdelning'}
                  </button>
                  <button type="button" onClick={() => setShowAddDept(false)} className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* EDIT DEPARTMENT MODAL */}
        {editDeptData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditDeptData(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Redigera avdelning
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 italic">Ändring av namn uppdaterar automatiskt alla kopplade medarbetare och uppgifter.</p>
              
              <form onSubmit={handleSaveEditDepartment} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelningsnamn</label>
                  <input 
                    required 
                    value={editDeptData.name} 
                    onChange={e => setEditDeptData({ ...editDeptData, name: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white mt-1" 
                  />
                  {editDeptData.name !== editDeptData.oldName && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 pl-1 font-medium">
                      Namnbytet ändras från "{editDeptData.oldName}" till "{editDeptData.name}".
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Beskrivning</label>
                  <textarea 
                    rows={3} 
                    value={editDeptData.description} 
                    onChange={e => setEditDeptData({ ...editDeptData, description: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none text-[#141414] dark:text-white mt-1" 
                  />
                </div>
                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={loading || !editDeptData.name.trim()} className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                    {loading ? 'Sparar ändringar...' : 'Spara ändringar'}
                  </button>
                  <button type="button" onClick={() => setEditDeptData(null)} className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* DELETE DEPARTMENT CONFIRM MODAL */}
        {showDeleteDeptConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteDeptConfirm(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-red-100 dark:border-red-900/30">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Ta bort avdelning?</h3>
              <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 text-center mb-4">
                Är du säker på att du vill ta bort avdelningen <span className="font-bold text-[#141414] dark:text-white">"{showDeleteDeptConfirm.name}"</span>?
              </p>
              
              <div className="bg-[#f5f5f5] dark:bg-white/5 p-3 rounded-2xl mb-6 text-xs text-[#141414] dark:text-zinc-300">
                <p className="font-bold mb-1">Påverkade resurser:</p>
                <p>• {showDeleteDeptConfirm.userCount} medarbetare avregistreras från avdelningen.</p>
                <p>• {showDeleteDeptConfirm.taskCount} uppgifter uppdateras.</p>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={handleDeleteDepartment}
                  disabled={loading}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Tar bort...' : 'Ja, ta bort avdelning'}
                </button>
                <button 
                  onClick={() => setShowDeleteDeptConfirm(null)}
                  disabled={loading}
                  className="w-full py-3 text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors text-sm"
                >
                  Avbryt
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ADD TASK MODAL */}
        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTask(false)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Briefcase className="w-6 h-6" /> Skapa arbetsuppgift
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-4 italic">Skapa en uppgift för en specifik avdelning eller person.</p>
              
              {/* Quick Template Picker for Plock */}
              <div className="mb-4 bg-[#f5f5f5] dark:bg-white/5 p-3 rounded-2xl border border-[#e5e5e5] dark:border-white/10">
                <p className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 tracking-wider mb-2">
                  Snabbval: Plock Zoner (Zon 1 - Zon 7)
                </p>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                  {QUICK_TASK_TEMPLATES['Plock']?.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => {
                        setNewTaskTitle(tmpl.title);
                        setNewTaskDesc(tmpl.desc);
                        setNewTaskDept('Plock');
                        const plockEmps = users.filter(u => u.role === 'employee' && u.department === 'Plock').map(u => u.id);
                        if (plockEmps.length > 0 && selectedTaskEmployees.length === 0) {
                          setSelectedTaskEmployees(plockEmps);
                        }
                      }}
                      className="text-[11px] font-bold py-1.5 px-1 bg-white dark:bg-white/10 text-[#141414] dark:text-white rounded-xl border border-[#e5e5e5] dark:border-white/10 hover:bg-[#141414] hover:text-white dark:hover:bg-white dark:hover:text-[#141414] transition-all text-center"
                    >
                      {tmpl.title.replace('Plock ', '')}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Titel</label>
                  <input required placeholder="T.ex. Plock Zon 3 eller Leveranskontroll" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white" />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelning</label>
                  <select
                    value={newTaskDept}
                    onChange={e => setNewTaskDept(e.target.value)}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    {deptList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Beskrivning</label>
                  <textarea rows={3} placeholder="Vad behöver göras?" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none text-[#141414] dark:text-white" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Tilldela medarbetare (valfritt)</label>
                    <span className="text-[10px] text-[#9e9e9e] dark:text-zinc-400 font-bold">{selectedTaskEmployees.length} valda</span>
                  </div>
                  
                  {/* Quick Select by Department */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allEmpIds = users.filter(u => u.role === 'employee').map(u => u.id);
                        setSelectedTaskEmployees(prev => prev.length === allEmpIds.length ? [] : allEmpIds);
                      }}
                      className="text-[10px] font-bold px-2 py-1 bg-[#f5f5f5] dark:bg-white/10 rounded-lg text-[#141414] dark:text-white hover:opacity-80"
                    >
                      {selectedTaskEmployees.length === users.filter(u => u.role === 'employee').length ? 'Avmarkera alla' : 'Alla'}
                    </button>
                    {deptList.map(dept => {
                      const deptEmpIds = users.filter(u => u.role === 'employee' && u.department === dept).map(u => u.id);
                      if (deptEmpIds.length === 0) return null;
                      const allSelected = deptEmpIds.every(id => selectedTaskEmployees.includes(id));
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setSelectedTaskEmployees(prev => prev.filter(id => !deptEmpIds.includes(id)));
                            } else {
                              setSelectedTaskEmployees(prev => Array.from(new Set([...prev, ...deptEmpIds])));
                            }
                          }}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                            allSelected 
                              ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] border-transparent' 
                              : 'bg-white dark:bg-white/5 text-[#9e9e9e] dark:text-zinc-400 border-[#e5e5e5] dark:border-white/10'
                          }`}
                        >
                          + {dept}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {users.filter(u => u.role === 'employee').map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedTaskEmployees(prev => prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id])}
                        className={`text-xs p-2 rounded-xl border-2 transition-all font-bold text-left flex flex-col justify-between ${
                          selectedTaskEmployees.includes(emp.id) 
                            ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] border-[#141414] dark:border-white shadow-sm' 
                            : 'bg-white dark:bg-white/5 text-[#141414] dark:text-zinc-300 border-[#f5f5f5] dark:border-white/10 hover:border-[#d1d1d1] dark:hover:border-white/20'
                        }`}
                      >
                        <span className="truncate">{emp.name}</span>
                        {emp.department && (
                          <span className={`text-[9px] font-normal uppercase tracking-wider mt-0.5 ${
                            selectedTaskEmployees.includes(emp.id)
                              ? 'text-zinc-300 dark:text-zinc-600'
                              : 'text-[#9e9e9e] dark:text-zinc-500'
                          }`}>
                            {emp.department}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={loading} className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                    {loading ? 'Skapar uppgift...' : 'Skapa uppgift'}
                  </button>
                  <button type="button" onClick={() => setShowAddTask(false)} className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* EDIT TASK MODAL */}
        {editTaskData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTaskData(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Redigera uppgift
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 italic">Ändra titel, beskrivning, avdelning, status eller tilldelade medarbetare.</p>
              
              <form onSubmit={handleSaveEditTask} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Titel</label>
                  <input 
                    required 
                    value={editTaskData.title} 
                    onChange={e => setEditTaskData({ ...editTaskData, title: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelning</label>
                  <select 
                    value={editTaskData.department || deptList[0]} 
                    onChange={e => setEditTaskData({ ...editTaskData, department: e.target.value })}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    {deptList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Status</label>
                  <select 
                    value={editTaskData.status} 
                    onChange={e => setEditTaskData({ ...editTaskData, status: e.target.value as any })}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    <option value="pending">Väntar (pending)</option>
                    <option value="in-progress">Pågår (in-progress)</option>
                    <option value="completed">Slutförd (completed)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Beskrivning</label>
                  <textarea 
                    rows={3} 
                    value={editTaskData.description} 
                    onChange={e => setEditTaskData({ ...editTaskData, description: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all resize-none text-[#141414] dark:text-white" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Tilldela medarbetare</label>
                    <span className="text-[10px] text-[#9e9e9e] dark:text-zinc-400 font-bold">{editTaskData.assignedTo.length} valda</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {users.filter(u => u.role === 'employee').map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setEditTaskData({
                          ...editTaskData,
                          assignedTo: editTaskData.assignedTo.includes(emp.id)
                            ? editTaskData.assignedTo.filter(id => id !== emp.id)
                            : [...editTaskData.assignedTo, emp.id]
                        })}
                        className={`text-xs p-2 rounded-xl border-2 transition-all font-bold text-left flex flex-col justify-between ${
                          editTaskData.assignedTo.includes(emp.id) 
                            ? 'bg-[#141414] dark:bg-white text-white dark:text-[#141414] border-[#141414] dark:border-white shadow-sm' 
                            : 'bg-white dark:bg-white/5 text-[#141414] dark:text-zinc-300 border-[#f5f5f5] dark:border-white/10 hover:border-[#d1d1d1] dark:hover:border-white/20'
                        }`}
                      >
                        <span className="truncate">{emp.name}</span>
                        {emp.department && (
                          <span className={`text-[9px] font-normal uppercase tracking-wider mt-0.5 ${
                            editTaskData.assignedTo.includes(emp.id)
                              ? 'text-zinc-300 dark:text-zinc-600'
                              : 'text-[#9e9e9e] dark:text-zinc-500'
                          }`}>
                            {emp.department}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button type="submit" disabled={loading} className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50">
                    {loading ? 'Sparar ändringar...' : 'Spara ändringar'}
                  </button>
                  <button type="button" onClick={() => setEditTaskData(null)} className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors">
                    Avbryt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* DELETE TASK CONFIRM MODAL */}
        {showDeleteTaskConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteTaskConfirm(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-red-100 dark:border-red-900/30">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Ta bort uppgift?</h3>
              <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 text-center mb-6">
                Är du säker på att du vill ta bort uppgiften <span className="font-bold text-[#141414] dark:text-white">"{showDeleteTaskConfirm.title}"</span>?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleDeleteTask}
                  disabled={loading}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Tar bort...' : 'Ja, ta bort uppgift'}
                </button>
                <button 
                  onClick={() => setShowDeleteTaskConfirm(null)}
                  disabled={loading}
                  className="w-full py-3 text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors text-sm"
                >
                  Avbryt
                </button>
              </div>
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

        {showEditDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditDept(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Ändra avdelning
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 tracking-wide uppercase font-bold">För {showEditDept.name}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Välj ny avdelning</label>
                  <select
                    value={selectedDeptValue}
                    onChange={e => setSelectedDeptValue(e.target.value)}
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-bold outline-none transition-all mt-1 text-[#141414] dark:text-white cursor-pointer"
                  >
                    {deptList.map(dept => (
                      <option key={dept} value={dept} className="bg-white dark:bg-[#18181c] text-[#141414] dark:text-white">
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={handleUpdateDepartment}
                    disabled={loading}
                    className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sparar...' : 'Spara avdelning'}
                  </button>
                  <button 
                    onClick={() => setShowEditDept(null)}
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

        {/* Full Edit User Modal */}
        {editUserData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditUserData(null)} className="absolute inset-0 bg-[#141414]/40 dark:bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#18181c] text-[#141414] dark:text-white rounded-[32px] shadow-2xl p-8 border border-[#e5e5e5] dark:border-white/10 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Redigera användare
              </h3>
              <p className="text-xs text-[#9e9e9e] dark:text-zinc-400 mb-6 italic">Uppdatera namn, behörighet, avdelning, pinkod och status.</p>
              
              <form onSubmit={handleSaveEditUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Fullständigt namn</label>
                  <input 
                    required 
                    placeholder="Namn" 
                    value={editUserData.name} 
                    onChange={e => setEditUserData({ ...editUserData, name: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all text-[#141414] dark:text-white mt-1" 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Behörighet / Roll</label>
                  <select 
                    value={editUserData.role} 
                    onChange={e => setEditUserData({ ...editUserData, role: e.target.value as any })}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    <option value="employee">Medarbetare</option>
                    <option value="admin">Administratör (Full åtkomst)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Avdelning</label>
                  <select 
                    value={editUserData.department} 
                    onChange={e => setEditUserData({ ...editUserData, department: e.target.value })}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    {deptList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">4-siffrig Pinkod</label>
                  <input 
                    required 
                    maxLength={4} 
                    pattern="\d{4}" 
                    placeholder="T.ex. 1234" 
                    value={editUserData.pin} 
                    onChange={e => setEditUserData({ ...editUserData, pin: e.target.value })} 
                    className="w-full bg-[#f5f5f5] dark:bg-white/5 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-mono font-bold outline-none transition-all text-[#141414] dark:text-white mt-1" 
                  />
                  {editUserData.pin !== editUserData.currentPin && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 pl-1 font-medium">
                      Pinkoden kommer att ändras från {editUserData.currentPin} till {editUserData.pin}.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] dark:text-zinc-400 pl-1 tracking-wider">Konto-status</label>
                  <select 
                    value={editUserData.status} 
                    onChange={e => setEditUserData({ ...editUserData, status: e.target.value as any })}
                    className="w-full bg-[#f5f5f5] dark:bg-zinc-800 border-2 border-transparent focus:border-[#141414] dark:focus:border-white/30 rounded-2xl p-4 text-sm font-medium outline-none transition-all appearance-none text-[#141414] dark:text-white mt-1 cursor-pointer"
                  >
                    <option value="active">Aktiv (Kan logga in och arbeta)</option>
                    <option value="inactive">Inaktiv (Inloggning spärrad)</option>
                  </select>
                </div>

                <div className="pt-3 space-y-2">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-4 bg-[#141414] dark:bg-white text-white dark:text-[#141414] rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sparar ändringar...' : 'Spara ändringar'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditUserData(null)} 
                    className="w-full py-2.5 text-xs text-[#9e9e9e] dark:text-zinc-400 font-bold hover:text-[#141414] dark:hover:text-white transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </form>
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
              <h3 className="text-xl font-bold text-center mb-2">Ta bort användare?</h3>
              <p className="text-sm text-[#9e9e9e] dark:text-zinc-400 text-center mb-8">
                Är du säker på att du vill ta bort <span className="font-bold text-[#141414] dark:text-white">{showDeleteConfirm.name}</span>{showDeleteConfirm.role === 'admin' ? ' (Administratör)' : ''}? 
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
