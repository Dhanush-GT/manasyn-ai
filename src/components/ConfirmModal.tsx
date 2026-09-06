import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div id="confirm-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div 
        id="confirm-modal-card" 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 font-mono"
      >
        <button
          id="confirm-modal-close-btn"
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl shrink-0 ${isDestructive ? 'bg-rose-950/80 text-rose-400 border border-rose-800/80' : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="confirm-modal-title" className="text-base font-bold text-white font-display">
              {title}
            </h3>
            <p id="confirm-modal-message" className="mt-2 text-xs text-slate-400 font-sans leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 font-mono">
          <button
            id="confirm-modal-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            id="confirm-modal-action-btn"
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-md ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-cyan-950/40'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
