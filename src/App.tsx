import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeePortal } from './components/EmployeePortal';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { authService } from './services/authService';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const checkUsers = async () => {
      try {
        const statusDoc = await getDoc(doc(db, 'system', 'status'));
        if (statusDoc.exists() && statusDoc.data()?.initialized) {
          setHasUsers(true);
        } else {
          setHasUsers(false);
        }
      } catch (err: any) {
        console.error("Initialization check failed:", err);
        
        // If it's a transient network error, retry a few times
        if (err.code === 'unavailable' && retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying initialization check (${retryCount}/${maxRetries})...`);
          setTimeout(checkUsers, 2000);
          return;
        }

        // If it's a permission error, we might be trying to read system/status before rules propagated
        // or something is wrong with the project setup.
        // We assume it's not initialized if we can't read it (most conservative approach)
        setHasUsers(false);
      }
    };
    checkUsers();
  }, []);

  const handleCreateInitialAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSettingUp(true);
    try {
      if (adminPin.length !== 4) throw new Error("PIN måste vara exakt 4 siffror");
      await authService.createUser(adminName, adminPin, 'admin');
      setHasUsers(true);
    } catch (err: any) {
      console.error("Activation error:", err);
      if (err.message.includes('auth/operation-not-allowed')) {
        alert("Systemfel: 'E-post/lösenord' autentisering är inte aktiverad i din Firebase-konsol.");
      } else {
        alert("Ett fel uppstod vid aktivering: " + err.message);
      }
    } finally {
      setIsSettingUp(false);
    }
  };

  if (loading || hasUsers === null) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#141414]" />
      </div>
    );
  }

  // If no users exist, show the initial admin creation screen
  if (!hasUsers) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-[#141414] rounded-[40px] shadow-2xl p-10 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-50" />
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
              <ShieldCheck className="w-10 h-10 text-[#141414]" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight font-serif italic">Välkommen</h1>
            <p className="text-white/40 text-sm text-center mt-3 px-4 italic font-serif leading-relaxed">
              Skapa det första administratörskontot för att aktivera TeamTime Pro terminalen.
            </p>
          </div>

          <form onSubmit={handleCreateInitialAdmin} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold uppercase text-white/40 pl-1 tracking-[0.2em]">Fullständigt Namn</label>
              <input 
                required 
                placeholder="T.ex. Admin" 
                value={adminName} 
                onChange={e => setAdminName(e.target.value)} 
                className="w-full bg-white/5 border border-white/5 focus:border-white/20 rounded-2xl p-4 text-white text-sm font-medium outline-none transition-all" 
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-white/40 pl-1 tracking-[0.2em]">Välj 4-siffrig PIN (använd t.ex. 1212)</label>
              <input 
                required 
                maxLength={4} 
                pattern="\d{4}" 
                placeholder="1212" 
                value={adminPin} 
                onChange={e => setAdminPin(e.target.value)} 
                className="w-full bg-white/5 border border-white/5 focus:border-white/20 rounded-2xl p-4 text-white text-sm font-medium outline-none transition-all tracking-[1em] text-center" 
              />
            </div>
            <button 
              type="submit" 
              disabled={isSettingUp}
              className="w-full py-5 bg-white text-[#141414] rounded-2xl font-bold shadow-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isSettingUp ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-5 h-5" /> Aktivera Systemet</>}
            </button>

            <p className="text-[10px] text-white/20 text-center uppercase tracking-widest font-bold">
              Kräver "Email/Password Auth" aktiverat i Firebase Console
            </p>
          </form>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return user.role === 'admin' ? <AdminDashboard /> : <EmployeePortal />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
