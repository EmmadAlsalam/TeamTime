import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Delete, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Login: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleKeyPress = (val: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) return;
    
    setLoading(true);
    setError('');
    try {
      await login(pin);
    } catch (err: any) {
      setError(err.message);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#141414] rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] p-10 border border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50" />
        
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
            <Lock className="text-[#141414] w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-serif italic">TeamTime Pro</h1>
          <p className="text-white/40 text-xs mt-2 uppercase tracking-[0.2em] font-bold">Secure Access Terminal</p>
        </div>

        <div className="flex justify-center gap-5 mb-12">
          {[0, 1, 2, 3].map((idx) => (
            <motion.div 
              key={idx}
              animate={pin.length > idx ? { scale: [1, 1.2, 1], backgroundColor: '#fff' } : {}}
              className={`w-3 h-3 rounded-full border transition-colors duration-300 ${
                pin.length > idx ? 'bg-white border-white' : 'border-white/20'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="h-20 rounded-[24px] bg-white/5 text-white text-2xl font-medium hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center border border-white/5"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="h-20 rounded-[24px] bg-white/5 text-white text-2xl font-medium hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center border border-white/5"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-20 rounded-[24px] text-white/40 hover:text-white transition-colors flex items-center justify-center"
          >
            <Delete className="w-8 h-8" />
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6"
            >
              <p className="text-red-400 text-[11px] text-center font-medium leading-relaxed">
                {error}
                {error.includes('operation-not-allowed') && (
                  <span className="block mt-1 opacity-80 text-[10px]">
                    Tips: Aktivera "Email/Password" i Firebase Console under Authentication.
                  </span>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleSubmit}
          disabled={pin.length < 4 || loading}
          className={`w-full py-5 rounded-[24px] flex items-center justify-center gap-3 font-bold text-lg transition-all ${
            pin.length === 4 && !loading
              ? 'bg-white text-[#141414] hover:bg-white/90 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.3)]'
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
          }`}
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              Identifiera <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};
