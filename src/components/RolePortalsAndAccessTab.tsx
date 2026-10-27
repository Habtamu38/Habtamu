import React, { useEffect, useState } from 'react';
import {
  EBookRecord,
  HomeworkRecord,
  OnlineExamQuestion,
  OnlineExamRecord,
  PortalAccountRecord,
  SharedViewProps,
} from '../types/esms';
import {
  AccessCodePrefix,
  buildStudentAttendanceProgressModel,
  calculateAnnualStudentStanding,
  calculateAssessmentResult,
  calculateOnlineExamRemainingSeconds,
  calculateStudentAttendanceSummary,
  formatCalendarDate,
  formatExamCountdown,
  generateRoleAccessCode,
  getGradePassFailBadge,
  isOnlineExamActiveForStudent,
  StudentHomeModuleId,
} from '../utils/ethiopianRules';
import {
  KeyRound,
  UserCheck,
  BookOpen,
  Award,
  FileCheck2,
  Megaphone,
  Users,
  CalendarCheck,
  ClipboardList,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

import LoginPage from '../app/[locale]/(public)/login/page';
import { StudentProfileCard } from './StudentProfileCard';
import { StudentHomeworkSection } from './StudentHomeworkSection';

// ============================================================================
// 1. SMARTLEARN ETHIOPIA FROSTED LOGIN SCREEN (FULL-HEIGHT MOBILE-FIRST DESIGN)
// ============================================================================
export interface PortalLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'am';
  onToggleLocale?: (nextLocale: 'en' | 'am') => void;
  currentAccount: PortalAccountRecord | null;
  portalAccounts: PortalAccountRecord[];
  onLoginSuccess: (account: PortalAccountRecord) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export const PortalLoginModal: React.FC<PortalLoginModalProps> = ({
  isOpen,
  onClose,
  lang,
  onToggleLocale,
  onLoginSuccess,
  apiFetch,
}) => {
  if (!isOpen) return null;

  const handleAuthenticate = async (identifierVal: string, passwordVal: string) => {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifierVal.trim(),
        password: passwordVal,
      }),
    });
    if (res.account) {
      setTimeout(() => {
        onLoginSuccess(res.account);
        onClose();
      }, 300);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <LoginPage
        locale={lang}
        onToggleLocale={onToggleLocale}
        onAuthenticateIdentifier={handleAuthenticate}
      />
    </div>
  );
};

// ============================================================================
// 2. ADMIN ACCESS CONTROL & 6-DIGIT CODE GENERATOR VIEW (STU-, TEA-, FIN-, LIN-)
// ============================================================================
export const AdminAccessAndCodeManagerView: React.FC<
  SharedViewProps & {
    onSwitchAccount: (account: PortalAccountRecord) => void;
  }
> = ({ lang, activeSchoolId, workspace, onRefresh, apiFetch, onSwitchAccount }) => {
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [role, setRole] = useState<string>('STUDENT');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('STU-482910');
  const [fullName, setFullName] = useState('');
  const [fullNameAm, setFullNameAm] = useState('');
  const [linkedStudentId, setLinkedStudentId] = useState<number | ''>('');
  const [linkedTeacherId, setLinkedTeacherId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const prefixForRole = (r: string): AccessCodePrefix | 'ADM' => {
    if (r === 'STUDENT') return 'STU';
    if (r === 'TEACHER') return 'TEA';
    if (r === 'FINANCE_OFFICER') return 'FIN';
    if (r === 'LIBRARIAN') return 'LIN';
    return 'ADM';
  };

  const handleGenerateNewSixDigitCode = (targetRole: string = role) => {
    const prefix = prefixForRole(targetRole);
    if (prefix === 'ADM') {
      const six = String(Math.floor(100000 + Math.random() * 900000));
      setAccessCode(`ADM-${six}`);
    } else {
      setAccessCode(generateRoleAccessCode(prefix));
    }
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (!editingAccountId) {
      handleGenerateNewSixDigitCode(newRole);
    }
  };

  const handleStartEditAccount = (acc: PortalAccountRecord) => {
    setEditingAccountId(acc.id);
    setRole(acc.role);
    setEmail(acc.email);
    setAccessCode(acc.accessCode);
    setFullName(acc.fullName);
    setFullNameAm(acc.fullNameAm);
    setLinkedStudentId(acc.linkedStudentId ?? '');
    setLinkedTeacherId(acc.linkedTeacherId ?? '');
    setFeedback(null);
  };

  const handleResetForm = () => {
    setEditingAccountId(null);
    setRole('STUDENT');
    setEmail('');
    handleGenerateNewSixDigitCode('STUDENT');
    setFullName('');
    setFullNameAm('');
    setLinkedStudentId('');
    setLinkedTeacherId('');
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch('/api/v1/portal-accounts', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          accountId: editingAccountId ?? undefined,
          email,
          accessCode,
          fullName,
          fullNameAm,
          role,
          linkedStudentId: linkedStudentId ? Number(linkedStudentId) : null,
          linkedTeacherId: linkedTeacherId ? Number(linkedTeacherId) : null,
          isActive: true,
        }),
      });
      setFeedback(
        editingAccountId
          ? `Updated login account and password code (${accessCode}).`
          : `Registered new login email (${email}) with 6-digit Password Code ${accessCode}.`
      );
      handleResetForm();
      await onRefresh();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (acc: PortalAccountRecord) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/portal-accounts/${acc.id}?schoolId=${activeSchoolId}`, {
        method: 'DELETE',
      });
      if (editingAccountId === acc.id) {
        handleResetForm();
      }
      setFeedback(`Deleted login account ${acc.email} (${acc.accessCode}).`);
      await onRefresh();
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              Admin Login Email & 6-Digit Password Code Generator (Password = STU- / TEA- / FIN- / LIN-)
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              The Admin-generated 6-digit role code serves directly as the user’s Login Password.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="access-tab-authorize-all-students-btn"
              onClick={async () => {
                setFeedback(null);
                try {
                  const res = await apiFetch('/api/v1/students/authorize-all-login', {
                    method: 'POST',
                    body: JSON.stringify({ schoolId: activeSchoolId }),
                  });
                  setFeedback(
                    lang === 'am'
                      ? `ሁሉም የተመዘገቡ ተማሪዎች (${res.authorizedStudentsCount}) Login እንዲያደርጉ ተፈቅዷል!`
                      : `Authorized all ${res.authorizedStudentsCount} registered student(s) for Portal Login (${res.activePortalAccountsCount} active student accounts).`
                  );
                  await onRefresh();
                } catch (err: any) {
                  setFeedback(`Error: ${err.message}`);
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lang === 'am'
                ? 'ሁሉም የተመዘገቡ ተማሪዎች Login ፍቀድ'
                : 'Authorize All Registered Students Login'}
            </button>
            {editingAccountId && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div className="mb-4 p-3 rounded-md bg-slate-100 border border-slate-300 text-xs text-slate-900 font-medium">
            {feedback}
          </div>
        )}

        <form onSubmit={handleSaveAccount} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              User Role & Code Prefix *
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white font-medium"
            >
              <option value="STUDENT">Student (STU)</option>
              <option value="TEACHER">Teacher (TEA)</option>
              <option value="FINANCE_OFFICER">Finance Officer (FIN)</option>
              <option value="LIBRARIAN">Librarian (LIN)</option>
              <option value="SCHOOL_ADMIN">School Admin (ADM)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Generated 6-Digit Code (Used as Login Password) *
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-md font-mono font-bold text-slate-900 bg-slate-50"
              />
              <button
                type="button"
                onClick={() => handleGenerateNewSixDigitCode(role)}
                className="px-3 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap"
                title="Generate new 6-digit password code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Registered Login Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@school.edu.et"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Full Name (English) *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dawit Kebede Tadesse"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Department / Secondary Title
            </label>
            <input
              type="text"
              value={fullNameAm}
              onChange={(e) => setFullNameAm(e.target.value)}
              placeholder="e.g. Grade 10 Section A"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          {role === 'STUDENT' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link to Student Profile
              </label>
              <select
                value={linkedStudentId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  setLinkedStudentId(id);
                  const st = workspace.students.find((s) => s.id === id);
                  if (st) {
                    setFullName(`${st.firstName} ${st.fatherName} ${st.grandfatherName}`);
                    setFullNameAm(st.fullNameAm);
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">-- Select Student --</option>
                {workspace.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentCode} · {s.firstName} {s.fatherName} ({s.gradeLevel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {role === 'TEACHER' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link to Teacher Profile
              </label>
              <select
                value={linkedTeacherId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : '';
                  setLinkedTeacherId(id);
                  const tc = workspace.teachers.find((t) => t.id === id);
                  if (tc) {
                    setFullName(tc.fullName);
                    setFullNameAm(tc.fullNameAm);
                    setEmail(tc.email);
                  }
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">-- Select Teacher --</option>
                {workspace.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.staffCode} · {t.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingAccountId
                  ? 'Update Registered Email & Access Code'
                  : 'Register Email & Generate 6-Digit Access Code'}
            </button>
          </div>
        </form>
      </div>

      {/* Directory of All Registered Login Accounts & 6-Digit Access Codes */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Admin-Registered Portal Login Accounts & 6-Digit Codes ({workspace.portalAccounts.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-medium">Generated Code (Login Password)</th>
                <th className="py-2.5 px-3 font-medium">Registered Email</th>
                <th className="py-2.5 px-3 font-medium">Full Name</th>
                <th className="py-2.5 px-3 font-medium">Role</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workspace.portalAccounts.map((acc) => {
                const isPrimaryAdmin = acc.email.toLowerCase() === 'habteofat@gmail.com';
                return (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-300 rounded">
                        {isPrimaryAdmin ? '85835452Ha& (Locked Admin)' : acc.accessCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{acc.email}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{acc.fullName}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                      {acc.role}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSwitchAccount(acc)}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" /> Login As
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditAccount(acc)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPrimaryAdmin}
                          onClick={() => handleDeleteAccount(acc)}
                          className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            isPrimaryAdmin
                              ? 'Primary Admin account cannot be deleted'
                              : 'Delete login account'
                          }
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. DEDICATED STUDENT PORTAL VIEW (ALL 8 SECTIONS)
// ============================================================================
export type StudentSectionTab = StudentHomeModuleId;

export const DedicatedStudentPortalView: React.FC<
  SharedViewProps & {
    loggedInAccount: PortalAccountRecord | null;
  }
> = ({ lang, calendarMode, activeSchoolId, workspace, onRefresh, apiFetch, loggedInAccount }) => {
  const defaultStu =
    workspace.students.find((s) => s.studentCode === 'STU-482910') ||
    workspace.students[workspace.students.length - 1] ||
    workspace.students[0];

  const [selectedStudentId, setSelectedStudentId] = useState<number>(
    loggedInAccount?.linkedStudentId || defaultStu?.id || 1
  );
  const [activeSubTab, setActiveSubTab] = useState<StudentSectionTab>('profile');
  const [selectedEbookId, setSelectedEbookId] = useState<number | null>(null);

  // Exam Space State & Real-Time 1-Second Expiration Ticker
  const [activeExamId, setActiveExamId] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [examResultMsg, setExamResultMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const student =
    workspace.students.find((s) => s.id === loggedInAccount?.linkedStudentId) ||
    workspace.students.find(
      (s) =>
        Boolean(loggedInAccount?.accessCode) &&
        s.studentCode.toUpperCase() === loggedInAccount?.accessCode.toUpperCase()
    ) ||
    workspace.students.find((s) => s.id === selectedStudentId) ||
    workspace.students[0];

  const studentMarks = workspace.marks.filter((m) => m.studentId === student?.id);
  const studentAttendance = workspace.attendance.filter((a) => a.studentId === student?.id);
  const attSummary = calculateStudentAttendanceSummary(studentAttendance);
  const attendanceProgress = buildStudentAttendanceProgressModel(studentAttendance);
  const studentSubmissions = workspace.onlineExamSubmissions.filter(
    (sub) => sub.studentId === student?.id
  );

  const studentAccount = workspace.portalAccounts.find(
    (p) =>
      (p.linkedStudentId === student?.id || p.accessCode === student?.studentCode) &&
      p.role === 'STUDENT'
  );

  const studentIdCode = studentAccount?.accessCode || student?.studentCode || 'STU-482910';

  // Filter exams so ONLY teacher-posted exams for the student's grade level whose allotted durationMinutes have NOT expired are visible
  const activeTeacherExams = workspace.onlineExams.filter(
    (ex) =>
      isOnlineExamActiveForStudent(ex, nowMs) &&
      (!student?.gradeLevel || !ex.gradeLevel || ex.gradeLevel === student.gradeLevel)
  );

  // Filter homework to show ONLY teacher-uploaded assignments (memoized so 1s exam timer does not reset child state)
  const teacherUploadedHomeworks = React.useMemo(
    () =>
      workspace.homeworks.filter(
        (hw) => !student?.gradeLevel || !hw.gradeLevel || hw.gradeLevel === student.gradeLevel
      ),
    [workspace.homeworks, student?.gradeLevel]
  );

  // Automatically close active exam if the teacher's allotted minutes expire while the student has it open
  useEffect(() => {
    if (activeExamId !== null) {
      const stillActive = activeTeacherExams.some((ex) => ex.id === activeExamId);
      if (!stillActive) {
        setActiveExamId(null);
        setExamResultMsg(
          'The minutes allotted by the teacher have elapsed and the exam has closed.'
        );
      }
    }
  }, [activeExamId, activeTeacherExams]);

  const currentEbook: EBookRecord | undefined =
    workspace.ebooks.find((b) => b.id === selectedEbookId) || workspace.ebooks[0];

  const annualStanding = calculateAnnualStudentStanding(studentMarks);
  const averageScore =
    studentMarks.length > 0 ? annualStanding.overallPercentage.toFixed(1) : '0.0';

  const DASHBOARD_MODULE_CARDS: Array<{
    id: StudentSectionTab;
    labelEn: string;
    metric: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'profile',
      labelEn: '1. Student Profile',
      metric: `${student?.gradeLevel || 'Grade 10'} · ${student?.sectionName || 'Section A'}`,
      icon: UserCheck,
    },
    {
      id: 'ebook',
      labelEn: '2. EBook Library',
      metric: `${workspace.ebooks.length} Digital Textbooks`,
      icon: BookOpen,
    },
    {
      id: 'grade',
      labelEn: '3. Grades & Report',
      metric:
        studentMarks.length > 0
          ? `${averageScore}% / 100% · ${annualStanding.passed ? 'PASSED (≥50%)' : 'FAILED (<50%)'}`
          : 'No Teacher Marks Yet',
      icon: Award,
    },
    {
      id: 'exam_space',
      labelEn: '4. Exam',
      metric: `${activeTeacherExams.length} Active Timed Assessment(s)`,
      icon: FileCheck2,
    },
    {
      id: 'announcements',
      labelEn: '5. School Announcements',
      metric: `${workspace.announcements.length} Official Notice(s)`,
      icon: Megaphone,
    },
    {
      id: 'teachers_timetable',
      labelEn: '6. Teachers & Timetable',
      metric: `${workspace.teachers.length} Faculty · Mon–Fri Schedule`,
      icon: Users,
    },
    {
      id: 'attendance',
      labelEn: '7. Attendance',
      metric: `${attendanceProgress.clampedPercent}% Rate · ${attendanceProgress.presentDays} Present`,
      icon: CalendarCheck,
    },
    {
      id: 'homework',
      labelEn: '8. Homework',
      metric: `${teacherUploadedHomeworks.length} Assigned · File Submissions`,
      icon: ClipboardList,
    },
  ];

  const handleExamSubmit = async (exam: OnlineExamRecord) => {
    let questions: OnlineExamQuestion[] = [];
    try {
      questions = JSON.parse(exam.questionsJson);
    } catch {
      questions = [];
    }
    let score = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        score += 1;
      }
    });

    try {
      await apiFetch('/api/v1/online-exams/submit', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          examId: exam.id,
          studentId: student?.id || 1,
          score,
          totalQuestions: questions.length,
        }),
      });
      setExamResultMsg(
        `Exam Submitted! Your Score: ${score} / ${questions.length} (${Math.round((score / Math.max(1, questions.length)) * 100)}%)`
      );
      setActiveExamId(null);
      await onRefresh();
    } catch (err: any) {
      setExamResultMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Portal Overview: Daily Attendance Rate Progress Bar & Responsive Dashboard Cards Grid */}
      <section
        aria-label="Student Portal Overview"
        data-testid="student-portal-overview"
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5"
      >
        {/* Top Row: Overview Header + Daily Attendance Rate Progress Bar + Active Student Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center border-b border-slate-200 pb-4">
          <div className="lg:col-span-4 flex items-center justify-between lg:justify-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Student Portal Overview
                </h2>
                <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                  {student?.gradeLevel || 'Grade 10'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Select any academic card below to open your modules
              </p>
            </div>
          </div>

          {/* Visual Daily Attendance Rate Progress Bar Component */}
          <div
            data-testid="student-overview-attendance-card"
            className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5 min-w-0"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                Daily Attendance Rate
              </span>
              <span className="font-mono font-bold text-emerald-700 tabular-nums">
                {attendanceProgress.clampedPercent}% ({attendanceProgress.presentDays} Present / {attendanceProgress.totalRecordedDays} Days)
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Student Daily Attendance Rate"
              aria-valuenow={attendanceProgress.clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="student-attendance-progress-bar"
              className="w-full h-2.5 bg-white border border-slate-200 rounded-full overflow-hidden flex"
            >
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${attendanceProgress.clampedPercent}%` }}
              />
            </div>
          </div>

          {/* Active Student Selector (Admin / Staff Preview) */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row sm:items-center lg:justify-end gap-2 min-w-0">
            {loggedInAccount?.role !== 'STUDENT' && (
              <>
                <label htmlFor="preview-student-select" className="text-xs font-medium text-slate-600 shrink-0">
                  Active Student:
                </label>
                <select
                  id="preview-student-select"
                  value={student?.id || ''}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                  className="w-full sm:max-w-[260px] min-w-0 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-medium truncate"
                >
                  {workspace.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} · {s.firstName} {s.fatherName} ({s.gradeLevel})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Modern Responsive 8-Card Home Grid (1. Student Profile through 8. Homework) */}
        <nav
          aria-label="Student dashboard sections"
          data-testid="student-dashboard-cards-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {DASHBOARD_MODULE_CARDS.map((card) => {
            const Icon = card.icon;
            const active = activeSubTab === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveSubTab(card.id)}
                className={`text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50/70 text-slate-800 border-slate-200 hover:bg-white hover:border-slate-400'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{card.labelEn}</div>
                  <div
                    className={`text-[11px] font-mono mt-1 truncate ${
                      active ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    {card.metric}
                  </div>
                </div>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? 'bg-white/15 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </nav>
      </section>

      {/* SECTION 1: STUDENT PROFILE */}
      {activeSubTab === 'profile' && student && (
        <StudentProfileCard
          student={student}
          studentAccount={studentAccount}
          school={workspace.school}
          lang={lang}
          calendarMode={calendarMode}
        />
      )}

      {/* SECTION 2: EBOOK LIBRARY (RESPONSIVE CARD GRID + READER CARD) */}
      {activeSubTab === 'ebook' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                2. EBook Library
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {workspace.ebooks.length} Digital Textbooks
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workspace.ebooks.map((eb) => (
                <button
                  key={eb.id}
                  type="button"
                  onClick={() => setSelectedEbookId(eb.id)}
                  className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                    currentEbook?.id === eb.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{eb.code} · {eb.subjectCode}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold">
                        {eb.gradeLevel}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-2">{eb.titleEn}</div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{eb.summary}</p>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
                    Author: {eb.author}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {currentEbook && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-slate-600 uppercase tracking-wider">
                    {currentEbook.code} · {currentEbook.gradeLevel}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{currentEbook.titleEn}</h3>
                </div>
                <span className="text-xs text-slate-500">Author: {currentEbook.author}</span>
              </div>
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                {currentEbook.contentBody}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: GRADES & REPORT (RESPONSIVE CARD GRID + END-OF-YEAR 100% PASS/FAIL STANDING) */}
      {activeSubTab === 'grade' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Grades & Report — Official Academic Report Card (Out of 100%)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Teacher-recorded marks out of 100%: End-of-year overall score &lt; 50% is Not Promoted (Failed) · ≥ 50% is Promoted (Passed)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <div className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold">
                Overall: {averageScore}% / 100%
              </div>
              <span
                data-testid="annual-pass-fail-badge"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-extrabold tracking-wide ${
                  annualStanding.statusCode === 'PASSED'
                    ? 'bg-emerald-600 text-white'
                    : annualStanding.statusCode === 'FAILED'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-200 text-slate-800'
                }`}
              >
                {annualStanding.statusLabelEn}
              </span>
            </div>
          </div>

          {/* End-of-Year Overall Standing Summary Card (Out of 100% with 50% Pass Threshold) */}
          <div
            data-testid="annual-standing-summary"
            className={`p-5 rounded-xl border space-y-3 ${
              annualStanding.statusCode === 'PASSED'
                ? 'bg-emerald-50/70 border-emerald-200'
                : annualStanding.statusCode === 'FAILED'
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  End-of-Year Cumulative Evaluation (Calculated Out of 100%)
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Rule: Below 50% (&lt; 50%) = Failed (Not Promoted) · 50% and Above (≥ 50%) = Passed (Promoted)
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-lg font-extrabold text-slate-900">
                  {annualStanding.overallPercentage}% / 100%
                </div>
                <div className="text-[11px] text-slate-600">
                  {annualStanding.totalPointsEarned} / {annualStanding.maxPossiblePoints} Total Points ({annualStanding.subjectCount} Subject{annualStanding.subjectCount === 1 ? '' : 's'})
                </div>
              </div>
            </div>

            {/* Visual 0-100% Score Bar with 50% Promotion Threshold Marker */}
            <div className="relative pt-1">
              <div className="w-full h-3 bg-white border border-slate-300 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    annualStanding.passed ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, annualStanding.overallPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mt-1">
                <span>0%</span>
                <span className="font-bold text-slate-900">50% Pass Threshold</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {studentMarks.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              No published marks recorded yet for this student.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Official Results Table with Visual Pass/Fail Status Badge (50% Threshold) */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table
                  data-testid="student-results-table"
                  className="w-full text-left border-collapse text-xs"
                >
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-right">Continuous (30)</th>
                      <th className="py-3 px-4 text-right">Midterm (20)</th>
                      <th className="py-3 px-4 text-right">Final (50)</th>
                      <th className="py-3 px-4 text-right">Calculated Final Grade &amp; Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {studentMarks.map((m) => {
                      const badge = getGradePassFailBadge(m.totalMark);
                      return (
                        <tr key={`row-${m.id}`} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                            {m.subjectCode}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {m.subjectNameEn}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {m.continuousMark}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {m.midtermMark}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {m.finalMark}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <div className="inline-flex items-center justify-end gap-2">
                              <span className="font-bold text-slate-900">
                                {m.totalMark}% ({m.gradeLetter})
                              </span>
                              <span
                                data-testid="student-grade-pass-fail-badge"
                                className={`px-2.5 py-0.5 rounded font-mono text-[11px] font-bold border ${
                                  badge.passed
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-red-100 text-red-900 border-red-300'
                                }`}
                              >
                                {badge.badgeLabel}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const finalBadge = getGradePassFailBadge(annualStanding.overallPercentage);
                      return (
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-mono">
                          <td colSpan={5} className="py-3 px-4 font-sans font-bold text-slate-900">
                            Calculated Final Overall Average (Out of 100% · 50% Threshold)
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <div className="inline-flex items-center justify-end gap-2">
                              <span className="font-extrabold text-slate-900">
                                {annualStanding.overallPercentage}% / 100%
                              </span>
                              <span
                                data-testid="student-overall-pass-fail-badge"
                                className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold border ${
                                  finalBadge.passed
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-red-600 text-white border-red-700'
                                }`}
                              >
                                {finalBadge.badgeLabel}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentMarks.map((m) => {
                  const totalNum = Math.min(100, Math.max(0, Number(m.totalMark) || 0));
                  const badge = getGradePassFailBadge(totalNum);
                  return (
                    <article
                      key={m.id}
                      className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{m.subjectNameEn}</h3>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">
                            {m.subjectCode} · {m.term} · {m.academicYear}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold border ${
                              badge.passed
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-red-100 text-red-900 border-red-300'
                            }`}
                          >
                            {badge.badgeLabel}
                          </span>
                          <span className="px-3 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-extrabold">
                            Grade {m.gradeLetter}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-white border border-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            badge.passed ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${totalNum}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-1 text-xs font-mono tabular-nums">
                        <div className="p-2 bg-white border border-slate-200 rounded-lg">
                          <div className="text-[10px] text-slate-500">Cont (30)</div>
                          <div className="font-bold text-slate-900 mt-0.5">{m.continuousMark}</div>
                        </div>
                        <div className="p-2 bg-white border border-slate-200 rounded-lg">
                          <div className="text-[10px] text-slate-500">Mid (20)</div>
                          <div className="font-bold text-slate-900 mt-0.5">{m.midtermMark}</div>
                        </div>
                        <div className="p-2 bg-white border border-slate-200 rounded-lg">
                          <div className="text-[10px] text-slate-500">Final (50)</div>
                          <div className="font-bold text-slate-900 mt-0.5">{m.finalMark}</div>
                        </div>
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="text-[10px] text-emerald-900">Total (100)</div>
                          <div className="font-bold text-emerald-950 mt-0.5">{m.totalMark}%</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: EXAM (AUTO-HIDES WHEN TEACHER-ASSIGNED MINUTES EXPIRE) */}
      {activeSubTab === 'exam_space' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  4. Exam — Active Teacher-Posted Assessments
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Exams are visible only during the minutes allotted by the teacher and automatically disappear once time expires.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums self-start sm:self-auto">
                Active Exams: <strong className="text-slate-900">{activeTeacherExams.length}</strong>
              </span>
            </div>

            {examResultMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-950">
                {examResultMsg}
              </div>
            )}

            {activeTeacherExams.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800">
                  No Active Exams Right Now
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Any exam whose teacher-assigned minutes have elapsed is automatically hidden from student view.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeTeacherExams.map((ex) => {
                  let parsedQuestions: OnlineExamQuestion[] = [];
                  try {
                    parsedQuestions = JSON.parse(ex.questionsJson);
                  } catch {
                    parsedQuestions = [];
                  }
                  const remainingSecs = calculateOnlineExamRemainingSeconds(
                    ex.createdAt,
                    ex.durationMinutes,
                    nowMs
                  );
                  const prevSub = studentSubmissions.find((s) => s.examId === ex.id);
                  return (
                    <article
                      key={ex.id}
                      className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 bg-slate-50/60"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-semibold text-slate-700">{ex.subjectCode}</span>
                          <span className="text-amber-800 font-bold tabular-nums">
                            {formatExamCountdown(remainingSecs)} left ({ex.durationMinutes}m)
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 mt-2">{ex.title}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {ex.gradeLevel} · {parsedQuestions.length} Question(s) · {ex.postedBy}
                        </p>
                        {prevSub && (
                          <div className="mt-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-semibold text-emerald-900">
                            Submitted Score: {prevSub.score} / {prevSub.totalQuestions}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExamId(ex.id);
                          setSelectedAnswers({});
                          setExamResultMsg(null);
                        }}
                        className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800"
                      >
                        Start Exam
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {activeExamId && (() => {
              const currentExam = activeTeacherExams.find((e) => e.id === activeExamId);
              if (!currentExam) return null;
              const remainingSecs = calculateOnlineExamRemainingSeconds(
                currentExam.createdAt,
                currentExam.durationMinutes,
                nowMs
              );
              let questions: OnlineExamQuestion[] = [];
              try {
                questions = JSON.parse(currentExam.questionsJson);
              } catch {
                questions = [];
              }
              return (
                <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{currentExam.title}</h3>
                    <span className="text-xs font-mono font-bold text-amber-800 tabular-nums">
                      Time Remaining: {formatExamCountdown(remainingSecs)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questions.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="text-xs font-semibold text-slate-900">{q.question}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-2 p-2.5 rounded border text-xs cursor-pointer ${
                                selectedAnswers[qIdx] === oIdx
                                  ? 'border-slate-900 bg-white font-semibold'
                                  : 'border-slate-200 bg-white hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${qIdx}`}
                                checked={selectedAnswers[qIdx] === oIdx}
                                onChange={() =>
                                  setSelectedAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                                }
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveExamId(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExamSubmit(currentExam)}
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
                    >
                      Submit Exam Answers
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SECTION 5: SCHOOL ANNOUNCEMENTS (RESPONSIVE CARD GRID) */}
      {activeSubTab === 'announcements' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              5. School Announcements
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {workspace.announcements.length} Official Notice(s)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspace.announcements.map((ann) => (
              <article
                key={ann.id}
                className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900 text-sm">
                      {ann.titleEn}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 shrink-0">
                      {ann.priority} · {ann.audience}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{ann.bodyEn}</p>
                </div>
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  Published by: {ann.publishedBy}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6: TEACHERS & TIMETABLE (RESPONSIVE CARD GRIDS) */}
      {activeSubTab === 'teachers_timetable' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                6. Teachers & Timetable — Class Schedule & Subject Faculty
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assigned subject teachers and weekly period timetable for {student?.gradeLevel || 'Grade 10'} ({student?.sectionName || 'Section A'})
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {workspace.teachers.length} Faculty · {workspace.subjects.length} Subjects
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workspace.teachers.map((t) => (
              <article key={t.id} className="p-4 border border-slate-200 rounded-xl text-xs space-y-1.5 bg-slate-50/70">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{t.fullName}</span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {t.staffCode}
                  </span>
                </div>
                <div className="text-slate-800 font-medium">{t.assignedSubjects}</div>
                <div className="text-slate-500 pt-1 border-t border-slate-200">
                  Classes: {t.assignedGrades} · Dept: {t.department}
                </div>
              </article>
            ))}
          </div>

          {/* Weekly Class Period Timetable (Monday - Friday) */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Weekly Class Period Timetable (Monday – Friday)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  period: 'Period 1 (08:30 - 09:15)',
                  schedule: [
                    'Mon: Mathematics (MATH-10)',
                    'Tue: Physics (PHY-11)',
                    'Wed: English Literature (ENG-10)',
                    'Thu: Mathematics (MATH-10)',
                    'Fri: Chemistry (CHEM-11)',
                  ],
                },
                {
                  period: 'Period 2 (09:15 - 10:00)',
                  schedule: [
                    'Mon: English Literature (ENG-10)',
                    'Tue: Mathematics (MATH-10)',
                    'Wed: Physics (PHY-11)',
                    'Thu: Chemistry (CHEM-11)',
                    'Fri: Mathematics (MATH-10)',
                  ],
                },
                {
                  period: 'Period 3 (10:20 - 11:05)',
                  schedule: [
                    'Mon: Physics (PHY-11)',
                    'Tue: Chemistry (CHEM-11)',
                    'Wed: Mathematics (MATH-10)',
                    'Thu: English Literature (ENG-10)',
                    'Fri: Physics (PHY-11)',
                  ],
                },
              ].map((slot) => (
                <article
                  key={slot.period}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 text-xs"
                >
                  <div className="font-mono font-bold text-slate-900 border-b border-slate-200 pb-2">
                    {slot.period}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-slate-700">
                    {slot.schedule.map((line) => (
                      <div key={line} className="flex items-center justify-between">
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Curriculum Subjects & Assessment Weights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {workspace.subjects.map((sub) => (
                <article
                  key={sub.id}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{sub.code}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {sub.gradeLevel}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900">{sub.nameEn}</div>
                  <div className="text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-200">
                    {sub.periodsPerWeek} periods/wk · {sub.continuousWeight}%/{sub.midtermWeight}%/{sub.finalWeight}%
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: ATTENDANCE (PROGRESS BAR + RESPONSIVE CARD GRID) */}
      {activeSubTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                7. Attendance — Daily Attendance Rate & Recorded Days
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Official summary of days present, days absent, late arrivals, and daily attendance log cards.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800">
              Standing: {attendanceProgress.standingLabel}
            </span>
          </div>

          {/* Visual Attendance Progress Bar Card */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                Student Daily Attendance Rate
              </span>
              <span className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
                {attendanceProgress.clampedPercent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Attendance Tab Progress Bar"
              aria-valuenow={attendanceProgress.clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="attendance-tab-progress-bar"
              className="w-full h-3.5 bg-white border border-slate-200 rounded-full overflow-hidden flex"
            >
              <div
                className="h-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${attendanceProgress.clampedPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Days Present
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-950 mt-1">
                {attSummary.presentDays} Days
              </div>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                <XCircle className="w-4 h-4 text-red-700" />
                Days Absent
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-950 mt-1">
                {attSummary.absentDays} Days
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700" />
                Days Late
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-950 mt-1">
                {attSummary.lateDays} Days
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold text-slate-700">
                Attendance Rate
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {attSummary.attendanceRatePercent}%
              </div>
              <div className="text-[11px] text-slate-500">
                Total Recorded: {attSummary.totalRecordedDays} days
              </div>
            </div>
          </div>

          {/* Responsive Grid of Daily Attendance Log Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentAttendance.map((att) => (
              <article
                key={att.id}
                className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900">
                    {formatCalendarDate(att.attendanceDate, calendarMode, 'en')}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      att.status === 'PRESENT'
                        ? 'text-emerald-800'
                        : att.status === 'ABSENT'
                          ? 'text-red-800'
                          : 'text-amber-800'
                    }`}
                  >
                    {att.status}
                  </span>
                </div>
                <p className="text-slate-700">{att.remarks}</p>
                <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-200">
                  Recorded by: {att.recordedBy}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 8: HOMEWORK */}
      {activeSubTab === 'homework' && (
        <StudentHomeworkSection
          homeworks={teacherUploadedHomeworks}
          student={student}
          studentIdCode={studentIdCode}
          activeSchoolId={activeSchoolId}
          lang={lang}
          calendarMode={calendarMode}
          apiFetch={apiFetch}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};

// ============================================================================
// 4. DEDICATED TEACHER PORTAL VIEW
//    1) Students List  2) Exams & Homework Post Option  3) Attendance
// ============================================================================
export const DedicatedTeacherPortalView: React.FC<
  SharedViewProps & {
    loggedInAccount: PortalAccountRecord | null;
  }
> = ({ lang, calendarMode, activeSchoolId, workspace, onRefresh, apiFetch, loggedInAccount }) => {
  const [teacherTab, setTeacherTab] = useState<'students' | 'exams_post' | 'attendance'>('students');

  // Exam Post State
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState('');
  const [examSubject, setExamSubject] = useState('MATH-10');
  const [examGrade, setExamGrade] = useState('Grade 10');
  const [examDuration, setExamDuration] = useState(25);
  const [q1Text, setQ1Text] = useState('');
  const [q1Options, setQ1Options] = useState('Option A, Option B, Option C, Option D');
  const [q1Correct, setQ1Correct] = useState(0);

  // Homework Post State
  const [editingHomeworkId, setEditingHomeworkId] = useState<number | null>(null);
  const [hwTitle, setHwTitle] = useState('');
  const [hwSubject, setHwSubject] = useState('MATH-10');
  const [hwGrade, setHwGrade] = useState('Grade 10');
  const [hwDueDate, setHwDueDate] = useState('2026-11-02');
  const [hwInstructions, setHwInstructions] = useState('');

  // Attendance State
  const [attStudentId, setAttStudentId] = useState<number>(workspace.students[0]?.id || 1);
  const [attDate, setAttDate] = useState('2026-10-23');
  const [attStatus, setAttStatus] = useState('PRESENT');
  const [attRemarks, setAttRemarks] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Teacher 100% Grade Recording State (Continuous 30 + Midterm 20 + Final 50 = 100%)
  const [gradeStudentId, setGradeStudentId] = useState<number>(workspace.students[0]?.id || 1);
  const [gradeSubjectCode, setGradeSubjectCode] = useState<string>('MATH-10');
  const [gradeContinuous, setGradeContinuous] = useState<string>('27');
  const [gradeMidterm, setGradeMidterm] = useState<string>('18');
  const [gradeFinal, setGradeFinal] = useState<string>('44');

  const handleSaveTeacherStudentMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      const calc = calculateAssessmentResult({
        continuousMark: Number(gradeContinuous),
        midtermMark: Number(gradeMidterm),
        finalMark: Number(gradeFinal),
      });
      const subjObj = workspace.subjects.find((s) => s.code === gradeSubjectCode);
      const subjName = subjObj?.nameEn || gradeSubjectCode;
      await apiFetch('/api/v1/examinations/marks', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          studentId: gradeStudentId,
          subjectCode: gradeSubjectCode,
          subjectNameEn: subjName,
          subjectNameAm: subjName,
          academicYear: '2019 E.C.',
          term: 'Term 1',
          continuousMark: Number(gradeContinuous),
          midtermMark: Number(gradeMidterm),
          finalMark: Number(gradeFinal),
          status: 'PUBLISHED',
        }),
      });
      const passFailLabel =
        calc.percentage >= 50 ? 'PASSED (≥ 50%)' : 'FAILED (< 50%)';
      setStatusBanner(
        `Saved ${subjName} score: ${calc.totalMark}% / 100% — End-of-Year Standing: ${passFailLabel}`
      );
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  const handlePostOnlineExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    const opts = q1Options
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const questionsPayload: OnlineExamQuestion[] = [
      {
        question: q1Text || '1. Sample Curriculum Question',
        options: opts.length >= 2 ? opts : ['True', 'False'],
        correctIndex: Number(q1Correct) || 0,
      },
    ];
    try {
      await apiFetch('/api/v1/online-exams', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          examId: editingExamId ?? undefined,
          title: examTitle,
          subjectCode: examSubject,
          gradeLevel: examGrade,
          durationMinutes: examDuration,
          questionsJson: JSON.stringify(questionsPayload),
        }),
      });
      setStatusBanner(
        editingExamId
          ? 'Online exam updated in Student Exam Space!'
          : 'Online exam published to Student Exam Space!'
      );
      setEditingExamId(null);
      setExamTitle('');
      setQ1Text('');
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  const handleDeleteOnlineExam = async (examId: number) => {
    setStatusBanner(null);
    try {
      await apiFetch(`/api/v1/online-exams/${examId}?schoolId=${activeSchoolId}`, {
        method: 'DELETE',
      });
      if (editingExamId === examId) {
        setEditingExamId(null);
        setExamTitle('');
      }
      setStatusBanner('Online exam deleted.');
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  const handlePostHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      await apiFetch('/api/v1/homeworks', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          homeworkId: editingHomeworkId ?? undefined,
          title: hwTitle,
          subjectCode: hwSubject,
          gradeLevel: hwGrade,
          sectionName: 'Section A',
          dueDate: hwDueDate,
          instructions: hwInstructions,
        }),
      });
      setStatusBanner(
        editingHomeworkId
          ? 'Homework assignment updated!'
          : 'Homework assignment posted to Student Portal!'
      );
      setEditingHomeworkId(null);
      setHwTitle('');
      setHwInstructions('');
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  const handleDeleteHomework = async (homeworkId: number) => {
    setStatusBanner(null);
    try {
      await apiFetch(`/api/v1/homeworks/${homeworkId}?schoolId=${activeSchoolId}`, {
        method: 'DELETE',
      });
      if (editingHomeworkId === homeworkId) {
        setEditingHomeworkId(null);
        setHwTitle('');
        setHwInstructions('');
      }
      setStatusBanner('Homework assignment deleted.');
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);
    try {
      await apiFetch('/api/v1/attendance', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          studentId: attStudentId,
          attendanceDate: attDate,
          status: attStatus,
          remarks: attRemarks,
        }),
      });
      setStatusBanner('Student attendance recorded and synced with Student Portal!');
      setAttRemarks('');
      await onRefresh();
    } catch (err: any) {
      setStatusBanner(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Teacher Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-900 text-white rounded">
            {loggedInAccount?.accessCode || 'TEA-739201'}
          </span>
          <h1 className="text-lg font-bold text-slate-900 mt-1">
            {loggedInAccount?.fullName || 'Memhir Solomon Bekele'} — Teacher Workspace
          </h1>
          <p className="text-xs text-slate-600">
            1. Students List · 2. Exams & Homework Post Option · 3. Daily Attendance
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTeacherTab('students')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md ${
              teacherTab === 'students'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            1. Students List ({workspace.students.length})
          </button>
          <button
            type="button"
            onClick={() => setTeacherTab('exams_post')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md ${
              teacherTab === 'exams_post'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            2. Exams Post Option
          </button>
          <button
            type="button"
            onClick={() => setTeacherTab('attendance')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md ${
              teacherTab === 'attendance'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            3. Attendance
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-950">
          {statusBanner}
        </div>
      )}

      {/* 1. STUDENTS LIST & TEACHER 100% GRADE ENTRY + END-OF-YEAR 50% PASS/FAIL EVALUATION */}
      {teacherTab === 'students' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Assigned Students List & End-of-Year Standing (Out of 100%)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Teacher-recorded subject marks are calculated out of 100%: End-of-Year Average &lt; 50% = Failed (Not Promoted) · ≥ 50% = Passed (Promoted)
                </p>
              </div>
              <span className="px-3 py-1 rounded bg-slate-900 text-white font-mono text-xs font-bold self-start sm:self-auto">
                Pass Threshold: 50% / 100%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2.5 px-3">Student Login Code</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Grade & Section</th>
                    <th className="py-2.5 px-3">Present / Absent</th>
                    <th className="py-2.5 px-3">Teacher-Recorded Score (Out of 100%)</th>
                    <th className="py-2.5 px-3">End-of-Year Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {workspace.students.map((st) => {
                    const stAtt = calculateStudentAttendanceSummary(
                      workspace.attendance.filter((a) => a.studentId === st.id)
                    );
                    const stMarks = workspace.marks.filter((m) => m.studentId === st.id);
                    const stStanding = calculateAnnualStudentStanding(stMarks);
                    return (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {st.studentCode}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">
                            {st.firstName} {st.fatherName} {st.grandfatherName}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {st.gradeLevel} · {st.sectionName}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-emerald-800 font-semibold">
                            Present: {stAtt.presentDays}
                          </span>{' '}
                          ·{' '}
                          <span className="text-red-700 font-semibold">
                            Absent: {stAtt.absentDays}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                          {stStanding.subjectCount > 0
                            ? `${stStanding.overallPercentage}% / 100% (${stStanding.subjectCount} Subj)`
                            : 'No Marks Recorded'}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span
                            className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                              stStanding.statusCode === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : stStanding.statusCode === 'FAILED'
                                  ? 'bg-red-100 text-red-900 border border-red-300'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {stStanding.statusLabelEn}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teacher 100% Student Score Entry & End-of-Year 50% Pass/Fail Evaluator */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Record Student Score Out of 100% (End-of-Year ≥ 50% Pass / &lt; 50% Fail)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Continuous (30%) + Midterm (20%) + Final Exam (50%) = 100%. Below 50% = Failed (Not Promoted) · 50% and Above = Passed (Promoted).
                </p>
              </div>
            </div>
            <form
              onSubmit={handleSaveTeacherStudentMark}
              className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs items-end"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Student</label>
                <select
                  value={gradeStudentId}
                  onChange={(e) => setGradeStudentId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  {workspace.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentCode} · {s.firstName} {s.fatherName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject</label>
                <select
                  value={gradeSubjectCode}
                  onChange={(e) => setGradeSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                >
                  {workspace.subjects.map((sub) => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code} · {sub.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Continuous (30)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  step="0.5"
                  value={gradeContinuous}
                  onChange={(e) => setGradeContinuous(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Midterm (20)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step="0.5"
                  value={gradeMidterm}
                  onChange={(e) => setGradeMidterm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Final (50)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step="0.5"
                  value={gradeFinal}
                  onChange={(e) => setGradeFinal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
                >
                  Save 100% Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EXAMS POST OPTION & HOMEWORK POST */}
      {teacherTab === 'exams_post' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Post Interactive Online Exam to Student Exam Space
            </h2>
            <form onSubmit={handlePostOnlineExam} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Exam Title *</label>
                <input
                  type="text"
                  required
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. Grade 10 Trigonometry Quiz #2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={examSubject}
                    onChange={(e) => setExamSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Grade Level</label>
                  <select
                    value={examGrade}
                    onChange={(e) => setExamGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Question Prompt *</label>
                <input
                  type="text"
                  required
                  value={q1Text}
                  onChange={(e) => setQ1Text(e.target.value)}
                  placeholder="e.g. What is sin(30°) + cos(60°)?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Multiple Choice Options (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={q1Options}
                  onChange={(e) => setQ1Options(e.target.value)}
                  placeholder="0.5, 1, 1.5, 2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Correct Option Index (0 = 1st, 1 = 2nd, 2 = 3rd, 3 = 4th)
                </label>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={q1Correct}
                  onChange={(e) => setQ1Correct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                {editingExamId ? 'Update Online Exam' : 'Publish Exam to Student Exam Space'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Posted Online Exams ({workspace.onlineExams.length})
              </div>
              {workspace.onlineExams.map((ex) => (
                <div
                  key={ex.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs gap-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{ex.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {ex.subjectCode} · {ex.gradeLevel} · {ex.durationMinutes}m
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExamId(ex.id);
                        setExamTitle(ex.title);
                        setExamSubject(ex.subjectCode);
                        setExamGrade(ex.gradeLevel);
                        setExamDuration(ex.durationMinutes);
                      }}
                      className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded flex items-center gap-1 hover:bg-slate-100"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOnlineExam(ex.id)}
                      className="px-2 py-1 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded flex items-center gap-1 hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Post Homework Assignment
            </h2>
            <form onSubmit={handlePostHomework} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Homework Title *</label>
                <input
                  type="text"
                  required
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  placeholder="e.g. Chapter 3 Review Questions"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={hwSubject}
                    onChange={(e) => setHwSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Grade</label>
                  <select
                    value={hwGrade}
                    onChange={(e) => setHwGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={hwDueDate}
                    onChange={(e) => setHwDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Instructions *</label>
                <textarea
                  rows={3}
                  required
                  value={hwInstructions}
                  onChange={(e) => setHwInstructions(e.target.value)}
                  placeholder="Detailed instructions for students..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                {editingHomeworkId ? 'Update Homework Assignment' : 'Post Homework to Student Portal'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-700">
                Posted Homeworks ({workspace.homeworks.length})
              </div>
              {workspace.homeworks.map((hw) => (
                <div
                  key={hw.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs gap-2"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{hw.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {hw.subjectCode} · {hw.gradeLevel} · Due: {hw.dueDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHomeworkId(hw.id);
                        setHwTitle(hw.title);
                        setHwSubject(hw.subjectCode);
                        setHwGrade(hw.gradeLevel);
                        setHwDueDate(hw.dueDate);
                        setHwInstructions(hw.instructions);
                      }}
                      className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded flex items-center gap-1 hover:bg-slate-100"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHomework(hw.id)}
                      className="px-2 py-1 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded flex items-center gap-1 hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. ATTENDANCE */}
      {teacherTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900">
            3. Record & Update Daily Student Attendance
          </h2>
          <form onSubmit={handleSaveAttendance} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Student</label>
              <select
                value={attStudentId}
                onChange={(e) => setAttStudentId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {workspace.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentCode} · {s.firstName} {s.fatherName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status</label>
              <select
                value={attStatus}
                onChange={(e) => setAttStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white font-semibold"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="LATE">LATE</option>
                <option value="EXCUSED">EXCUSED</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Remarks</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={attRemarks}
                  onChange={(e) => setAttRemarks(e.target.value)}
                  placeholder="Optional note"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 whitespace-nowrap"
                >
                  Save
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Student</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workspace.attendance.map((a) => {
                  const st = workspace.students.find((s) => s.id === a.studentId);
                  return (
                    <tr key={a.id}>
                      <td className="py-2 px-3">{formatCalendarDate(a.attendanceDate, calendarMode, lang)}</td>
                      <td className="py-2 px-3 font-medium">
                        {st ? `${st.studentCode} · ${st.firstName} ${st.fatherName}` : `Student #${a.studentId}`}
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold">{a.status}</td>
                      <td className="py-2 px-3 text-slate-600">{a.remarks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
