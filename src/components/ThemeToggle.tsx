import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'motion/react';

interface ThemeToggleProps {
  className?: string;
  variant?: 'pill' | 'icon' | 'compact';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', variant = 'pill' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
        title={isDark ? 'Ljust läge' : 'Mörkt läge'}
        className={`p-2.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
          isDark
            ? 'bg-[#1e1e24] text-amber-300 hover:bg-[#282830] border border-white/10'
            : 'bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200 shadow-sm'
        } ${className}`}
      >
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
      title={isDark ? 'Ljust läge' : 'Mörkt läge'}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
        isDark
          ? 'bg-[#1a1a20] hover:bg-[#24242c] text-zinc-200 border-white/10'
          : 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200 shadow-sm'
      } ${className}`}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {isDark ? (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-zinc-600" />
        )}
      </motion.div>
      <span className="hidden sm:inline text-[11px] uppercase tracking-wider">
        {isDark ? 'Mörkt läge' : 'Ljust läge'}
      </span>
    </button>
  );
};
