import React, { useEffect, useState } from 'react';
import { Globe, Moon } from 'lucide-react';
import LoginForm from '../../../../components/forms/LoginForm';
import { useFocusTrap } from '../../../../utils/focusTrap';
import enMessages from '../../../../../messages/en.json';
import amMessages from '../../../../../messages/am.json';

export const PREFERRED_LOCALE_STORAGE_KEY = 'esms_preferred_locale_v1';

export interface SmartLearnLoginPageProps {
  locale?: 'en' | 'am';
  onToggleLocale?: (nextLocale: 'en' | 'am') => void;
  onAuthenticateIdentifier?: (identifier: string, password: string) => Promise<void>;
}

export default function LoginPage({
  locale: propLocale,
  onToggleLocale,
  onAuthenticateIdentifier,
}: SmartLearnLoginPageProps) {
  const [locale, setLocale] = useState<'en' | 'am'>(() => {
    if (propLocale === 'en' || propLocale === 'am') {
      return propLocale;
    }
    try {
      const saved = localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'am') {
        return saved;
      }
    } catch {
      // ignore storage access issues
    }
    return 'en';
  });

  useEffect(() => {
    if (propLocale && (propLocale === 'en' || propLocale === 'am') && propLocale !== locale) {
      setLocale(propLocale);
    }
  }, [propLocale]);

  const handleLanguageToggle = () => {
    const nextLocale: 'en' | 'am' = locale === 'en' ? 'am' : 'en';
    setLocale(nextLocale);
    try {
      localStorage.setItem(PREFERRED_LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // ignore storage errors
    }
    if (onToggleLocale) {
      onToggleLocale(nextLocale);
    }
  };

  const messages = locale === 'am' ? amMessages : enMessages;
  const tAuth = messages.Auth;
  const tFooter = messages.Footer;

  const frostedCardRef = useFocusTrap<HTMLDivElement>({
    enabled: true,
    initialFocusSelector: '#login-identifier',
  });

  return (
    <div className="sl-frosted-bg min-h-screen w-full flex flex-col justify-between items-center px-5 py-8 text-[#0B1F3A] select-none sm:select-auto">
      {/* Decorative Soft Frosted Corner Circles (aria-hidden, pointer-events-none) */}
      <div
        aria-hidden="true"
        className="sl-soft-circle w-72 h-72 -top-20 -left-20"
      />
      <div
        aria-hidden="true"
        className="sl-soft-circle w-80 h-80 -bottom-24 -right-20"
      />
      <div
        aria-hidden="true"
        className="sl-soft-circle w-56 h-56 top-1/3 -right-24 opacity-70"
      />

      {/* Top-Right Header Row: Clickable Language Toggle (EN / አማ) + Theme Toggle */}
      <header className="relative z-10 w-full max-w-[400px] flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleLanguageToggle}
          data-testid="login-language-toggle"
          aria-label={tAuth.languageToggleLabel}
          title={tAuth.languageToggleLabel}
          className="h-11 px-3.5 rounded-2xl bg-white/85 hover:bg-white border border-white/95 shadow-sm flex items-center gap-2 text-xs font-bold text-[#0B1F3A] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8] focus-visible:ring-offset-2"
        >
          <Globe className="w-4 h-4 text-[#1E4FD8] shrink-0" />
          <span className={locale === 'en' ? 'text-[#1E4FD8] font-extrabold' : 'text-[#5B6B86]'}>
            EN
          </span>
          <span aria-hidden="true" className="text-[#B8C4DA]">
            /
          </span>
          <span className={locale === 'am' ? 'text-[#1E4FD8] font-extrabold' : 'text-[#5B6B86]'}>
            አማ
          </span>
        </button>

        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label={tAuth.themeToggleLabel}
          title={tAuth.themeToggleLabel}
          className="w-11 h-11 rounded-2xl bg-white/75 border border-white/90 shadow-sm flex items-center justify-center text-[#0B1F3A] opacity-75 cursor-not-allowed"
        >
          <Moon className="w-5 h-5" />
        </button>
      </header>

      {/* Centred Frosted Login Card with Strict Keyboard Focus-Trap (max-w-[400px]) */}
      <div
        ref={frostedCardRef}
        role="region"
        aria-labelledby="smartlearn-login-heading"
        tabIndex={-1}
        data-testid="frosted-login-card"
        className="relative z-10 w-full max-w-[400px] flex flex-col items-center my-auto py-7 px-5 rounded-[32px] bg-white/45 border border-white/80 shadow-[0_20px_50px_rgba(15,35,75,0.08)] backdrop-blur-md space-y-6 outline-none"
      >
        {/* 150x150 Raised Frosted Logo Block */}
        <div className="sl-logo-tile flex items-center justify-center">
          <img
            src="/images/logo.svg"
            alt={tAuth.logoAlt}
            width={92}
            height={92}
            referrerPolicy="no-referrer"
            className="w-[92px] h-[92px] object-contain"
          />
        </div>

        {/* Headline & Subtitle */}
        <div className="text-center space-y-2 px-2">
          <h1
            id="smartlearn-login-heading"
            className="text-[32px] leading-tight font-extrabold tracking-tight text-[#0B1F3A]"
          >
            {tAuth.welcomeBack}
          </h1>
          <p className="text-[15px] text-[#5B6B86] tracking-[0.02em]">
            {tAuth.subtitle}
          </p>
        </div>

        {/* Pill-Shaped Frosted Login Form (Email + Password + Remember Me + Forgot Password) */}
        <LoginForm
          locale={locale}
          onAuthenticateIdentifier={onAuthenticateIdentifier}
        />
      </div>

      {/* Footer Tagline */}
      <footer className="relative z-10 w-full max-w-[400px] pt-4 flex flex-col items-center gap-1.5 text-center">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#5B6B86]">
          {tFooter.tagline}
        </p>
        <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#5B6B86]/80">
          {tFooter.cornerNote}
        </span>
      </footer>
    </div>
  );
}
