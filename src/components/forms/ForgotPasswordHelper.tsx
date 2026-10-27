import React, { useEffect, useState } from 'react';
import { ShieldAlert, X, Mail, KeyRound, CheckCircle2, Send } from 'lucide-react';
import { useFocusTrap } from '../../utils/focusTrap';
import enMessages from '../../../messages/en.json';
import amMessages from '../../../messages/am.json';

export interface ForgotPasswordHelperProps {
  locale?: 'en' | 'am';
  defaultEmail?: string;
}

export const ForgotPasswordHelper: React.FC<ForgotPasswordHelperProps> = ({
  locale = 'en',
  defaultEmail = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const messages = locale === 'am' ? amMessages : enMessages;
  const tAuth = messages.Auth;
  const tErrors = messages.Errors;

  useEffect(() => {
    if (defaultEmail && !recoveryEmail) {
      setRecoveryEmail(defaultEmail);
    }
  }, [defaultEmail]);

  const modalCardRef = useFocusTrap<HTMLDivElement>({
    enabled: isOpen,
    initialFocusSelector: '#recovery-email-input',
    restoreFocusOnDeactivate: true,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpenModal = () => {
    if (defaultEmail && !recoveryEmail) {
      setRecoveryEmail(defaultEmail);
    }
    setErrorMsg(null);
    setIsOpen(true);
  };

  const handleSubmitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cleanEmail = recoveryEmail.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!cleanEmail || !isEmail) {
      setErrorMsg(tErrors.invalidEmail);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await fetch('/api/v1/auth/password-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      setSubmittedEmail(cleanEmail);
    } catch {
      // Even if offline, confirm request instructions for the system admin
      setSubmittedEmail(cleanEmail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        data-testid="forgot-password-link"
        title={tAuth.forgotPasswordTooltip}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="min-h-[44px] px-1 text-sm font-semibold text-[#1E4FD8] hover:text-[#163BB0] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8] focus-visible:ring-offset-2 rounded-lg transition-colors"
      >
        {tAuth.forgotPassword}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 rounded-[32px] bg-[#0B1F3A]/45 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            ref={modalCardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-modal-title"
            aria-describedby="forgot-password-modal-desc"
            tabIndex={-1}
            data-testid="forgot-password-modal"
            className="relative w-full max-w-[380px] rounded-[26px] bg-white border border-white shadow-[0_24px_60px_rgba(11,31,58,0.28)] p-5 text-[#0B1F3A] space-y-3.5 outline-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EEF3FB] border border-[#1E4FD8]/20 flex items-center justify-center text-[#1E4FD8] shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="forgot-password-modal-title"
                    className="text-base font-extrabold tracking-tight text-[#0B1F3A]"
                  >
                    {tAuth.forgotPasswordModalTitle}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={tAuth.forgotPasswordClose}
                className="w-9 h-9 rounded-xl text-[#5B6B86] hover:text-[#0B1F3A] hover:bg-[#EEF3FB] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Intro */}
            <p
              id="forgot-password-modal-desc"
              className="text-xs leading-relaxed text-[#5B6B86]"
            >
              {tAuth.forgotPasswordModalIntro}
            </p>

            {/* Registered Email Recovery Request Form */}
            <div className="space-y-2.5 pt-1">
              <label
                htmlFor="recovery-email-input"
                className="block text-xs font-bold text-[#0B1F3A]"
              >
                {tAuth.forgotPasswordEmailLabel}
              </label>
              <div className="flex flex-col gap-2">
                <input
                  id="recovery-email-input"
                  data-testid="recovery-email-input"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => {
                    setRecoveryEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={tAuth.forgotPasswordEmailPlaceholder}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#F8FAFF] border border-[#B8C4DA] text-xs font-medium text-[#0B1F3A] placeholder:text-[#5B6B86] focus:outline-none focus:ring-2 focus:ring-[#1E4FD8]"
                />
                {errorMsg && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {errorMsg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSubmitRecovery}
                  disabled={submitting}
                  data-testid="submit-password-recovery-btn"
                  className="w-full h-10 rounded-xl bg-[#1E4FD8] hover:bg-[#163BB0] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? tAuth.forgotPasswordSubmitting
                      : tAuth.forgotPasswordSubmitButton}
                  </span>
                </button>
              </div>

              {submittedEmail && (
                <div
                  role="status"
                  data-testid="recovery-request-success"
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold font-mono">{submittedEmail}</div>
                    <p className="leading-relaxed">{tAuth.forgotPasswordSuccessMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Step-by-step Instructions */}
            <div className="rounded-2xl bg-[#EEF3FB]/90 border border-[#B8C4DA]/50 p-3.5 space-y-1.5 text-xs text-[#0B1F3A]">
              <p className="font-medium leading-relaxed">{tAuth.forgotPasswordStep1}</p>
              <p className="font-medium leading-relaxed">{tAuth.forgotPasswordStep2}</p>
              <p className="font-medium leading-relaxed">{tAuth.forgotPasswordStep3}</p>
            </div>

            {/* Administrator Contact Card */}
            <div className="rounded-2xl bg-[#F8FAFF] border border-[#B8C4DA]/60 px-3.5 py-2.5 flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2 text-[#5B6B86]">
                <Mail className="w-3.5 h-3.5 text-[#1E4FD8] shrink-0" />
                <span className="font-semibold text-[#0B1F3A]">
                  {tAuth.forgotPasswordAdminContactLabel}
                </span>
              </div>
              <span className="font-mono font-bold text-[#1E4FD8] pl-5 break-all">
                habteofat@gmail.com
              </span>
            </div>

            {/* Role Prefixes Reminder */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#5B6B86]">
              <KeyRound className="w-3.5 h-3.5 text-[#1E4FD8] shrink-0" />
              <span>Role-Based Access Codes (STU • TEA • FIN • LIN)</span>
            </div>

            {/* Close Action Button */}
            <button
              id="forgot-password-close-btn"
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#EEF3FB] hover:bg-[#E1EAF8] text-[#0B1F3A] flex items-center justify-center px-5 font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8] focus-visible:ring-offset-2 transition-colors"
            >
              {tAuth.forgotPasswordClose}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ForgotPasswordHelper;
