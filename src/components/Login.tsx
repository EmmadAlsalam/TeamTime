import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Delete, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export const Login: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const executeLogin = useCallback(async (inputPin: string) => {
    if (inputPin.length !== 4 || loading) return;
    
    setLoading(true);
    setError('');
    try {
      await login(inputPin);
    } catch (err: any) {
      setError(err.message || 'Felaktig pinkod');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [loading, login]);

  const handleKeyPress = useCallback((val: string) => {
    if (loading) return;
    setError('');
    setPin(prev => {
      if (prev.length < 4) {
        const nextPin = prev + val;
        if (nextPin.length === 4) {
          executeLogin(nextPin);
        }
        return nextPin;
      }
      return prev;
    });
  }, [loading, executeLogin]);

  const handleDelete = useCallback(() => {
    if (loading) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, [loading]);

  // Physical keyboard support for rapid entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleDelete]);

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-sans relative transition-colors duration-200 ${
      isDark ? 'bg-[#0a0a0c]' : 'bg-[#f4f4f6]'
    }`}>
      {/* Top Header Controls */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-md rounded-[40px] p-8 sm:p-10 relative overflow-hidden transition-all duration-200 border ${
          isDark
            ? 'bg-[#141418] text-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border-white/5'
            : 'bg-white text-zinc-900 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.08)] border-zinc-200/80'
        }`}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 opacity-80" />
        
        <div className="flex flex-col items-center mb-8">
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center mb-5 shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500 ${
            isDark ? 'bg-white text-[#141418]' : 'bg-zinc-900 text-white'
          }`}>
            <Lock className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight font-serif italic ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            TeamTime Pro
          </h1>
          <p className={`text-xs mt-2 uppercase tracking-[0.2em] font-bold ${
            isDark ? 'text-white/40' : 'text-zinc-400'
          }`}>
            Ange 4-siffrig PIN för inloggning
          </p>
        </div>

        {/* PIN Indicators with Loading State */}
        <div className="flex justify-center items-center gap-4 mb-8 h-8">
          {loading ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifierar kod...</span>
            </div>
          ) : (
            [0, 1, 2, 3].map((idx) => (
              <motion.div 
                key={idx}
                animate={pin.length > idx ? { scale: [1, 1.25, 1] } : {}}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  pin.length > idx 
                    ? isDark 
                      ? 'bg-white border-white scale-110' 
                      : 'bg-zinc-900 border-zinc-900 scale-110'
                    : isDark 
                      ? 'border-white/20 bg-transparent' 
                      : 'border-zinc-300 bg-transparent'
                }`}
              />
            ))
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 sm:gap-5 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              disabled={loading}
              onClick={() => handleKeyPress(num.toString())}
              className={`h-16 sm:h-20 rounded-[22px] text-2xl font-medium active:scale-95 transition-all flex items-center justify-center border ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-white border-white/5 disabled:opacity-50'
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200/60 disabled:opacity-50'
              }`}
            >
              {num}
            </button>
          ))}
          <div />
          <button
            disabled={loading}
            onClick={() => handleKeyPress('0')}
            className={`h-16 sm:h-20 rounded-[22px] text-2xl font-medium active:scale-95 transition-all flex items-center justify-center border ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-white border-white/5 disabled:opacity-50'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200/60 disabled:opacity-50'
            }`}
          >
            0
          </button>
          <button
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            aria-label="Radera siffra"
            className={`h-16 sm:h-20 rounded-[22px] transition-colors flex items-center justify-center ${
              isDark
                ? 'text-white/40 hover:text-white disabled:opacity-20'
                : 'text-zinc-400 hover:text-zinc-900 disabled:opacity-20'
            }`}
          >
            <Delete className="w-7 h-7" />
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 mb-5"
            >
              <p className="text-red-500 text-xs text-center font-medium leading-relaxed">
                {error}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto login status */}
        <div className="text-center">
          <p className={`text-[11px] font-medium tracking-wide ${
            isDark ? 'text-white/40' : 'text-zinc-400'
          }`}>
            Inloggning sker automatiskt när 4 siffror angivits
          </p>
        </div>
      </motion.div>
    </div>
  );
};


