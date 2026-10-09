import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Info,
  X,
  FileText,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export type AppModalType = 'success' | 'warning' | 'error' | 'info' | 'confirm';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: AppModalType;
  title: string;
  message: string;
  secondaryMessage?: string;
  badge?: string;
  fileDetails?: {
    label?: string;
    filename: string;
    path?: string;
    shareUrl?: string;
  };
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  primaryAction?: {
    label: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
  };
}

export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  secondaryMessage,
  badge,
  fileDetails,
  confirmText,
  cancelText,
  onConfirm,
  primaryAction,
  secondaryAction,
}) => {
  if (!isOpen) return null;

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-7 h-7 text-emerald-600" />,
          iconBg: 'bg-emerald-100 border-emerald-200',
          glow: 'bg-emerald-500/10',
          accent: 'text-emerald-700',
          primaryBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20',
          defaultBadge: 'Success',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-7 h-7 text-amber-600" />,
          iconBg: 'bg-amber-100 border-amber-200',
          glow: 'bg-amber-500/10',
          accent: 'text-amber-700',
          primaryBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20',
          defaultBadge: 'Attention',
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-7 h-7 text-rose-600" />,
          iconBg: 'bg-rose-100 border-rose-200',
          glow: 'bg-rose-500/10',
          accent: 'text-rose-700',
          primaryBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
          defaultBadge: 'Error',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'confirm':
        return {
          icon: <HelpCircle className="w-7 h-7 text-blue-600" />,
          iconBg: 'bg-blue-100 border-blue-200',
          glow: 'bg-blue-500/10',
          accent: 'text-blue-700',
          primaryBtn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20',
          defaultBadge: 'Confirmation',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-7 h-7 text-sky-600" />,
          iconBg: 'bg-sky-100 border-sky-200',
          glow: 'bg-sky-500/10',
          accent: 'text-sky-700',
          primaryBtn: 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20',
          defaultBadge: 'Notice',
          badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
        };
    }
  };

  const theme = getTheme();
  const effectiveBadge = badge || (type === 'confirm' ? 'Confirm Action' : theme.defaultBadge);

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handlePrimaryClick = () => {
    if (primaryAction?.onClick) {
      primaryAction.onClick();
    } else {
      onClose();
    }
  };

  const handleSecondaryClick = () => {
    if (secondaryAction?.onClick) {
      secondaryAction.onClick();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md flex justify-center items-center min-h-screen animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && type !== 'confirm') {
          onClose();
        }
      }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg my-auto overflow-hidden animate-in zoom-in-95 duration-200 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Decorative Ambient Banner */}
        <div className={`h-2 w-full ${type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : type === 'error' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`} />

        {/* Close Icon Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header Row: Icon + Badge + Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${theme.iconBg}`}>
              {theme.icon}
            </div>

            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${theme.badgeBg}`}>
                  {effectiveBadge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {title}
              </h3>
            </div>
          </div>

          {/* Message Content */}
          <div className="text-sm text-slate-600 leading-relaxed space-y-2 pl-0 sm:pl-16">
            <p className="whitespace-pre-line font-medium text-slate-700">{message}</p>
            {secondaryMessage && (
              <p className="text-xs text-slate-500 whitespace-pre-line bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                {secondaryMessage}
              </p>
            )}

            {/* File Details Box (Dropbox, PDF, etc.) */}
            {fileDetails && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 shadow-inner flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 text-amber-400 flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {fileDetails.label || 'Dropbox Document'}
                  </div>
                  <div className="text-xs font-mono font-semibold text-white truncate mt-0.5" title={fileDetails.filename}>
                    {fileDetails.filename}
                  </div>
                  {fileDetails.path && (
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      Path: {fileDetails.path}
                    </div>
                  )}
                  {fileDetails.shareUrl && (
                    <a
                      href={fileDetails.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:underline mt-1.5"
                    >
                      <span>Open Document in Dropbox</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            {type === 'confirm' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                >
                  {cancelText || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClick}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 ${theme.primaryBtn}`}
                >
                  <span>{confirmText || 'Yes, Proceed'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {secondaryAction && (
                  <button
                    type="button"
                    onClick={handleSecondaryClick}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                  >
                    {secondaryAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrimaryClick}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 ${theme.primaryBtn}`}
                >
                  <span>{primaryAction?.label || confirmText || 'OK, Understood'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
