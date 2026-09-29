import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEFAULT_USERS } from '../context/AuthContext';
import { Hotel, KeyRound, Mail, ArrowRight, ShieldCheck, UserCheck, ClipboardCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your staff email.');
      return;
    }

    // Match demo user or create session user
    const matched = DEFAULT_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    const userToLogin = matched || {
      id: Date.now(),
      email: email.trim(),
      full_name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' (Inspector)',
      role: 'inspector' as const,
      is_active: true,
    };

    login(`token_${Date.now()}`, userToLogin);
    navigate('/dashboard');
  };

  const handleQuickLogin = (demoEmail: string) => {
    const matched = DEFAULT_USERS.find((u) => u.email === demoEmail);
    if (matched) {
      login(`token_${Date.now()}`, matched);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 shadow-2xl shadow-black/60">
            <Hotel className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-3xl font-bold font-brand tracking-wider text-white">
          THE MAXWELL
        </h2>
        <p className="mt-1 text-center text-xs font-semibold tracking-widest uppercase text-amber-400/90">
          Room Preventive Maintenance Inspection System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl border border-slate-800 rounded-3xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Staff Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@maxwell.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer font-medium"
            >
              <span>Sign In & Open Form</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="text-xs text-center text-slate-400 mb-3 font-medium">
              Demo Test Accounts (One-Click)
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('inspector@maxwell.com')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between border border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-blue-400" />
                  <span>John Tan</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                  Inspector
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('supervisor@maxwell.com')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between border border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sarah Lee</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                  Supervisor
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@maxwell.com')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between border border-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Maxwell Admin</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                  Admin
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
