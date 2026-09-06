import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquarePlus, 
  Send, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import type { UserProfile, FeedbackCategory, FeedbackDiagnostics } from '../types';
import { submitFeedback } from '../lib/firebase';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSignIn?: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, user, onSignIn }) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [allowContact, setAllowContact] = useState(true);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [showDiagnosticsPreview, setShowDiagnosticsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prepare safe diagnostic payload (strictly zero user content, tokens, or exact locations)
  const getDiagnosticData = (): FeedbackDiagnostics => {
    return {
      appVersion: 'v1.4.0',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Web',
      screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'en',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    };
  };

  // Dynamic placeholder based on selected category
  const getCategoryPlaceholder = (cat: FeedbackCategory): string => {
    switch (cat) {
      case 'general':
        return 'What would you like us to know?';
      case 'feature':
        return 'What would you like Manasyn to help you do?';
      case 'bug':
        return 'What happened, and what did you expect instead?';
      case 'praise':
        return 'What worked especially well for you?';
      default:
        return 'What would you like us to know?';
    }
  };

  // Handle draft protection on request to close
  const handleRequestClose = () => {
    if (isSubmitting) return;

    if (message.trim().length > 0 && !isSuccess) {
      setIsDiscardConfirmOpen(true);
      return;
    }

    resetAndClose();
  };

  const resetAndClose = () => {
    setMessage('');
    setCategory('general');
    setAllowContact(true);
    setIncludeDiagnostics(false);
    setShowDiagnosticsPreview(false);
    setIsSuccess(false);
    setErrorMessage(null);
    setIsDiscardConfirmOpen(false);
    onClose();
  };

  const handleKeepWriting = () => {
    setIsDiscardConfirmOpen(false);
    textareaRef.current?.focus();
  };

  const handleDiscard = () => {
    resetAndClose();
  };

  const handleSendMore = () => {
    setMessage('');
    setCategory('general');
    setIsSuccess(false);
    setErrorMessage(null);
    setIsDiscardConfirmOpen(false);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation & Focus Trapping
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto focus textarea when opened
    const timer = setTimeout(() => {
      if (!isSuccess && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isDiscardConfirmOpen) {
          setIsDiscardConfirmOpen(false);
        } else {
          handleRequestClose();
        }
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableSelectors = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSuccess, isDiscardConfirmOpen, message]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    if (!user) {
      if (onSignIn) {
        onSignIn();
      } else {
        setErrorMessage('Please sign in to send feedback directly to the team.');
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const diagnosticsPayload = includeDiagnostics ? getDiagnosticData() : null;

      await submitFeedback(
        user.uid,
        allowContact && user.email ? user.email : null,
        allowContact && user.displayName ? user.displayName : null,
        message,
        category,
        allowContact,
        diagnosticsPayload
      );

      setIsSuccess(true);
    } catch (err: unknown) {
      console.error('Failed to submit feedback:', err);
      setErrorMessage('Your feedback wasn’t sent. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories: { id: FeedbackCategory; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'feature', label: 'Idea / Feature' },
    { id: 'bug', label: 'Issue / Bug' },
    { id: 'praise', label: 'Praise' },
  ];

  const handleCategoryKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % categories.length;
      setCategory(categories[nextIndex].id);
      const nextBtn = document.getElementById(`feedback-category-${categories[nextIndex].id}`);
      nextBtn?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + categories.length) % categories.length;
      setCategory(categories[prevIndex].id);
      const prevBtn = document.getElementById(`feedback-category-${categories[prevIndex].id}`);
      prevBtn?.focus();
    }
  };

  return (
    <div
      id="feedback-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleRequestClose}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        id="feedback-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-feedback-title"
        aria-describedby="share-feedback-desc"
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col font-sans relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="share-feedback-title" className="text-base font-bold text-slate-900 dark:text-white font-display">
                Share Feedback
              </h2>
              <p id="share-feedback-desc" className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                Tell us what's working and what we could improve.
              </p>
            </div>
          </div>
          <button
            id="close-feedback-modal-btn"
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Discard Confirmation Overlay */}
        {isDiscardConfirmOpen && (
          <div 
            id="feedback-discard-warning"
            className="absolute inset-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-150"
          >
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
              Discard this feedback?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs font-sans leading-relaxed">
              Your message hasn't been sent. If you leave now, your written feedback will be lost.
            </p>
            <div className="flex items-center gap-3 mt-5 w-full max-w-xs">
              <button
                id="feedback-keep-writing-btn"
                type="button"
                onClick={handleKeepWriting}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Keep writing
              </button>
              <button
                id="feedback-confirm-discard-btn"
                type="button"
                onClick={handleDiscard}
                className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {isSuccess ? (
            /* Success State */
            <div id="feedback-success-view" className="py-6 text-center flex flex-col items-center space-y-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                  Thank you for your feedback.
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                  Your message has been sent. Your thoughts help shape future updates to Manasyn.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 w-full max-w-xs">
                <button
                  id="feedback-done-btn"
                  type="button"
                  onClick={resetAndClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Done
                </button>
                <button
                  id="feedback-send-more-btn"
                  type="button"
                  onClick={handleSendMore}
                  className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Send more feedback</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Form State */
            <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Failure Error Banner with Try Again */}
              {errorMessage && (
                <div 
                  id="feedback-error-banner"
                  className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <span className="font-sans leading-relaxed">{errorMessage}</span>
                  </div>
                  <button
                    id="feedback-try-again-btn"
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={isSubmitting}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Feedback Type
                </label>
                <div 
                  role="radiogroup" 
                  aria-label="Feedback category" 
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  {categories.map((cat, idx) => (
                    <button
                      key={cat.id}
                      id={`feedback-category-${cat.id}`}
                      type="button"
                      role="radio"
                      aria-checked={category === cat.id}
                      tabIndex={category === cat.id ? 0 : -1}
                      onClick={() => setCategory(cat.id)}
                      onKeyDown={(e) => handleCategoryKeyDown(e, idx)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border text-center transition-all ${
                        category === cat.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input Area */}
              <div>
                <label 
                  htmlFor="feedback-textarea" 
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Your feedback <span className="text-rose-500 font-bold" aria-hidden="true">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  id="feedback-textarea"
                  name="feedback"
                  rows={4}
                  required
                  aria-required="true"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={getCategoryPlaceholder(category)}
                  disabled={isSubmitting}
                  className="w-full text-xs sm:text-sm rounded-xl p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
                />
              </div>

              {/* Privacy Controls & Checkboxes */}
              <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                {/* Optional Contact Permission */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    id="feedback-allow-contact-checkbox"
                    checked={allowContact}
                    onChange={(e) => setAllowContact(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                      Allow the team to contact me about this feedback
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {allowContact ? (
                        user?.email ? (
                          <span>Submitting as: <strong className="font-semibold text-slate-700 dark:text-slate-300">{user.email}</strong></span>
                        ) : (
                          <span>Submitting securely via Google verification</span>
                        )
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Submitting anonymously (no email attached)</span>
                      )}
                    </p>
                  </div>
                </label>

                {/* Optional Diagnostic Information */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        id="feedback-include-diagnostics-checkbox"
                        checked={includeDiagnostics}
                        onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                        disabled={isSubmitting}
                        className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                        Include device and app diagnostic information
                      </span>
                    </label>

                    <button
                      type="button"
                      id="toggle-diagnostic-preview-btn"
                      onClick={() => setShowDiagnosticsPreview((prev) => !prev)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 shrink-0 font-medium"
                    >
                      <span>View information before sending</span>
                      {showDiagnosticsPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Diagnostic Preview Panel */}
                  {showDiagnosticsPreview && (
                    <div 
                      id="diagnostic-preview-panel"
                      className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1.5 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-sans font-bold text-xs">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>Privacy-Safe Diagnostic Summary</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[10px]">
                        <div><strong className="text-slate-700 dark:text-slate-300">App Version:</strong> v1.4.0</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Platform:</strong> {typeof navigator !== 'undefined' ? navigator.platform || 'Web' : 'Web'}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Language:</strong> {typeof navigator !== 'undefined' ? navigator.language : 'en'}</div>
                        <div><strong className="text-slate-700 dark:text-slate-300">Timezone:</strong> {typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'}</div>
                      </div>
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] font-sans text-slate-500 dark:text-slate-400 italic">
                        Diagnostics never include reflection text, authentication tokens, or exact location coordinates.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Privacy Notice Disclaimer */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Your feedback and account email will be sent to the Manasyn team. Reflection content is not included unless you paste it here.
                </span>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  id="cancel-feedback-btn"
                  type="button"
                  onClick={handleRequestClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-feedback-btn"
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Feedback</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
