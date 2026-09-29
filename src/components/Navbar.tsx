import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClipboardCheck, Hotel, LogOut, ShieldCheck, UserCheck, RotateCcw } from 'lucide-react';

interface NavbarProps {
  onResetForm?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onResetForm }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = () => {
    if (!user) return null;
    switch (user.role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-3 h-3" /> Supervisor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <ClipboardCheck className="w-3 h-3" /> Inspector
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 shadow-md">
              <Hotel className="w-5 h-5" />
            </div>
            <div>
              <div className="font-brand font-bold text-lg text-slate-900 tracking-wider">
                MAXWELL
              </div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Room Preventive Maintenance
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                window.location.pathname.includes('/dashboard')
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/form')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                window.location.pathname.includes('/form')
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Inspection Form</span>
            </button>
          </div>

          {/* User & Actions */}
          <div className="flex items-center gap-3">
            {onResetForm && (
              <button
                type="button"
                onClick={onResetForm}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                title="Start a new blank inspection form"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>New Form</span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="mt-0.5">{getRoleBadge()}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
