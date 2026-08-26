import { useState, useEffect, FormEvent } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeePortal } from './components/EmployeePortal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { authService } from './services/authService';

function AppContent() {
  const { user, loading } = useAuth();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // kolla om systemet redan är aktiverat
    async function check() {
      try {
        const snap = await getDoc(doc(db, 'system', 'status'));
        if (snap.exists() && snap.data().initialized) {
          setHasUsers(true);
        } else {
          setHasUsers(false);
        }
      } catch (e) {
        console.log('kunde inte läsa status, visar setup', e);
        setHasUsers(false);
      }
    }
    check();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('PIN måste vara 4 siffror');
      return;
    }

    setCreating(true);
    try {
      await authService.createUser(name, pin, 'admin');
      setHasUsers(true);
    } catch (err: any) {
      console.log('fel vid skapande av admin', err);
      if (err.message?.includes('operation-not-allowed')) {
        setError('Du måste aktivera Email/Password i Firebase Console');
      } else {
        setError(err.message || 'Kunde inte skapa användare');
      }
    }
    setCreating(false);
  };

  if (loading || hasUsers === null) {
    return <div className="loading-screen">Laddar...</div>;
  }

  // Första start - skapa admin
  if (!hasUsers) {
    return (
      <div className="setup-wrapper">
        <div className="setup-card">
          <h1>Välkommen till TeamTime</h1>
          <p className="muted">Skapa första admin-kontot för att komma igång.</p>

          <form onSubmit={handleCreate}>
            <label>Namn</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="T.ex. Emmad"
              required 
            />

            <label>PIN-kod (4 siffror)</label>
            <input 
              value={pin} 
              onChange={e => setPin(e.target.value)}
              placeholder="1212"
              maxLength={4}
              required
            />

            {error && <p className="error-text">{error}</p>}

            <button type="submit" disabled={creating}>
              {creating ? 'Skapar...' : 'Aktivera systemet'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return user.role === 'admin' ? <AdminDashboard /> : <EmployeePortal />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}


