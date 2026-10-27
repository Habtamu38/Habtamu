import React, { useEffect, useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import ForgotPasswordHelper from './ForgotPasswordHelper';
import enMessages from '../../../messages/en.json';
import amMessages from '../../../messages/am.json';

export const REMEMBERED_IDENTIFIER_STORAGE_KEY = 'esms_remembered_identifier_v1';
export const LEGACY_REMEMBERED_IDENTIFIER_KEY = 'rememberedIdentifier';

export interface LoginActionState {
  error?: string;
  fieldErrors?: {
    identifier?: string;
    password?: string;
  };
  success?: boolean;
}

export interface LoginFormProps {
  locale?: 'en' | 'am';
  defaultIdentifier?: string;
  onAuthenticateIdentifier?: (identifier: string, password: string) => Promise<void>;
}

/**
 * Validates whether the input is a well-formed email address
 * (e.g. user@school.edu.et), a valid 6-digit role access code (e.g. STU-482910),
 * or a registered Ethiopian student username (e.g. abebe.kebede or abebe.kebede.1).
 */
export function isValidEmailOrAccessCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const accessCodeRegex = /^(STU|TEA|FIN|LIN|ADM)-\d{6}$/i;
  const studentUsernameRegex = /^[a-zA-Z]{2,}\.[a-zA-Z]{2,}(\.[a-zA-Z0-9]+)?$/;
  return (
    emailRegex.test(trimmed) ||
    accessCodeRegex.test(trimmed) ||
    studentUsernameRegex.test(trimmed)
  );
}

export const LoginForm: React.FC<LoginFormProps> = ({
  locale = 'en',
  defaultIdentifier = '',
  onAuthenticateIdentifier,
}) => {
  const messages = locale === 'am' ? amMessages : enMessages;
  const tAuth = messages.Auth;
  const tErrors = messages.Errors;

  const [identifier, setIdentifier] = useState<string>(() => {
    if (defaultIdentifier) return defaultIdentifier;
    try {
      const saved =
        localStorage.getItem(REMEMBERED_IDENTIFIER_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_REMEMBERED_IDENTIFIER_KEY);
      return saved || '';
    } catch {
      return '';
    }
  });
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem(REMEMBERED_IDENTIFIER_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_REMEMBERED_IDENTIFIER_KEY);
      return saved ? true : true;
    } catch {
      return true;
    }
  });
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<LoginActionState>({});

  // Real-time email / identifier validation state
  const trimmedIdentifier = identifier.trim();
  const hasIdentifierContent = trimmedIdentifier.length > 0;
  const isIdentifierFormatValid = isValidEmailOrAccessCode(trimmedIdentifier);
  const showRealtimeEmailInvalid =
    (hasIdentifierContent && !isIdentifierFormatValid) ||
    Boolean(state.fieldErrors?.identifier);
  const showRealtimeEmailValid =
    hasIdentifierContent && isIdentifierFormatValid && !state.fieldErrors?.identifier;

  useEffect(() => {
    try {
      const cleanId = identifier.trim();
      if (rememberMe && cleanId) {
        localStorage.setItem(REMEMBERED_IDENTIFIER_STORAGE_KEY, cleanId);
        localStorage.setItem(LEGACY_REMEMBERED_IDENTIFIER_KEY, cleanId);
      } else if (!rememberMe) {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_STORAGE_KEY);
        localStorage.removeItem(LEGACY_REMEMBERED_IDENTIFIER_KEY);
      }
    } catch {
      // ignore localStorage quota/access errors
    }
  }, [rememberMe, identifier]);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setIdentifier(nextVal);
    if (!identifierTouched && nextVal.length > 0) {
      setIdentifierTouched(true);
    }
    if (state.fieldErrors?.identifier || state.error) {
      setState((prev) => ({
        ...prev,
        error: undefined,
        fieldErrors: { ...prev.fieldErrors, identifier: undefined },
      }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (state.fieldErrors?.password || state.error) {
      setState((prev) => ({
        ...prev,
        error: undefined,
        fieldErrors: { ...prev.fieldErrors, password: undefined },
      }));
    }
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    try {
      const cleanId = identifier.trim();
      if (checked && cleanId) {
        localStorage.setItem(REMEMBERED_IDENTIFIER_STORAGE_KEY, cleanId);
        localStorage.setItem(LEGACY_REMEMBERED_IDENTIFIER_KEY, cleanId);
      } else if (!checked) {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_STORAGE_KEY);
        localStorage.removeItem(LEGACY_REMEMBERED_IDENTIFIER_KEY);
      }
    } catch {
      // ignore localStorage errors
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIdentifierTouched(true);
    const cleanId = identifier.trim();
    const nextFieldErrors: { identifier?: string; password?: string } = {};

    if (!cleanId || !isValidEmailOrAccessCode(cleanId)) {
      nextFieldErrors.identifier = tErrors.invalidEmail;
    }
    if (!password || password.length < 4) {
      nextFieldErrors.password = tErrors.invalidPassword;
    }

    if (nextFieldErrors.identifier || nextFieldErrors.password) {
      setState({ fieldErrors: nextFieldErrors });
      return;
    }

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_IDENTIFIER_STORAGE_KEY, cleanId);
        localStorage.setItem(LEGACY_REMEMBERED_IDENTIFIER_KEY, cleanId);
      } else {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_STORAGE_KEY);
        localStorage.removeItem(LEGACY_REMEMBERED_IDENTIFIER_KEY);
      }
    } catch {
      // ignore localStorage errors
    }

    setIsPending(true);
    setState({});
    try {
      if (onAuthenticateIdentifier) {
        await onAuthenticateIdentifier(cleanId, password);
      }
      setState({ success: true });
    } catch (err: any) {
      setState({
        error: err?.message || tErrors.invalidCredentials,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-2xl bg-red-50/95 border border-red-200 text-xs font-medium text-red-900 shadow-sm"
        >
          {state.error}
        </div>
      )}

      {/* Email Address / Login User (Identifier) Pill Glass Input with Real-Time Validation Feedback */}
      <div className="space-y-1.5">
        <label htmlFor="login-identifier" className="block text-xs font-semibold text-[#0B1F3A] pl-1">
          {tAuth.email}
        </label>
        <div className="relative flex items-center">
          <span
            aria-hidden="true"
            className={`absolute left-4 z-10 pointer-events-none flex items-center transition-colors ${
              showRealtimeEmailInvalid
                ? 'text-red-600'
                : showRealtimeEmailValid
                  ? 'text-emerald-600'
                  : 'text-[#5B6B86]'
            }`}
          >
            <User className="w-5 h-5" />
          </span>
          <input
            id="login-identifier"
            data-testid="login-identifier-input"
            name="identifier"
            type="email"
            autoComplete="username"
            required
            value={identifier}
            onChange={handleIdentifierChange}
            onBlur={() => {
              if (identifier.length > 0) setIdentifierTouched(true);
            }}
            placeholder={tAuth.emailPlaceholder}
            aria-invalid={showRealtimeEmailInvalid}
            aria-describedby={showRealtimeEmailInvalid ? 'identifier-error' : undefined}
            className={`sl-glass-input w-full pl-12 pr-11 text-[15px] font-medium text-[#0B1F3A] placeholder:text-[#5B6B86] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              showRealtimeEmailInvalid
                ? 'sl-glass-input-invalid !border-red-500 !bg-red-50/75 ring-2 ring-red-400/50 focus-visible:!ring-red-600'
                : showRealtimeEmailValid
                  ? 'sl-glass-input-valid !border-emerald-500/85 focus-visible:ring-emerald-600'
                  : 'focus-visible:ring-[#1E4FD8]'
            }`}
          />
          {showRealtimeEmailInvalid && (
            <span
              data-testid="email-validation-invalid-icon"
              aria-hidden="true"
              className="absolute right-3.5 text-red-600 flex items-center pointer-events-none"
            >
              <AlertCircle className="w-5 h-5" />
            </span>
          )}
          {showRealtimeEmailValid && (
            <span
              data-testid="email-validation-valid-icon"
              aria-hidden="true"
              className="absolute right-3.5 text-emerald-600 flex items-center pointer-events-none"
            >
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
        </div>
        {showRealtimeEmailInvalid && (
          <p
            id="identifier-error"
            data-testid="email-validation-error"
            role="alert"
            aria-live="polite"
            className="text-xs font-medium text-red-700 pl-2 flex items-center gap-1"
          >
            {state.fieldErrors?.identifier || tErrors.invalidEmail}
          </p>
        )}
      </div>

      {/* Password Pill Glass Input with Trailing Show/Hide Toggle Icon */}
      <div className="space-y-1.5">
        <label htmlFor="login-password" className="block text-xs font-semibold text-[#0B1F3A] pl-1">
          {tAuth.password}
        </label>
        <div className="relative flex items-center">
          <span
            aria-hidden="true"
            className={`absolute left-4 z-10 pointer-events-none flex items-center transition-colors ${
              state.fieldErrors?.password ? 'text-red-600' : 'text-[#5B6B86]'
            }`}
          >
            <Lock className="w-5 h-5" />
          </span>
          <input
            id="login-password"
            data-testid="login-password-input"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={handlePasswordChange}
            placeholder={tAuth.passwordPlaceholder}
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? 'password-error' : undefined}
            className={`sl-glass-input w-full pl-12 pr-14 text-[15px] font-medium text-[#0B1F3A] placeholder:text-[#5B6B86] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              state.fieldErrors?.password
                ? '!border-red-500 !bg-red-50/75 ring-2 ring-red-400/50 focus-visible:!ring-red-600'
                : 'focus-visible:ring-[#1E4FD8]'
            }`}
          />
          <button
            type="button"
            data-testid="toggle-password-visibility"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? tAuth.hidePassword : tAuth.showPassword}
            aria-pressed={showPassword}
            title={showPassword ? tAuth.hidePassword : tAuth.showPassword}
            className="absolute right-2 w-11 h-11 flex items-center justify-center rounded-xl text-[#5B6B86] hover:text-[#0B1F3A] hover:bg-white/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8] focus-visible:ring-offset-2"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5 text-[#1E4FD8]" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p id="password-error" role="alert" className="text-xs font-medium text-red-700 pl-2">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      {/* Remember Me Checkbox & Forgot Password Link Row Below Password Field */}
      <div className="flex items-center justify-between pt-1">
        <label
          htmlFor="login-remember-me"
          className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none"
        >
          <span className="relative flex items-center justify-center">
            <input
              id="login-remember-me"
              data-testid="remember-me-checkbox"
              type="checkbox"
              name="remember"
              checked={rememberMe}
              onChange={(e) => handleRememberMeChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="w-5 h-5 rounded-md border border-[#1E4FD8] bg-white peer-checked:bg-[#1E4FD8] peer-focus-visible:ring-2 peer-focus-visible:ring-[#1E4FD8] peer-focus-visible:ring-offset-2 flex items-center justify-center transition-colors">
              <Check className="w-3.5 h-3.5 text-white" />
            </span>
          </span>
          <span className="text-sm font-medium text-[#0B1F3A]">{tAuth.rememberMe}</span>
        </label>

        <ForgotPasswordHelper locale={locale} defaultEmail={identifier} />
      </div>

      {/* Primary Gradient Pill Login Button with Spinner & Check Animation Feedback */}
      <div className="pt-2">
        <button
          type="submit"
          data-testid="login-submit-button"
          disabled={isPending}
          className={`sl-primary-btn relative w-full flex items-center justify-center gap-2.5 px-6 text-white font-semibold text-[17px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4FD8] focus-visible:ring-offset-2 disabled:opacity-80 ${
            state.success ? '!bg-emerald-600' : ''
          }`}
        >
          {isPending && (
            <Loader2
              data-testid="login-button-spinner"
              aria-hidden="true"
              className="w-5 h-5 animate-spin text-white/95 shrink-0"
            />
          )}
          {!isPending && state.success && (
            <Check
              data-testid="login-button-check"
              aria-hidden="true"
              className="w-5 h-5 text-white stroke-[2.75] animate-bounce shrink-0"
            />
          )}
          <span>{isPending ? tAuth.signingIn : tAuth.login}</span>
          <span
            aria-hidden="true"
            className="absolute right-3 w-9 h-9 rounded-full bg-white/95 text-[#1E3FBF] flex items-center justify-center shadow-sm transition-transform duration-200"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1E4FD8]" />
            ) : state.success ? (
              <Check className="w-4 h-4 stroke-[2.75] text-emerald-600 scale-110 transition-transform" />
            ) : (
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            )}
          </span>
        </button>
      </div>
    </form>
  );
};

export default LoginForm;

