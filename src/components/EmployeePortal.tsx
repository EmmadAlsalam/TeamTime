import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  Play, 
  Square, 
  MessageSquare, 
  LogOut, 
  Calendar,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Clock3,
  Send,
  Pause,
  Timer
} from 'lucide-react';
import { dbService, Task, TimeLog, Message } from '../services/dbService';
import { motion, AnimatePresence } from 'motion/react';

const RECEPTION_DEFAULT_TASKS = [
  { id: 'rec_1', title: 'Ankomstkontroll', description: 'Kontrollera inkommande paket mot följesedel.' },
  { id: 'rec_2', title: 'Sortering', description: 'Sortera artiklar till rätt inlagringszoner.' },
  { id: 'rec_3', title: 'Avvikelsehantering', description: 'Registrera skadade eller felaktiga leveranser.' },
  { id: 'rec_4', title: 'Uppackning', description: 'Packa upp pallar och förbereda för hyllplats.' },
  { id: 'rec_5', title: 'Städning Mottagning', description: 'Håll rent och snyggt vid mottagningskajen.' }
];

export const EmployeePortal: React.FC = () => {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userLogs, setUserLogs] = useState<TimeLog[]>([]);
  const [activeTask, setActiveTask] = useState<Task | any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [timer, setTimer] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [mood, setMood] = useState<'good' | 'bad' | 'ok' | null>(null);
  const [summary, setSummary] = useState('');
  const [reportSubmittedToday, setReportSubmittedToday] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const lastCheckInLog = userLogs.find(l => l.taskId === 'check_in');
  const isClockedIn = !!lastCheckInLog && lastCheckInLog.type === 'start';
  
  const lastBreakLog = userLogs.find(l => l.taskId === 'break');
  const isPaused = !!lastBreakLog && lastBreakLog.type === 'start';

  // Check if report submitted today on load
  useEffect(() => {
    if (user) {
      const checkReport = async () => {
        try {
          const hasReport = await dbService.hasSubmittedReportToday(user.id);
          setReportSubmittedToday(hasReport);
        } catch (err) {
          console.error("Error checking today's report:", err);
        }
      };
      checkReport();
    }
  }, [user]);

  // Calculate total rest time from logs
  const totalRestTime = React.useMemo(() => {
    if (!isClockedIn) return 0;
    
    let totalSeconds = 0;
    const breakLogs = [...userLogs]
      .filter(l => l.taskId === 'break')
      .reverse();

    for (let i = 0; i < breakLogs.length; i += 2) {
      const start = breakLogs[i];
      const end = breakLogs[i+1];
      
      if (start && start.type === 'start' && start.timestamp) {
        const startTime = start.timestamp.toDate().getTime();
        const endTime = (end && end.type === 'end' && end.timestamp)
          ? end.timestamp.toDate().getTime() 
          : Date.now();
        
        totalSeconds += Math.floor((endTime - startTime) / 1000);
      }
    }
    return totalSeconds;
  }, [userLogs, isClockedIn]);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubTasks = dbService.subscribeToTasks((allTasks) => {
      setTasks(allTasks.filter(t => t.assignedTo.includes(user.id)));
    });
    const unsubMessages = dbService.subscribeToMyMessages(user.id, setMessages);
    const unsubLogs = dbService.subscribeToUserLogs(user.id, setUserLogs);
    
    return () => {
      unsubTasks();
      unsubMessages();
      unsubLogs();
    };
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (activeTask && !isPaused) {
      // Calculate initial timer based on last log to handle refreshes
      const lastTaskLog = userLogs.find(l => l.taskId === activeTask.id && l.type === 'start');
      if (lastTaskLog && lastTaskLog.timestamp) {
        const elapsed = Math.floor((Date.now() - lastTaskLog.timestamp.toDate().getTime()) / 1000);
        setTimer(elapsed > 0 ? elapsed : 0);
      }
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [activeTask, isPaused, userLogs]);

  useEffect(() => {
    let interval: any;
    if (isPaused) {
      const lastLog = userLogs[0];
      if (lastLog && lastLog.taskId === 'break' && lastLog.type === 'start' && lastLog.timestamp) {
        const elapsed = Math.floor((Date.now() - lastLog.timestamp.toDate().getTime()) / 1000);
        setRestTimer(elapsed > 0 ? elapsed : 0);
      }
      interval = setInterval(() => setRestTimer(prev => prev + 1), 1000);
    } else {
      setRestTimer(0);
    }
    return () => clearInterval(interval);
  }, [isPaused, userLogs]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClockIn = async () => {
    try {
      await dbService.logTime(user!.id, 'check_in', 'start');
      alert('God morgon! Du är nu instämplad.');
    } catch (err: any) {
      alert('Kunde inte stämpla in: ' + err.message);
    }
  };

  const handleClockOut = async () => {
    if (!reportSubmittedToday) {
      alert('Du måste skicka in din dagsrapport innan du kan stämpla ut!');
      document.getElementById('report-section')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    try {
      if (activeTask) await handleStopTask();
      if (isPaused) await handleResume();
      await dbService.logTime(user!.id, 'check_in', 'end');
      alert('Bra jobbat idag! Du har stämplat ut.');
      setReportSubmittedToday(false); // Reset for next day/session
    } catch (err: any) {
      alert('Kunde inte stämpla ut: ' + err.message);
    }
  };

  const handlePause = async () => {
    try {
      if (activeTask) {
        // Just pause logic - we keep activeTask state but log 'end' for the log
        // Actually, let's just log a break start.
      }
      await dbService.logTime(user!.id, 'break', 'start');
    } catch (err: any) {
      alert('Kunde inte starta rasten: ' + err.message);
    }
  };

  const handleResume = async () => {
    try {
      await dbService.logTime(user!.id, 'break', 'end');
    } catch (err: any) {
      alert('Kunde inte avsluta rasten: ' + err.message);
    }
  };

  const handleStartTask = async (task: Task | any) => {
    if (!isClockedIn) {
      alert('Du måste stämpla in först!');
      return;
    }
    if (isPaused) {
      alert('Du kan inte starta en uppgift medan du har rast!');
      return;
    }
    try {
      if (activeTask) {
        await dbService.logTime(user!.id, activeTask.id, 'end');
      }
      setActiveTask(task);
      await dbService.logTime(user!.id, task.id, 'start');
    } catch (err: any) {
      alert('Kunde inte starta uppgiften: ' + err.message);
    }
  };

  const handleStopTask = async () => {
    if (activeTask) {
      try {
        await dbService.logTime(user!.id, activeTask.id, 'end');
        setActiveTask(null);
      } catch (err: any) {
        alert('Kunde inte avsluta uppgiften: ' + err.message);
      }
    }
  };

  const handleSubmitReport = async () => {
    if (!mood || !user) return;
    try {
      await dbService.submitDailyReport(user.id, mood, summary || "Dagsrapport skickad via portal");
      setMood(null);
      setSummary('');
      setReportSubmittedToday(true);
      alert('Rapport skickad! Nu kan du stämpla ut när du är klar.');
    } catch (err: any) {
      alert('Kunde inte skicka rapport: ' + err.message);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  const displayTasks = tasks.length > 0 ? tasks : (user?.department === 'Mottagning' ? RECEPTION_DEFAULT_TASKS : []);

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20">
      {/* Header */}
      <header className="bg-white border-b border-[#e5e5e5] px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white font-bold">
              {user?.name[0]}
            </div>
            <div>
              <h2 className="font-bold text-[#141414] leading-none mb-1">{user?.name}</h2>
              <p className="text-[10px] text-[#9e9e9e] uppercase tracking-wider font-semibold">
                {user?.department} | Medarbetare
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowInbox(true)}
              className="relative p-2 hover:bg-[#f5f5f5] rounded-full transition-colors"
            >
              <Inbox className="w-6 h-6 text-[#141414]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={logout}
              className="p-2 hover:bg-[#f5f5f5] rounded-full text-red-500 transition-colors"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Clock In/Out & Session Info */}
        <section className="bg-white rounded-[32px] p-8 shadow-sm border border-[#e5e5e5] flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className={`p-5 rounded-3xl transition-colors ${isClockedIn ? (isPaused ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600') : 'bg-red-50 text-red-500'}`}>
              {isPaused ? <Coffee className="w-10 h-10" /> : <Clock3 className="w-10 h-10" />}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#141414]">
                {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </h3>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold uppercase tracking-widest text-[#9e9e9e]">
                  {isClockedIn ? (isPaused ? 'Du har rast' : 'Du arbetar') : 'Du är ej instämplad'}
                </p>
                {isClockedIn && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Timer className="w-3 h-3" />
                    Rast: {formatTime(totalRestTime + restTimer)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {!isClockedIn ? (
              <button 
                onClick={handleClockIn}
                className="flex-1 md:flex-none px-12 py-4 bg-[#141414] text-white rounded-2xl font-bold shadow-xl hover:bg-[#333] transition-all flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5 fill-current" /> Stämpla in
              </button>
            ) : (
              <>
                {!isPaused ? (
                  <button 
                    onClick={handlePause}
                    className="flex-1 md:flex-none px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-3"
                  >
                    <Coffee className="w-5 h-5" /> Ta rast
                  </button>
                ) : (
                  <button 
                    onClick={handleResume}
                    className="flex-1 md:flex-none px-8 py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-3 animate-pulse"
                  >
                    <Play className="w-5 h-5 fill-current" /> Återuppta
                  </button>
                )}
                <button 
                  onClick={handleClockOut}
                  className={`flex-1 md:flex-none px-8 py-4 rounded-2xl font-bold shadow-sm transition-all flex items-center justify-center gap-3 border-2 ${
                    reportSubmittedToday 
                    ? 'border-red-500 text-red-500 hover:bg-red-50' 
                    : 'border-[#e5e5e5] text-[#9e9e9e] bg-[#f5f5f5] cursor-help'
                  }`}
                  title={!reportSubmittedToday ? 'Skicka dagsrapport först' : 'Stämpla ut'}
                >
                  <Square className="w-5 h-5 fill-current" /> Stämpla ut
                </button>
              </>
            )}
          </div>
        </section>

        {/* Active Task Info */}
        {activeTask && !isPaused && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#141414] text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="relative flex items-center justify-between gap-8">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mb-2">Aktiv uppgift pågår</p>
                <h4 className="text-3xl font-bold mb-2">{activeTask.title}</h4>
                <p className="text-white/60 text-sm italic">"{activeTask.description}"</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-mono font-bold mb-4 tracking-tighter">
                  {formatTime(timer)}
                </div>
                <button 
                  onClick={handleStopTask}
                  className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ml-auto"
                >
                  <Square className="w-4 h-4 fill-current" /> Avsluta pass
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Tasks Grid */}
        <section className={`${!isClockedIn || isPaused ? 'opacity-50 pointer-events-none grayscale' : ''} transition-all`}>
          <div className="flex items-center justify-between mb-6 pl-2">
            <h3 className="text-xl font-bold text-[#141414]">
              {isClockedIn ? (isPaused ? 'Rast pågår...' : 'Välj Uppgift') : 'Stämpla in för att se uppgifter'}
            </h3>
            <span className="text-xs font-bold text-[#9e9e9e] uppercase tracking-widest bg-[#e5e5e5] px-3 py-1 rounded-full">
              {displayTasks.length} tillgängliga
            </span>
          </div>
          
          {displayTasks.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-[#e5e5e5] rounded-[32px] p-16 text-center">
              <CheckCircle2 className="w-16 h-16 text-[#d1d1d1] mx-auto mb-4" />
              <p className="text-[#9e9e9e] font-serif italic text-lg">Inga tilldelade uppgifter just nu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayTasks.map(task => (
                <motion.div 
                  layout
                  key={task.id}
                  className={`bg-white rounded-[32px] p-8 shadow-sm border-2 transition-all group ${
                    activeTask?.id === task.id ? 'border-[#141414] shadow-xl' : 'border-transparent hover:border-[#e5e5e5]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl font-bold text-[#141414]">{task.title}</h4>
                    <div className={`p-2 rounded-lg transition-colors ${activeTask?.id === task.id ? 'bg-[#141414] text-white' : 'bg-[#f5f5f5] text-[#9e9e9e]'}`}>
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <p className="text-sm text-[#9e9e9e] mb-8 leading-relaxed font-medium">{task.description}</p>
                  
                  {activeTask?.id === task.id ? (
                    <button 
                      onClick={handleStopTask}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg"
                    >
                      <Square className="w-4 h-4 fill-current" /> Avsluta
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleStartTask(task)}
                      disabled={!isClockedIn}
                      className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all shadow-sm ${
                        isClockedIn 
                        ? 'bg-[#f5f5f5] text-[#141414] hover:bg-[#141414] hover:text-white' 
                        : 'bg-[#eeeeee] text-[#9e9e9e] cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" /> {isClockedIn ? 'Starta uppgift' : 'Stämpla in först'}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Daily Mood / Report */}
        <section id="report-section" className="bg-white rounded-[40px] p-10 shadow-sm border border-[#e5e5e5]">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-[#141414] mb-2 text-center">Hur har dagen varit?</h3>
            {reportSubmittedToday ? (
              <div className="bg-green-50 rounded-[32px] p-8 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-green-700 mb-2">Tack för din feedback!</h4>
                <p className="text-green-600 text-sm font-medium">Din dagsrapport har tagits emot. Bra jobbat idag!</p>
              </div>
            ) : (
              <>
                <p className="text-[#9e9e9e] text-sm mb-10 text-center font-medium italic">Vi bryr oss om din arbetsdag. Skriv en kort kommentar och välj din känsla.</p>
                
                <div className="flex gap-6 mb-10">
                  {[
                    { id: 'good', icon: '😊', label: 'Bra', color: 'hover:bg-green-50 text-green-600', active: 'border-green-500 bg-green-50' },
                    { id: 'ok', icon: '😐', label: 'Okej', color: 'hover:bg-yellow-50 text-yellow-600', active: 'border-yellow-400 bg-yellow-50' },
                    { id: 'bad', icon: '😔', label: 'Tuff', color: 'hover:bg-red-50 text-red-600', active: 'border-red-500 bg-red-50' }
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMood(m.id as any)}
                      className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-[32px] border-4 transition-all ${
                        mood === m.id 
                          ? m.active + ' scale-105 shadow-md' 
                          : 'border-transparent bg-[#f5f5f5] ' + m.color
                      }`}
                    >
                      <span className="text-4xl">{m.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-widest">{m.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mb-8">
                  <label className="text-[10px] font-bold uppercase text-[#9e9e9e] pl-4 tracking-[0.2em]">Kommentar om dagen</label>
                  <textarea 
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="Skriv något om ditt pass eller eventuella hinder..."
                    className="w-full bg-[#f5f5f5] border-2 border-transparent focus:border-[#141414] rounded-3xl p-6 text-sm font-medium outline-none transition-all min-h-[120px] shadow-inner"
                  />
                </div>

                <button 
                  disabled={!mood}
                  onClick={handleSubmitReport}
                  className={`w-full py-5 rounded-[24px] font-bold transition-all shadow-xl flex items-center justify-center gap-3 ${
                    mood 
                      ? 'bg-[#141414] text-white hover:bg-[#333] hover:-translate-y-1' 
                      : 'bg-[#e5e5e5] text-[#9e9e9e] cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" /> Skicka dagsrapport
                </button>
              </>
            )}
          </div>
        </section>
      </main>

      {/* Messages Modal */}
      <AnimatePresence>
        {showInbox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInbox(false)}
              className="absolute inset-0 bg-[#141414]/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 border border-[#e5e5e5] max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <MessageSquare className="w-6 h-6" /> Inkorg
                </h3>
                <button 
                  onClick={() => setShowInbox(false)}
                  className="p-2 hover:bg-[#f5f5f5] rounded-full transition-colors"
                >
                  <Square className="w-6 h-6 rotate-45 border-2 border-[#141414] rounded-lg" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-16 h-16 text-[#d1d1d1] mx-auto mb-4 opacity-30" />
                    <p className="text-[#9e9e9e] font-serif italic text-lg">Inga meddelanden ännu.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`p-6 rounded-3xl border-2 transition-all ${msg.read ? 'bg-white border-[#f5f5f5]' : 'bg-[#fff] border-[#141414] shadow-md'}`}
                    >
                      <p className="text-sm font-bold text-[#141414] mb-3 leading-relaxed">{msg.content}</p>
                      <div className="flex items-center justify-between pt-3 border-t border-[#f5f5f5]">
                        <span className="text-[10px] text-[#9e9e9e] font-bold uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {msg.timestamp ? msg.timestamp.toDate().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '...'}
                        </span>
                        {!msg.read && (
                          <button 
                            onClick={() => dbService.markMessageRead(msg.id)}
                            className="text-[10px] text-blue-600 font-black uppercase tracking-tighter hover:underline"
                          >
                            Läst
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
