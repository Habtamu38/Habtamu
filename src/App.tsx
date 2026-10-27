/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase';
import {
  ActiveTabId,
  CalendarDisplayMode,
  OfflineQueuedOperation,
  PortalAccountRecord,
  SchoolRecord,
  WorkspacePayload,
} from './types/esms';
import {
  formatCalendarDate,
  getHeaderSyncStatusModel,
  isPrintableReportView,
  LanguageCode,
  triggerBrowserPrintReport,
  UserRole,
} from './utils/ethiopianRules';
import { TRANSLATIONS } from './utils/i18n';
import { OverviewDashboardView, SchoolsAndConfigView } from './components/OverviewAndSchoolsTab';
import {
  StudentsAndAdmissionsView,
  TeachersAndTimetableView,
} from './components/StudentsAndTeachersTab';
import {
  AttendanceManagementView,
  ExaminationsAndResultsView,
} from './components/AttendanceAndExamsTab';
import {
  FinanceAndFeesView,
  LibraryTransportInventoryView,
} from './components/FinanceAndOperationsTab';
import {
  DeliverablesAndSpecsView,
  OfflineSyncAndAuditView,
  ParentAndStudentPortalView,
} from './components/PortalsSyncAndSpecsTab';
import {
  AdminAccessAndCodeManagerView,
  DedicatedTeacherPortalView,
  PortalLoginModal,
} from './components/RolePortalsAndAccessTab';
import { StudentPortalDashboard } from './components/StudentPortalDashboard';
import { GoogleDriveDatabasePanel } from './components/GoogleDriveDatabasePanel';
import { WorkspaceStateContext } from './utils/googleDriveDb';
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  CalendarCheck,
  Award,
  Landmark,
  BookOpen,
  UserCheck,
  RefreshCw,
  FileCode2,
  KeyRound,
  ShieldCheck,
  Cloud,
  Printer,
} from 'lucide-react';

const EMPTY_WORKSPACE: WorkspacePayload = {
  school: null,
  students: [],
  teachers: [],
  classSections: [],
  subjects: [],
  attendance: [],
  marks: [],
  invoices: [],
  payments: [],
  libraryBooks: [],
  transportRoutes: [],
  inventoryAssets: [],
  announcements: [],
  syncOperations: [],
  auditLogs: [],
  portalAccounts: [],
  ebooks: [],
  homeworks: [],
  onlineExams: [],
  onlineExamSubmissions: [],
};

const OFFLINE_STORAGE_KEY = 'esms_offline_sync_queue_v1';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const [lang, setLang] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('esms_preferred_locale_v1');
      if (saved === 'en' || saved === 'am') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'en';
  });
  const handleToggleLocale = (nextLocale: LanguageCode) => {
    setLang(nextLocale);
    try {
      localStorage.setItem('esms_preferred_locale_v1', nextLocale);
    } catch {
      // ignore
    }
  };
  const [calendarMode, setCalendarMode] = useState<CalendarDisplayMode>('BOTH');
  const [loggedInAccount, setLoggedInAccount] = useState<PortalAccountRecord | null>(() => {
    try {
      const saved = sessionStorage.getItem('esms_authenticated_account_v1');
      return saved ? (JSON.parse(saved) as PortalAccountRecord) : null;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState<UserRole>(() => {
    try {
      const saved = sessionStorage.getItem('esms_authenticated_account_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as PortalAccountRecord;
        return parsed.role;
      }
    } catch {
      // ignore
    }
    return 'SCHOOL_ADMIN';
  });
  const [activeTab, setActiveTab] = useState<ActiveTabId>(() => {
    try {
      const saved = sessionStorage.getItem('esms_authenticated_account_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as PortalAccountRecord;
        if (parsed.role === 'STUDENT') return 'student_portal';
        if (parsed.role === 'TEACHER') return 'teacher_portal';
        if (parsed.role === 'FINANCE_OFFICER') return 'finance';
        if (parsed.role === 'LIBRARIAN') return 'operations';
      }
    } catch {
      // ignore
    }
    return 'overview';
  });

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<number>(1);
  const [workspace, setWorkspace] = useState<WorkspacePayload>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showGlobalDrivePanel, setShowGlobalDrivePanel] = useState<boolean>(false);

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedOperation[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleWorkspaceContextRestored = useCallback(
    (ctx: WorkspaceStateContext) => {
      if (ctx.activeSchoolId && typeof ctx.activeSchoolId === 'number') {
        setActiveSchoolId(ctx.activeSchoolId);
      }
      if (ctx.lang === 'en' || ctx.lang === 'am') {
        handleToggleLocale(ctx.lang);
      }
      if (
        ctx.calendarMode === 'BOTH' ||
        ctx.calendarMode === 'ETHIOPIAN' ||
        ctx.calendarMode === 'GREGORIAN'
      ) {
        setCalendarMode(ctx.calendarMode);
      }
      if (Array.isArray(ctx.offlineQueue)) {
        setOfflineQueue(ctx.offlineQueue);
        try {
          localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(ctx.offlineQueue));
        } catch {
          // ignore
        }
      }
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setFirebaseUser(usr);
      if (usr) {
        const token = await usr.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
    });
    return () => unsub();
  }, []);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-esms-role': role,
        'x-esms-school-id': String(activeSchoolId),
        ...(options.headers as Record<string, string>),
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      } else {
        headers['Authorization'] = 'Bearer esms-local-session';
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed with HTTP ${response.status}`);
      }
      return data;
    },
    [role, activeSchoolId, idToken]
  );

  const loadWorkspaceData = useCallback(
    async (targetSchoolId?: number) => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const schoolListRes = await apiFetch('/api/v1/schools');
        const list: SchoolRecord[] = schoolListRes.schools || [];
        setSchools(list);

        const resolvedSchoolId = targetSchoolId ?? activeSchoolId ?? list[0]?.id ?? 1;
        const wsData = await apiFetch(`/api/v1/workspace/${resolvedSchoolId}`);
        setWorkspace(wsData);
      } catch (err: any) {
        setErrorBanner(err.message || 'Failed to load ESMS workspace data.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, activeSchoolId]
  );

  useEffect(() => {
    loadWorkspaceData(activeSchoolId);
  }, [activeSchoolId, role, loadWorkspaceData]);

  const handlePortalAccountAuthenticated = (account: PortalAccountRecord) => {
    setLoggedInAccount(account);
    setRole(account.role);
    try {
      sessionStorage.setItem('esms_authenticated_account_v1', JSON.stringify(account));
    } catch {
      // ignore
    }
    if (account.schoolId && account.schoolId !== activeSchoolId) {
      setActiveSchoolId(account.schoolId);
    }
    if (account.role === 'STUDENT') {
      setActiveTab('student_portal');
    } else if (account.role === 'TEACHER') {
      setActiveTab('teacher_portal');
    } else if (account.role === 'FINANCE_OFFICER') {
      setActiveTab('finance');
    } else if (account.role === 'LIBRARIAN') {
      setActiveTab('operations');
    } else {
      setActiveTab('overview');
    }
  };

  const handleLogout = () => {
    setLoggedInAccount(null);
    try {
      sessionStorage.removeItem('esms_authenticated_account_v1');
    } catch {
      // ignore
    }
  };

  const handleEnqueueOffline = (op: OfflineQueuedOperation) => {
    setOfflineQueue((prev) => {
      const next = [op, ...prev];
      try {
        localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleFlushOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    await apiFetch('/api/v1/sync', {
      method: 'POST',
      body: JSON.stringify({
        schoolId: activeSchoolId,
        operations: offlineQueue,
      }),
    });
    setOfflineQueue([]);
    try {
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
    } catch {
      // ignore
    }
    await loadWorkspaceData(activeSchoolId);
  };

  const handleGoogleSignIn = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user?.email) {
        const res = await apiFetch('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier: cred.user.email }),
        });
        if (res.account) {
          handlePortalAccountAuthenticated(res.account);
        }
      }
    } catch (err: any) {
      await signOut(auth);
      setErrorBanner(
        err.message ||
          'Login rejected: Only emails registered in the Admin system are permitted to log in.'
      );
    }
  };

  const t = TRANSLATIONS[lang];

  const ALL_NAV_ITEMS: ReadonlyArray<{
    id: ActiveTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: UserRole[];
  }> = [
    { id: 'overview', label: t.navDashboard, icon: LayoutDashboard },
    {
      id: 'access_control',
      label: 'Access Codes',
      icon: ShieldCheck,
    },
    {
      id: 'student_portal',
      label: 'Student Portal',
      icon: GraduationCap,
    },
    {
      id: 'teacher_portal',
      label: 'Teacher Portal',
      icon: Users,
    },
    { id: 'schools', label: t.navSchools, icon: Building2 },
    { id: 'students', label: t.navStudents, icon: GraduationCap },
    { id: 'teachers', label: t.navTeachers, icon: Users },
    { id: 'attendance', label: t.navAttendance, icon: CalendarCheck },
    { id: 'exams', label: t.navExams, icon: Award },
    { id: 'finance', label: t.navFinance, icon: Landmark },
    { id: 'operations', label: t.navOperations, icon: BookOpen },
    { id: 'portals', label: t.navPortals, icon: UserCheck },
    { id: 'sync', label: t.navSyncAudit, icon: RefreshCw },
    { id: 'deliverables', label: t.navArchitecture, icon: FileCode2 },
  ];

  // Filter sidebar tabs when logged in as a specific role code (STU-, TEA-, FIN-, LIN-)
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (role === 'STUDENT') {
      return item.id === 'student_portal';
    }
    if (role === 'TEACHER') {
      return (
        item.id === 'teacher_portal' ||
        item.id === 'students' ||
        item.id === 'attendance' ||
        item.id === 'exams'
      );
    }
    if (role === 'FINANCE_OFFICER') {
      return item.id === 'finance' || item.id === 'overview';
    }
    if (role === 'LIBRARIAN') {
      return item.id === 'operations' || item.id === 'student_portal';
    }
    return true;
  });

  const activeNavLabel =
    ALL_NAV_ITEMS.find((n) => n.id === activeTab)?.label || t.navDashboard;

  // Strict Email + Password Login Gate: If not logged in, render ONLY the SmartLearn Login Screen
  if (!loggedInAccount) {
    return (
      <PortalLoginModal
        isOpen={true}
        onClose={() => {}}
        lang={lang}
        onToggleLocale={handleToggleLocale}
        currentAccount={null}
        portalAccounts={workspace.portalAccounts}
        onLoginSuccess={handlePortalAccountAuthenticated}
        apiFetch={apiFetch}
      />
    );
  }

  const syncStatus = getHeaderSyncStatusModel(offlineQueue.length);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FE] text-[#20243A]">
      {/* Top Bar Contract: Zone 1 (Brand Wordmark) — Zone 2 (Sync Status & Authenticated Info) — Zone 3 (Log Out Action) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4 no-print">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab(role === 'STUDENT' ? 'student_portal' : role === 'TEACHER' ? 'teacher_portal' : 'overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          {t.appTitle}
        </a>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Header Sync Status Indicator (Online / Offline Queue based on offlineQueue.length) */}
          <button
            type="button"
            onClick={() => {
              if (role !== 'STUDENT') {
                setActiveTab('sync');
              }
            }}
            title={lang === 'am' ? syncStatus.tooltipAm : syncStatus.tooltipEn}
            data-testid="header-sync-status-indicator"
            data-sync-status={syncStatus.statusCode}
            data-queue-size={syncStatus.queueSize}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${syncStatus.badgeColorClass}`}
          >
            <span
              data-testid="header-sync-status-dot"
              aria-hidden="true"
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${syncStatus.dotColorClass}`}
            />
            <span>{lang === 'am' ? syncStatus.labelAm : syncStatus.labelEn}</span>
          </button>

          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-800">
            {loggedInAccount.email} · {loggedInAccount.accessCode}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </header>

      {/* Workspace Body: Left Sidebar + Main Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-x-hidden">
        {role !== 'STUDENT' && (
          <aside
            aria-label="Module navigation"
            className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-3 lg:p-4 flex flex-col justify-between shrink-0 no-print"
          >
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 lg:py-2.5 text-xs font-medium rounded-lg transition-colors text-left whitespace-nowrap shrink-0 lg:w-full ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:block mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
              <div>
                Today:{' '}
                <strong className="text-slate-800">
                  {formatCalendarDate('2026-10-23', 'ETHIOPIAN', lang)}
                </strong>
              </div>
              <div>Currency: ETB · Timezone: EAT</div>
              {firebaseUser && (
                <div className="truncate text-[11px] text-emerald-700 font-mono">
                  Google: {firebaseUser.email}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 min-w-0">
          {/* Workspace Context Toolbar (Below Header) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 no-print">
            {/* Breadcrumb Trail & Active Access Code Badge */}
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">
                {workspace.school?.code || 'ESMS'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">{activeNavLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded font-mono font-semibold">
                {loggedInAccount
                  ? `${loggedInAccount.accessCode} (${loggedInAccount.email})`
                  : `Role: ${role}`}
              </span>
            </div>

            {/* Interactive Tenant, Language & Calendar Controls */}
            <div className="flex flex-wrap items-center gap-3 max-w-full">
              {/* School Tenant Selector (hidden for Student so Student Dashboard stays clean) */}
              {role !== 'STUDENT' && (
                <div className="flex items-center gap-1.5 max-w-full">
                  <label htmlFor="tenant-select" className="text-xs font-medium text-slate-600 shrink-0">
                    {t.activeSchool}:
                  </label>
                  <select
                    id="tenant-select"
                    value={activeSchoolId}
                    onChange={(e) => setActiveSchoolId(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-medium text-slate-900 max-w-[200px] truncate"
                  >
                    {schools.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        #{sch.id} · {sch.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Language Toggle (EN / አማ) */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['en', 'am'] as const).map((lc) => (
                  <button
                    key={lc}
                    type="button"
                    onClick={() => handleToggleLocale(lc)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      lang === lc
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lc === 'en' ? 'EN' : 'አማ'}
                  </button>
                ))}
              </div>

              {/* Calendar Mode Selector */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['BOTH', 'ETHIOPIAN', 'GREGORIAN'] as const).map((cm) => (
                  <button
                    key={cm}
                    type="button"
                    onClick={() => setCalendarMode(cm)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      calendarMode === cm
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cm === 'BOTH' ? 'Dual Cal' : cm === 'ETHIOPIAN' ? 'E.C.' : 'G.C.'}
                  </button>
                ))}
              </div>

              {/* Print Report Button in Toolbar for Examinations & Finance Views */}
              {isPrintableReportView(activeTab) && (
                <button
                  type="button"
                  data-testid="toolbar-print-report-btn"
                  onClick={() => triggerBrowserPrintReport()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Print Report</span>
                </button>
              )}

              {/* Quick Toggle for Google Drive ('ESMS Database') & Workspace JSON Export/Import */}
              {role !== 'STUDENT' && (
                <button
                  type="button"
                  data-testid="toolbar-esms-drive-toggle-btn"
                  onClick={() => {
                    if (activeTab === 'overview' || activeTab === 'sync') {
                      document
                        .querySelector('[data-testid="google-drive-database-panel"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                      setShowGlobalDrivePanel((prev) => !prev);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-700" />
                  <span>{lang === 'am' ? 'ESMS Database (Drive)' : 'ESMS Database (Drive)'}</span>
                </button>
              )}
            </div>
          </div>

          {role !== 'STUDENT' &&
            showGlobalDrivePanel &&
            activeTab !== 'overview' &&
            activeTab !== 'sync' && (
              <GoogleDriveDatabasePanel
                lang={lang}
                apiFetch={apiFetch}
                onDatabaseRestored={() => loadWorkspaceData(activeSchoolId)}
                workspaceContext={{
                  activeSchoolId,
                  activeTab,
                  lang,
                  calendarMode,
                  offlineQueue,
                }}
                onWorkspaceContextRestored={handleWorkspaceContextRestored}
              />
            )}

          {errorBanner && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center justify-between">
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="underline font-medium ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading && !workspace.school ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-4">
              <div className="h-6 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-4">
                <div className="h-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-24 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewDashboardView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  offlineQueueCount={offlineQueue.length}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'access_control' && (
                <AdminAccessAndCodeManagerView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  onSwitchAccount={handlePortalAccountAuthenticated}
                />
              )}

              {activeTab === 'student_portal' && (
                <StudentPortalDashboard
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  loggedInAccount={loggedInAccount}
                />
              )}

              {activeTab === 'teacher_portal' && (
                <DedicatedTeacherPortalView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  loggedInAccount={loggedInAccount}
                />
              )}

              {activeTab === 'schools' && (
                <SchoolsAndConfigView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  onSchoolCreated={async (newSchoolId) => {
                    setActiveSchoolId(newSchoolId);
                    await loadWorkspaceData(newSchoolId);
                  }}
                />
              )}

              {activeTab === 'students' && (
                <StudentsAndAdmissionsView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'teachers' && (
                <TeachersAndTimetableView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceManagementView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  onEnqueueOffline={handleEnqueueOffline}
                />
              )}

              {activeTab === 'exams' && (
                <ExaminationsAndResultsView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'finance' && (
                <FinanceAndFeesView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'operations' && (
                <LibraryTransportInventoryView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'portals' && (
                <ParentAndStudentPortalView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'sync' && (
                <OfflineSyncAndAuditView
                  lang={lang}
                  calendarMode={calendarMode}
                  role={role}
                  activeSchoolId={activeSchoolId}
                  schools={schools}
                  workspace={workspace}
                  onRefresh={() => loadWorkspaceData(activeSchoolId)}
                  apiFetch={apiFetch}
                  onNavigateTab={setActiveTab}
                  offlineQueue={offlineQueue}
                  onEnqueueOffline={handleEnqueueOffline}
                  onFlushOfflineQueue={handleFlushOfflineQueue}
                />
              )}

              {activeTab === 'deliverables' && <DeliverablesAndSpecsView lang={lang} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

