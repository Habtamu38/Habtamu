import React, { useEffect, useMemo, useState } from 'react';
import {
  EBookRecord,
  OnlineExamQuestion,
  OnlineExamRecord,
  PortalAccountRecord,
  SharedViewProps,
} from '../types/esms';
import {
  buildStudentAttendanceProgressModel,
  buildStudentProfileSummary,
  calculateAnnualStudentStanding,
  calculateOnlineExamRemainingSeconds,
  calculateStudentAttendanceSummary,
  filterStudentPortalQuickAccessCards,
  formatCalendarDate,
  formatExamCountdown,
  getGradePassFailBadge,
  isOnlineExamActiveForStudent,
  SCHOOL_PAYMENT_ACCOUNTS,
  STUDENT_PORTAL_BOTTOM_NAV,
  STUDENT_PORTAL_QUICK_ACCESS_CARDS,
  STUDENT_PORTAL_THEME,
  StudentPortalBottomNavId,
  StudentPortalFeatureId,
} from '../utils/ethiopianRules';
import { StudentProfileCard } from './StudentProfileCard';
import { StudentHomeworkSection } from './StudentHomeworkSection';
import {
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Grid,
  Home,
  Image as ImageIcon,
  Megaphone,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

export interface StudentPortalDashboardProps extends SharedViewProps {
  loggedInAccount: PortalAccountRecord | null;
}

interface SupportChatMessage {
  id: string;
  sender: 'student' | 'advisor';
  senderName: string;
  department: string;
  text: string;
  timestamp: string;
}

const ETHIOPIAN_SCHOOL_EVENTS = [
  {
    id: 'evt-1',
    titleEn: 'Meskerem Academic Year Opening Assembly',
    titleAm: 'የመስከረም የትምህርት ዘመን መክፈቻ ስነ-ስርዓት',
    dateIso: '2026-09-14',
    ethiopianDate: 'Meskerem 4, 2019 E.C.',
    category: 'Academic Ceremony',
    location: 'Main Campus Amphitheater',
    descriptionEn:
      'Official welcome assembly for Grades 9–12 students, homeroom orientation, and distribution of the 2019 E.C. academic calendar.',
    descriptionAm: 'የ2019 ዓ.ም የትምህርት ዘመን አዲስ እና ነባር ተማሪዎች አቀባበል እና የክፍል ድልድል መርሃ ግብር።',
    pastelBg: '#F0EBFF',
    accentColor: '#673AB7',
  },
  {
    id: 'evt-2',
    titleEn: 'Annual Science, STEM & Robotics Exhibition',
    titleAm: 'ዓመታዊ የሳይንስ፣ ቴክኖሎጂ እና ፈጠራ አውደ ርዕይ',
    dateIso: '2026-11-18',
    ethiopianDate: 'Hidar 9, 2019 E.C.',
    category: 'STEM & Innovation',
    location: 'Science & ICT Complex',
    descriptionEn:
      'Student-led physics, chemistry, biology, and software engineering projects evaluated by faculty and guest scientists.',
    descriptionAm: 'በተማሪዎች የተሰሩ የሳይንስ፣ የቴክኖሎጂ እና የፈጠራ ስራዎች የሚቀርቡበት ዓመታዊ ውድድር።',
    pastelBg: '#EAF3FF',
    accentColor: '#304FC7',
  },
  {
    id: 'evt-3',
    titleEn: 'First Semester Parent-Teacher Academic Review',
    titleAm: 'የአንደኛ ወሰነ ትምህርት የወላጅ እና መምህራን ውይይት',
    dateIso: '2026-12-12',
    ethiopianDate: 'Tahsas 3, 2019 E.C.',
    category: 'Parent Engagement',
    location: 'School Multipurpose Hall',
    descriptionEn:
      'Review of continuous assessment marks, attendance standing, and national exam preparation strategies.',
    descriptionAm: 'የተማሪዎችን የክፍል ክትትል እና የፈተና ውጤት አስመልክቶ ከወላጆች ጋር የሚደረግ ምክክር።',
    pastelBg: '#E7F8F0',
    accentColor: '#15803D',
  },
  {
    id: 'evt-4',
    titleEn: 'Adwa Victory Heritage & Literary Symposium',
    titleAm: 'የዓድዋ ድል መታሰቢያ የስነ-ጽሑፍ እና ታሪክ ቀን',
    dateIso: '2027-03-02',
    ethiopianDate: 'Yekatit 23, 2019 E.C.',
    category: 'Cultural & Heritage',
    location: 'Cultural Center Courtyard',
    descriptionEn:
      'Historical symposium, poetry recital in Amharic and English, and drama presentations honoring Ethiopian heritage.',
    descriptionAm: 'የዓድዋ ድል በዓልን ምክንያት በማድረግ በተማሪዎች የሚቀርብ የግጥም፣ ድራማ እና የታሪክ ውይይት።',
    pastelBg: '#FFF6D9',
    accentColor: '#B45309',
  },
  {
    id: 'evt-5',
    titleEn: 'Inter-Grade Athletics & Football Championship',
    titleAm: 'የክፍሎች መካከል የአትሌቲክስ እና እግር ኳስ ውድድር',
    dateIso: '2027-04-15',
    ethiopianDate: 'Miazia 7, 2019 E.C.',
    category: 'Sports & Athletics',
    location: 'Bole Campus Track & Field',
    descriptionEn:
      'Track relays, 1500m distance run, and inter-section football and basketball finals.',
    descriptionAm: 'በክፍሎች መካከል የሚካሄድ የሩጫ፣ የእግር ኳስ እና የቅርጫት ኳስ የዋንጫ ውድድር።',
    pastelBg: '#FCEAF2',
    accentColor: '#BE185D',
  },
] as const;

const STUDENT_GALLERY_ITEMS = [
  {
    id: 'gal-1',
    titleEn: 'Grade 10 & 11 Chemistry Titration Lab',
    titleAm: 'የ10ኛ እና 11ኛ ክፍል የኬሚስትሪ ቤተ-ሙከራ ልምምድ',
    category: 'STEM Labs',
    dateLabel: 'Tikimt 2019 E.C.',
    captionEn: 'Students conducting acid-base titration and molarity experiments in Laboratory B.',
    pastelBg: '#EAF3FF',
    accentColor: '#304FC7',
  },
  {
    id: 'gal-2',
    titleEn: 'Digital Library & Coding Club Workshop',
    titleAm: 'የዲጂታል ላይብረሪ እና የኮዲንግ ክለብ ስልጠና',
    category: 'Digital & ICT',
    dateLabel: 'Hidar 2019 E.C.',
    captionEn: 'Secondary students practicing web development and accessing MoE digital textbooks.',
    pastelBg: '#F0EBFF',
    accentColor: '#673AB7',
  },
  {
    id: 'gal-3',
    titleEn: 'Ethiopian Nations & Cultural Heritage Day',
    titleAm: 'የባህል እና የቋንቋ ቀን አከባበር',
    category: 'Cultural Day',
    dateLabel: 'Tahsas 2019 E.C.',
    captionEn: 'Traditional attire showcase, coffee ceremony, and student choir performance.',
    pastelBg: '#FFF6D9',
    accentColor: '#B45309',
  },
  {
    id: 'gal-4',
    titleEn: 'Annual Track & Relay Finals',
    titleAm: 'ዓመታዊ የአትሌቲክስ ውድድር',
    category: 'Sports',
    dateLabel: 'Tir 2019 E.C.',
    captionEn: 'Grade 10 Section A and Section B relay teams competing on the campus track.',
    pastelBg: '#E7F8F0',
    accentColor: '#15803D',
  },
  {
    id: 'gal-5',
    titleEn: 'Physics Optics & Circuitry Demonstration',
    titleAm: 'የፊዚክስ ኤሌክትሪክ እና ብርሃን ሙከራ',
    category: 'STEM Labs',
    dateLabel: 'Yekatit 2019 E.C.',
    captionEn: 'Hands-on parallel circuit boards and prism refraction measurements.',
    pastelBg: '#FFF0E5',
    accentColor: '#C2410C',
  },
  {
    id: 'gal-6',
    titleEn: 'Environmental Green Legacy Campus Planting',
    titleAm: 'የአረንጓዴ አሻራ የችግኝ ተከላ መርሃ ግብር',
    category: 'Community',
    dateLabel: 'Meskerem 2019 E.C.',
    captionEn: 'Students and faculty planting indigenous trees across the school perimeter.',
    pastelBg: '#FCEAF2',
    accentColor: '#BE185D',
  },
] as const;

const ETHIOPIAN_ACADEMIC_CALENDAR_MILESTONES = [
  {
    monthEc: 'Meskerem 2019 E.C.',
    monthGc: 'September 2026',
    eventEn: 'First Semester Classes Begin & Student Registration Finalized',
    eventAm: 'የ1ኛ ወሰነ ትምህርት መጀመሪያ እና የተማሪዎች ምዝገባ ማጠቃለያ',
    type: 'Term Start',
    pastelBg: '#F0EBFF',
  },
  {
    monthEc: 'Tikimt 2019 E.C.',
    monthGc: 'October / November 2026',
    eventEn: 'Continuous Assessment Round 1 & Club Enrollment',
    eventAm: 'የ1ኛ ዙር ተከታታይ ምዘና እና የክበባት ምዝገባ',
    type: 'Assessment',
    pastelBg: '#EAF3FF',
  },
  {
    monthEc: 'Hidar 2019 E.C.',
    monthGc: 'November 2026',
    eventEn: 'First Semester Midterm Examinations (20% Weight)',
    eventAm: 'የ1ኛ ወሰነ ትምህርት አጋማሽ ፈተና (ከ20%)',
    type: 'Midterm Exam',
    pastelBg: '#FFF6D9',
  },
  {
    monthEc: 'Tahsas / Tir 2019 E.C.',
    monthGc: 'January 2027',
    eventEn: 'First Semester Final Examinations (50% Weight) & Report Cards',
    eventAm: 'የ1ኛ ወሰነ ትምህርት ማጠቃለያ ፈተና (ከ50%) እና የውጤት ካርድ',
    type: 'Final Exam',
    pastelBg: '#FCEAF2',
  },
  {
    monthEc: 'Yekatit 2019 E.C.',
    monthGc: 'February 2027',
    eventEn: 'Second Semester Classes Commence',
    eventAm: 'የ2ኛ ወሰነ ትምህርት ክፍለ ጊዜ መጀመሪያ',
    type: 'Term Start',
    pastelBg: '#E7F8F0',
  },
  {
    monthEc: 'Sene 2019 E.C.',
    monthGc: 'June 2027',
    eventEn: 'Annual Final Examinations & Grade Promotion (≥ 50% Pass Threshold)',
    eventAm: 'ዓመታዊ ማጠቃለያ ፈተና እና ወደ ቀጣይ ክፍል ዝውውር (≥ 50% ማለፊያ)',
    type: 'Annual Promotion',
    pastelBg: '#FFF0E5',
  },
] as const;

export const StudentPortalDashboard: React.FC<StudentPortalDashboardProps> = ({
  lang,
  calendarMode,
  activeSchoolId,
  workspace,
  onRefresh,
  apiFetch,
  loggedInAccount,
}) => {
  const defaultStu =
    workspace.students.find((s) => s.studentCode === 'STU-482910') ||
    workspace.students[workspace.students.length - 1] ||
    workspace.students[0];

  const [selectedStudentId, setSelectedStudentId] = useState<number>(
    loggedInAccount?.linkedStudentId || defaultStu?.id || 1
  );
  const [activeSubTab, setActiveSubTab] = useState<StudentPortalFeatureId>('profile');
  const [bottomNav, setBottomNav] = useState<StudentPortalBottomNavId>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEbookId, setSelectedEbookId] = useState<number | null>(null);
  const [galleryCategory, setGalleryCategory] = useState<string>('ALL');
  const [rsvpEvents, setRsvpEvents] = useState<Record<string, boolean>>({});

  // Chat & Support State
  const [chatAdvisorDept, setChatAdvisorDept] = useState<string>('Academic Advisor');
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<SupportChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'advisor',
      senderName:
        lang === 'am' ? 'የትምህርት አማካሪ ቢሮ (ESMS Support)' : 'ESMS Academic Support Desk',
      department: 'Academic Advisor',
      text:
        lang === 'am'
          ? 'ሰላም! ስለ ክፍል ፕሮግራም፣ የፈተና ውጤት፣ የቤት ስራ ወይም የትምህርት ቤት ክፍያ ማንኛውም ጥያቄ ካለዎት እዚህ ይጻፉልን።'
          : 'Welcome to ESMS Student Support! Ask any question regarding your timetable, exam grades, homework submissions, or school fees.',
      timestamp: '08:30 EAT',
    },
  ]);

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
  const studentInvoices = workspace.invoices.filter((inv) => inv.studentId === student?.id);
  const studentPayments = workspace.payments.filter((pay) => pay.studentId === student?.id);

  const studentAccount = workspace.portalAccounts.find(
    (p) =>
      (p.linkedStudentId === student?.id || p.accessCode === student?.studentCode) &&
      p.role === 'STUDENT'
  );

  const studentIdCode = studentAccount?.accessCode || student?.studentCode || 'STU-482910';

  const profileSummary = buildStudentProfileSummary({
    student: student || {
      firstName: loggedInAccount?.fullName?.split(' ')[0] || 'Student',
      fatherName: loggedInAccount?.fullName?.split(' ')[1] || 'Portal',
      grandfatherName: loggedInAccount?.fullName?.split(' ')[2] || '',
      gradeLevel: 'Grade 10',
      sectionName: 'Section A',
      studentCode: studentIdCode,
      enrollmentStatus: 'ACTIVE',
    },
    studentAccount,
    school: workspace.school,
  });

  // Filter exams so ONLY teacher-posted exams for the student's grade level whose allotted durationMinutes have NOT expired are visible
  const activeTeacherExams = workspace.onlineExams.filter(
    (ex) =>
      isOnlineExamActiveForStudent(ex, nowMs) &&
      (!student?.gradeLevel || !ex.gradeLevel || ex.gradeLevel === student.gradeLevel)
  );

  // Filter homework to show ONLY teacher-uploaded assignments (memoized so 1s exam timer does not reset child state)
  const teacherUploadedHomeworks = useMemo(
    () =>
      workspace.homeworks.filter(
        (hw) => !student?.gradeLevel || !hw.gradeLevel || hw.gradeLevel === student.gradeLevel
      ),
    [workspace.homeworks, student?.gradeLevel]
  );

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

  const filteredQuickAccessCards = useMemo(
    () => filterStudentPortalQuickAccessCards(searchQuery),
    [searchQuery]
  );

  const iconForFeature = (id: StudentPortalFeatureId) => {
    switch (id) {
      case 'profile':
        return UserCheck;
      case 'events':
        return Sparkles;
      case 'teachers_timetable':
        return Users;
      case 'attendance':
        return CalendarCheck;
      case 'chat_support':
        return MessageCircle;
      case 'grade':
        return Award;
      case 'gallery':
        return ImageIcon;
      case 'fees':
        return CreditCard;
      case 'announcements':
        return Megaphone;
      case 'homework':
        return ClipboardList;
      case 'exam_space':
        return FileCheck2;
      case 'ebook':
        return BookOpen;
      case 'calendar':
        return Calendar;
      default:
        return GraduationCap;
    }
  };

  const metricForFeature = (id: StudentPortalFeatureId): string => {
    switch (id) {
      case 'profile':
        return `${profileSummary.grade} · ${profileSummary.classSection}`;
      case 'events':
        return `${ETHIOPIAN_SCHOOL_EVENTS.length} Events`;
      case 'teachers_timetable':
        return `${workspace.teachers.length} Faculty · Mon–Fri`;
      case 'attendance':
        return `${attendanceProgress.clampedPercent}% Rate · ${attendanceProgress.presentDays} Present`;
      case 'chat_support':
        return `${chatMessages.length} Message(s)`;
      case 'grade':
        return studentMarks.length > 0
          ? `${averageScore}% · ${annualStanding.passed ? 'PASSED' : 'FAILED'}`
          : '100% Scale Report';
      case 'gallery':
        return `${STUDENT_GALLERY_ITEMS.length} Campus Albums`;
      case 'fees':
        return `${studentInvoices.length} Invoice(s) · ETB`;
      case 'announcements':
        return `${workspace.announcements.length} Notice(s)`;
      case 'homework':
        return `${teacherUploadedHomeworks.length} Assigned`;
      case 'exam_space':
        return `${activeTeacherExams.length} Active Exam(s)`;
      case 'ebook':
        return `${workspace.ebooks.length} Textbooks`;
      case 'calendar':
        return '2019 E.C. / 2026–27 G.C.';
      default:
        return '';
    }
  };

  const handleSelectFeatureCard = (id: StudentPortalFeatureId) => {
    setActiveSubTab(id);
    if (id === 'calendar' || id === 'events') {
      setBottomNav('calendar');
    } else if (id === 'chat_support' || id === 'announcements') {
      setBottomNav('messages');
    } else {
      setBottomNav('home');
    }
  };

  const handleBottomNavClick = (navId: StudentPortalBottomNavId) => {
    setBottomNav(navId);
    if (navId === 'home') {
      setActiveSubTab('profile');
    } else if (navId === 'calendar') {
      setActiveSubTab('calendar');
    } else if (navId === 'messages') {
      setActiveSubTab('chat_support');
    } else if (navId === 'more') {
      setActiveSubTab('gallery');
    }
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const studentMsg: SupportChatMessage = {
      id: `stu-${Date.now()}`,
      sender: 'student',
      senderName: profileSummary.fullName,
      department: chatAdvisorDept,
      text: trimmed,
      timestamp: nowTime,
    };
    const autoReply: SupportChatMessage = {
      id: `adv-${Date.now() + 1}`,
      sender: 'advisor',
      senderName:
        chatAdvisorDept === 'Registrar Office'
          ? 'ESMS Registrar Desk'
          : chatAdvisorDept === 'Finance Office'
            ? 'ESMS Bursar & Finance Desk'
            : 'Homeroom & Academic Advisor',
      department: chatAdvisorDept,
      text:
        lang === 'am'
          ? `መልእክትዎ ለ${chatAdvisorDept} ደርሷል (${studentIdCode})። በአጭር ጊዜ ውስጥ ምላሽ እንሰጣለን።`
          : `Thank you, ${profileSummary.firstName} (${studentIdCode}). Your inquiry has been logged with the ${chatAdvisorDept} and a response will be posted shortly.`,
      timestamp: nowTime,
    };
    setChatMessages((prev) => [...prev, studentMsg, autoReply]);
    setChatInput('');
  };

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
    <div
      data-testid="student-portal-theme-root"
      style={{ backgroundColor: STUDENT_PORTAL_THEME.mainBackground }}
      className="min-h-screen pb-24 text-[#20243A] space-y-6 rounded-2xl"
    >
      {/* 1. MODERN BLUE-TO-PURPLE GRADIENT HEADER (#304FC7 to #673AB7) WITH PROFILE, WELCOME & SEARCH BAR */}
      <section
        aria-label="Student Portal Header and Search"
        data-testid="student-portal-gradient-header"
        style={{
          background: `linear-gradient(135deg, ${STUDENT_PORTAL_THEME.headerGradientFrom} 0%, ${STUDENT_PORTAL_THEME.headerGradientTo} 100%)`,
        }}
        className="rounded-3xl p-5 sm:p-7 text-white shadow-md space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Student Avatar + Welcome Greeting + Ethiopian Academic Metadata */}
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/35 flex items-center justify-center text-lg sm:text-xl font-extrabold tracking-tight text-white shadow-sm shrink-0"
            >
              {profileSummary.initials}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-medium text-indigo-100">
                {lang === 'am'
                  ? 'እንኳን ደህና መጡ · የኢትዮጵያ ትምህርት ቤት የተማሪ ፖርታል'
                  : 'Welcome back · ESMS Student Portal'}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white truncate">
                {profileSummary.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-100 font-mono">
                <span>{studentIdCode}</span>
                <span aria-hidden="true">·</span>
                <span>{profileSummary.grade}</span>
                <span aria-hidden="true">·</span>
                <span>{profileSummary.classSection}</span>
                <span aria-hidden="true">·</span>
                <span>{profileSummary.academicYear}</span>
              </div>
            </div>
          </div>

          {/* Admin/Staff Active Student Selector (hidden when logged in directly as a student) */}
          <div className="flex flex-wrap items-center gap-3">
            {loggedInAccount?.role !== 'STUDENT' && workspace.students.length > 0 && (
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-3 py-1.5">
                <label
                  htmlFor="preview-student-select"
                  className="text-xs font-semibold text-white shrink-0"
                >
                  {lang === 'am' ? 'ተማሪ:' : 'Active Student:'}
                </label>
                <select
                  id="preview-student-select"
                  value={student?.id || ''}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none max-w-[220px] truncate"
                >
                  {workspace.students.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900">
                      {s.studentCode} · {s.firstName} {s.fatherName} ({s.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 2. INTEGRATED SEARCH BAR + ATTENDANCE SNAPSHOT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
          <div className="lg:col-span-7 relative">
            <Search className="w-4 h-4 text-[#673AB7] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              data-testid="student-portal-search-input"
              aria-label={
                lang === 'am'
                  ? 'የተማሪ ፖርታል አገልግሎቶችን ይፈልጉ'
                  : 'Search student portal modules, grades, homework, library, or events'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'am'
                  ? 'ፈልግ፦ ውጤት፣ የቤት ስራ፣ ፕሮግራም፣ ላይብረሪ፣ ክፍያ...'
                  : 'Search modules: Grade Sheet, Homework, Library, Fees, Events...'
              }
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white text-[#20243A] placeholder:text-[#73788A] text-xs sm:text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-white/80"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#73788A] hover:text-[#20243A] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Daily Attendance Rate Progress Bar inside Header */}
          <div
            data-testid="student-overview-attendance-card"
            className="lg:col-span-5 bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-white">
              <span className="font-semibold">
                {lang === 'am' ? 'የቀን ክትትል ምጣኔ (Attendance)' : 'Daily Attendance Rate'}
              </span>
              <span className="font-mono font-bold tabular-nums">
                {attendanceProgress.clampedPercent}% ({attendanceProgress.presentDays} Present /{' '}
                {attendanceProgress.totalRecordedDays} Days)
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Student Daily Attendance Rate"
              aria-valuenow={attendanceProgress.clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="student-attendance-progress-bar"
              className="w-full h-2.5 bg-white/25 rounded-full overflow-hidden flex"
            >
              <div
                className="h-full bg-emerald-300 transition-all duration-500 rounded-full"
                style={{ width: `${attendanceProgress.clampedPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUICK ACCESS DASHBOARD WITH COLORFUL PASTEL CARDS */}
      <section
        aria-label="Student Portal Overview"
        data-testid="student-portal-overview"
        className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
              {lang === 'am' ? 'ፈጣን መዳረሻ (Quick Access Dashboard)' : 'Quick Access Dashboard'}
            </h2>
            <p className="text-xs text-[#73788A]">
              {lang === 'am'
                ? 'ሁሉንም የተማሪ አገልግሎቶች ከታች ካሉት ካርዶች ይምረጡ'
                : 'Select any pastel module card below to open your academic tools and records'}
            </p>
          </div>
          <div className="text-xs font-mono text-[#73788A]">
            {filteredQuickAccessCards.length} / {STUDENT_PORTAL_QUICK_ACCESS_CARDS.length}{' '}
            {lang === 'am' ? 'አገልግሎቶች' : 'Modules'}
          </div>
        </div>

        {filteredQuickAccessCards.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#F8F9FE] border border-slate-200 text-xs text-[#73788A]">
            {lang === 'am'
              ? `ለ "${searchQuery}" ምንም የተማሪ አገልግሎት አልተገኘም።`
              : `No Quick Access modules matched "${searchQuery}".`}
          </div>
        ) : (
          <nav
            aria-label="Student dashboard sections"
            data-testid="student-dashboard-cards-grid"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5"
          >
            {filteredQuickAccessCards.map((card) => {
              const Icon = iconForFeature(card.id);
              const isActive = activeSubTab === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  data-testid={`quick-access-card-${card.id}`}
                  onClick={() => handleSelectFeatureCard(card.id)}
                  style={{
                    backgroundColor: card.pastelBg,
                  }}
                  className={`group text-left p-4 rounded-2xl transition-all duration-150 flex flex-col justify-between gap-3 shadow-xs hover:shadow-md cursor-pointer ${
                    isActive
                      ? 'ring-2 ring-[#673AB7] shadow-md -translate-y-0.5'
                      : 'border border-white/80 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div
                      style={{ color: card.accentColor }}
                      className="w-10 h-10 rounded-xl bg-white/90 shadow-2xs flex items-center justify-center shrink-0"
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-[#73788A] text-right truncate max-w-[120px]">
                      {metricForFeature(card.id)}
                    </span>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-[#20243A] truncate">
                      {lang === 'am' ? card.titleAm : card.titleEn}
                    </div>
                    <div className="text-[11px] text-[#73788A] truncate">
                      {lang === 'am' ? card.subtitleAm : card.subtitleEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        )}
      </section>

      {/* ACTIVE FEATURE MODULE VIEWPORT */}
      {/* 4. STUDENT PROFILE */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          {student ? (
            <StudentProfileCard
              student={student}
              studentAccount={studentAccount}
              school={workspace.school}
              lang={lang}
              calendarMode={calendarMode}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-[#73788A]">
              {lang === 'am'
                ? 'ምንም የተመዘገበ ተማሪ አልተገኘም።'
                : 'No student profile registered in the current workspace yet.'}
            </div>
          )}
        </div>
      )}

      {/* 5. SCHOOL EVENTS */}
      {activeSubTab === 'events' && (
        <section
          aria-label="School Events"
          data-testid="student-events-section"
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am' ? 'የትምህርት ቤት ዝግጅቶች እና በዓላት' : 'School Events & Campus Festivals'}
              </h2>
              <p className="text-xs text-[#73788A]">
                {lang === 'am'
                  ? 'የ2019 ዓ.ም አካዳሚያዊ፣ የሳይንስ እና የባህል ዝግጅቶች'
                  : '2019 E.C. Ethiopian academic ceremonies, STEM exhibitions, and athletics programs'}
              </p>
            </div>
            <span className="text-xs font-mono text-[#673AB7] font-bold">
              {ETHIOPIAN_SCHOOL_EVENTS.length} Scheduled Events
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ETHIOPIAN_SCHOOL_EVENTS.map((evt) => {
              const isJoined = Boolean(rsvpEvents[evt.id]);
              return (
                <article
                  key={evt.id}
                  style={{ backgroundColor: evt.pastelBg }}
                  className="rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs border border-white"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono text-[#73788A]">
                      <span style={{ color: evt.accentColor }} className="font-bold">
                        {evt.category}
                      </span>
                      <span>
                        {evt.ethiopianDate} · {formatCalendarDate(evt.dateIso, calendarMode, lang)}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#20243A]">
                      {lang === 'am' ? evt.titleAm : evt.titleEn}
                    </h3>
                    <p className="text-xs text-[#73788A] leading-relaxed">
                      {lang === 'am' ? evt.descriptionAm : evt.descriptionEn}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/5">
                    <span className="text-xs font-medium text-[#20243A]">
                      Venue: {evt.location}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRsvpEvents((prev) => ({ ...prev, [evt.id]: !prev[evt.id] }))
                      }
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isJoined
                          ? 'bg-[#673AB7] text-white'
                          : 'bg-white text-[#304FC7] hover:bg-indigo-50'
                      }`}
                    >
                      {isJoined
                        ? lang === 'am'
                          ? 'ተመዝግቧል ✓'
                          : 'Registered ✓'
                        : lang === 'am'
                          ? 'ለመሳተፍ ተመዝገብ'
                          : 'Remind Me'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. TEACHERS AND STAFF DIRECTORY */}
      {activeSubTab === 'teachers_timetable' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'መምህራን፣ ሰራተኞች እና የክፍል ፕሮግራም'
                  : 'Teachers & Staff Directory & Weekly Timetable'}
              </h2>
              <p className="text-xs text-[#73788A] mt-0.5">
                Assigned subject teachers and weekly period timetable for{' '}
                {student?.gradeLevel || 'Grade 10'} ({student?.sectionName || 'Section A'})
              </p>
            </div>
            <span className="text-xs font-mono text-[#73788A]">
              {workspace.teachers.length} Faculty · {workspace.subjects.length} Subjects
            </span>
          </div>

          {workspace.teachers.length === 0 ? (
            <div className="p-5 rounded-2xl bg-[#EAF3FF] text-xs text-[#20243A]">
              {lang === 'am'
                ? 'በአስተዳዳሪው የተመዘገቡ መምህራን እዚህ ይታያሉ። ከታች ያለውን ሳምንታዊ የክፍል ፕሮግራም ይመልከቱ።'
                : 'Assigned faculty members registered by the school administrator appear here. View your weekly class timetable below.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workspace.teachers.map((t, idx) => {
                const cardBgs = ['#F0EBFF', '#EAF3FF', '#E7F8F0', '#FFF6D9', '#FCEAF2', '#FFF0E5'];
                return (
                  <article
                    key={t.id}
                    style={{ backgroundColor: cardBgs[idx % cardBgs.length] }}
                    className="p-4 rounded-2xl text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#20243A] text-sm">{t.fullName}</span>
                      <span className="font-mono text-[11px] text-[#673AB7] font-semibold">
                        {t.staffCode}
                      </span>
                    </div>
                    <div className="text-[#20243A] font-medium">{t.assignedSubjects}</div>
                    <div className="text-[#73788A] pt-1 border-t border-black/5">
                      Classes: {t.assignedGrades} · Dept: {t.department}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Weekly Class Period Timetable (Monday - Friday) */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-extrabold text-[#20243A] mb-3">
              {lang === 'am'
                ? 'ሳምንታዊ የክፍል ፕሮግራም (ሰኞ – አርብ)'
                : 'Weekly Class Period Timetable (Monday – Friday)'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  period: 'Period 1 (08:30 - 09:15)',
                  pastelBg: '#F0EBFF',
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
                  pastelBg: '#EAF3FF',
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
                  pastelBg: '#E7F8F0',
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
                  style={{ backgroundColor: slot.pastelBg }}
                  className="p-4 rounded-2xl space-y-2 text-xs shadow-2xs"
                >
                  <div className="font-mono font-bold text-[#20243A] border-b border-black/10 pb-2">
                    {slot.period}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-[#20243A]">
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
        </div>
      )}

      {/* 7. ATTENDANCE TRACKING */}
      {activeSubTab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'የክፍል ክትትል እና የቀን መገኘት (Attendance Tracking)'
                  : 'Attendance Tracking — Daily Rate & Recorded Days'}
              </h2>
              <p className="text-xs text-[#73788A] mt-0.5">
                Official summary of days present, days absent, late arrivals, and daily attendance log.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800">
              Standing: {attendanceProgress.standingLabel}
            </span>
          </div>

          <div className="p-5 bg-[#F8F9FE] border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#20243A]">Student Daily Attendance Rate</span>
              <span className="text-lg font-mono font-bold text-[#304FC7] tabular-nums">
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
                className="h-full bg-gradient-to-r from-[#304FC7] to-[#673AB7] transition-all duration-500"
                style={{ width: `${attendanceProgress.clampedPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#E7F8F0' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Days Present
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                {attSummary.presentDays} Days
              </div>
            </div>

            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#FCEAF2' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                <XCircle className="w-4 h-4 text-rose-700" />
                Days Absent
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                {attSummary.absentDays} Days
              </div>
            </div>

            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#FFF6D9' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700" />
                Days Late
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                {attSummary.lateDays} Days
              </div>
            </div>

            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#F0EBFF' }}>
              <div className="text-xs font-semibold text-[#673AB7]">Attendance Rate</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#20243A] mt-1">
                {attSummary.attendanceRatePercent}%
              </div>
              <div className="text-[11px] text-[#73788A]">
                Total Recorded: {attSummary.totalRecordedDays} days
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentAttendance.map((att) => (
              <article
                key={att.id}
                className="p-4 bg-[#F8F9FE] border border-slate-200 rounded-2xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#20243A]">
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
                <p className="text-[#73788A]">{att.remarks}</p>
                <div className="text-[11px] text-[#73788A] pt-1.5 border-t border-slate-200">
                  Recorded by: {att.recordedBy}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 8. CHAT AND SUPPORT */}
      {activeSubTab === 'chat_support' && (
        <section
          aria-label="Chat and Support"
          data-testid="student-chat-support-section"
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'ውይይት እና የተማሪ ድጋፍ (Chat & Support)'
                  : 'Student Chat & Support Desk'}
              </h2>
              <p className="text-xs text-[#73788A]">
                {lang === 'am'
                  ? 'ከክፍል ኃላፊ መምህር፣ ከሬጅስትራር ወይም ከፋይናንስ ቢሮ ጋር በቀጥታ ይወያዩ'
                  : 'Direct messaging with your Homeroom Advisor, Registrar Office, and Finance Desk'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-[#F8F9FE] rounded-xl border border-slate-200">
              {(['Academic Advisor', 'Registrar Office', 'Finance Office'] as const).map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setChatAdvisorDept(dept)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    chatAdvisorDept === dept
                      ? 'bg-[#673AB7] text-white shadow-2xs'
                      : 'text-[#73788A] hover:text-[#20243A]'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#F8F9FE] border border-slate-200 rounded-2xl p-4 space-y-3 max-h-80 overflow-y-auto">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-xl rounded-2xl p-3.5 text-xs space-y-1 ${
                  msg.sender === 'student'
                    ? 'ml-auto bg-[#304FC7] text-white'
                    : 'mr-auto bg-[#F0EBFF] text-[#20243A]'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[11px] opacity-80 font-mono">
                  <span className="font-bold">{msg.senderName}</span>
                  <span>
                    {msg.department} · {msg.timestamp}
                  </span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChatMessage} className="flex items-center gap-3">
            <input
              type="text"
              data-testid="student-chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                lang === 'am'
                  ? `ለ ${chatAdvisorDept} መልእክት ይጻፉ...`
                  : `Write a message to ${chatAdvisorDept}...`
              }
              className="flex-1 px-4 py-3 text-xs sm:text-sm bg-[#F8F9FE] border border-slate-300 rounded-2xl text-[#20243A] placeholder:text-[#73788A] focus:outline-none focus:ring-2 focus:ring-[#673AB7]"
            />
            <button
              type="submit"
              data-testid="student-chat-send-btn"
              className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#304FC7] to-[#673AB7] hover:opacity-95 inline-flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>{lang === 'am' ? 'ላክ' : 'Send'}</span>
            </button>
          </form>
        </section>
      )}

      {/* 9. GRADE SHEET AND RESULTS */}
      {activeSubTab === 'grade' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'የውጤት መግለጫ ካርድ (Grade Sheet & Official Results — 100%)'
                  : 'Grade Sheet & Official Academic Report Card (Out of 100%)'}
              </h2>
              <p className="text-xs text-[#73788A] mt-0.5">
                Teacher-recorded marks out of 100%: End-of-year overall score &lt; 50% is Not Promoted (Failed) · ≥ 50% is Promoted (Passed)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <div className="px-3.5 py-1.5 bg-[#304FC7] text-white rounded-xl text-xs font-mono font-bold">
                Overall: {averageScore}% / 100%
              </div>
              <span
                data-testid="annual-pass-fail-badge"
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-extrabold tracking-wide ${
                  annualStanding.statusCode === 'PASSED'
                    ? 'bg-emerald-600 text-white'
                    : annualStanding.statusCode === 'FAILED'
                      ? 'bg-red-600 text-white'
                      : 'bg-[#F0EBFF] text-[#673AB7]'
                }`}
              >
                {annualStanding.statusLabelEn}
              </span>
            </div>
          </div>

          <div
            data-testid="annual-standing-summary"
            style={{
              backgroundColor:
                annualStanding.statusCode === 'PASSED'
                  ? '#E7F8F0'
                  : annualStanding.statusCode === 'FAILED'
                    ? '#FCEAF2'
                    : '#F0EBFF',
            }}
            className="p-5 rounded-2xl space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#20243A]">
                  End-of-Year Cumulative Evaluation (Calculated Out of 100%)
                </div>
                <div className="text-xs text-[#73788A] mt-0.5">
                  Rule: Below 50% (&lt; 50%) = Failed (Not Promoted) · 50% and Above (≥ 50%) = Passed (Promoted)
                </div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-lg font-extrabold text-[#20243A]">
                  {annualStanding.overallPercentage}% / 100%
                </div>
                <div className="text-[11px] text-[#73788A]">
                  {annualStanding.totalPointsEarned} / {annualStanding.maxPossiblePoints} Total Points ({annualStanding.subjectCount} Subject{annualStanding.subjectCount === 1 ? '' : 's'})
                </div>
              </div>
            </div>

            <div className="relative pt-1">
              <div className="w-full h-3 bg-white rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    annualStanding.passed ? 'bg-emerald-600' : 'bg-[#673AB7]'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, annualStanding.overallPercentage))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-[#73788A] mt-1">
                <span>0%</span>
                <span className="font-bold text-[#20243A]">50% Pass Threshold</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {studentMarks.length === 0 ? (
            <div className="p-6 text-center bg-[#F8F9FE] border border-slate-200 rounded-2xl text-xs text-[#73788A]">
              No published marks recorded yet for this student.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table
                data-testid="student-results-table"
                className="w-full text-left border-collapse text-xs"
              >
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8F9FE] text-[#73788A] font-semibold">
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
                      <tr key={`row-${m.id}`} className="hover:bg-[#F8F9FE]">
                        <td className="py-3 px-4 font-mono font-semibold text-[#304FC7]">
                          {m.subjectCode}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#20243A]">{m.subjectNameEn}</td>
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
                            <span className="font-bold text-[#20243A]">
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
              </table>
            </div>
          )}
        </div>
      )}

      {/* 10. STUDENT GALLERY */}
      {activeSubTab === 'gallery' && (
        <section
          aria-label="Student Gallery"
          data-testid="student-gallery-section"
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am' ? 'የተማሪዎች የፎቶ እና እንቅስቃሴ ማዕከል' : 'Student Gallery & Campus Life'}
              </h2>
              <p className="text-xs text-[#73788A]">
                {lang === 'am'
                  ? 'የቤተ-ሙከራ፣ የስፖርት፣ የባህል ቀን እና የዲጂታል ላይብረሪ እንቅስቃሴዎች'
                  : 'Highlights from science laboratories, athletics championships, and cultural heritage days'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F8F9FE] rounded-xl border border-slate-200">
              {['ALL', 'STEM Labs', 'Digital & ICT', 'Cultural Day', 'Sports'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGalleryCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    galleryCategory === cat
                      ? 'bg-[#673AB7] text-white'
                      : 'text-[#73788A] hover:text-[#20243A]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STUDENT_GALLERY_ITEMS.filter(
              (item) => galleryCategory === 'ALL' || item.category === galleryCategory
            ).map((item) => (
              <article
                key={item.id}
                style={{ backgroundColor: item.pastelBg }}
                className="rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="h-32 rounded-xl bg-white/80 flex flex-col items-center justify-center p-4 text-center border border-white">
                    <ImageIcon className="w-8 h-8 mb-1.5" style={{ color: item.accentColor }} />
                    <span
                      style={{ color: item.accentColor }}
                      className="text-xs font-extrabold tracking-tight"
                    >
                      {item.category}
                    </span>
                    <span className="text-[11px] font-mono text-[#73788A]">{item.dateLabel}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#20243A]">
                    {lang === 'am' ? item.titleAm : item.titleEn}
                  </h3>
                  <p className="text-xs text-[#73788A] leading-relaxed">{item.captionEn}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 11. SCHOOL FEES AND PAYMENT HISTORY */}
      {activeSubTab === 'fees' && (
        <section
          aria-label="School Fees and Payment History"
          data-testid="student-fees-section"
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'የትምህርት ቤት ክፍያ እና የደረሰኝ ታሪክ (ETB)'
                  : 'School Fees & Payment History (ETB)'}
              </h2>
              <p className="text-xs text-[#73788A]">
                {lang === 'am'
                  ? 'የክፍያ ደረሰኞች፣ ቀሪ ሂሳብ እና የቴሌብር / ንግድ ባንክ የክፍያ ቁጥሮች'
                  : 'Tuition invoices, paid receipts, and official Telebirr & Commercial Bank of Ethiopia payment channels'}
              </p>
            </div>
          </div>

          {/* Official Telebirr & CBE Payment Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#EAF3FF' }}>
              <div className="text-xs font-bold text-[#304FC7]">
                Official Telebirr Merchant / Phone Account
              </div>
              <div className="text-lg font-mono font-extrabold text-[#20243A] mt-1">
                {SCHOOL_PAYMENT_ACCOUNTS.telebirr.accountNumber}
              </div>
              <div className="text-[11px] text-[#73788A] mt-0.5">
                Quote Student ID ({studentIdCode}) as payment reference
              </div>
            </div>
            <div className="p-4 rounded-2xl" style={{ backgroundColor: '#F0EBFF' }}>
              <div className="text-xs font-bold text-[#673AB7]">
                Commercial Bank of Ethiopia (CBE) Account
              </div>
              <div className="text-lg font-mono font-extrabold text-[#20243A] mt-1">
                {SCHOOL_PAYMENT_ACCOUNTS.cbe.accountNumber}
              </div>
              <div className="text-[11px] text-[#73788A] mt-0.5">
                Instant verification at the School Finance Office
              </div>
            </div>
          </div>

          {studentInvoices.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#F8F9FE] border border-slate-200 text-xs text-[#73788A]">
              {lang === 'am'
                ? 'ለዚህ ተማሪ የተመዘገበ ቀሪ የክፍያ ደረሰኝ የለም።'
                : 'No outstanding tuition invoices recorded for this student.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {studentInvoices.map((inv) => (
                <article
                  key={inv.id}
                  className="p-4 rounded-2xl bg-[#F8F9FE] border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-[#304FC7]">{inv.invoiceNumber}</span>
                    <span className="font-bold text-[#20243A]">{inv.status}</span>
                  </div>
                  <div className="font-bold text-sm text-[#20243A]">{inv.feeCategory}</div>
                  <div className="flex items-center justify-between font-mono text-[#73788A] pt-2 border-t border-slate-200">
                    <span>Total: {inv.totalAmountEtb} ETB</span>
                    <span>Paid: {inv.paidAmountEtb} ETB</span>
                    <span className="font-bold text-[#20243A]">Bal: {inv.balanceEtb} ETB</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {studentPayments.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <h3 className="text-xs font-bold text-[#20243A]">Recorded Payment Receipts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-[#E7F8F0] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-bold text-[#20243A]">{pay.receiptNumber}</div>
                      <div className="text-[11px] text-[#73788A]">{pay.paymentMethod}</div>
                    </div>
                    <div className="font-mono font-extrabold text-emerald-800">
                      {pay.amountEtb} ETB
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 12. SCHOOL NOTICES */}
      {activeSubTab === 'announcements' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
              {lang === 'am' ? 'የትምህርት ቤት ማስታወቂያዎች (School Notices)' : 'School Notices & Official Bulletins'}
            </h2>
            <span className="text-xs font-mono text-[#73788A]">
              {workspace.announcements.length} Official Notice(s)
            </span>
          </div>
          {workspace.announcements.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#F8F9FE] border border-slate-200 text-xs text-[#73788A]">
              {lang === 'am'
                ? 'አዲስ የትምህርት ቤት ማስታወቂያ የለም።'
                : 'No school notices published yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspace.announcements.map((ann, idx) => {
                const bgs = ['#E7F8F0', '#EAF3FF', '#FFF6D9', '#F0EBFF'];
                return (
                  <article
                    key={ann.id}
                    style={{ backgroundColor: bgs[idx % bgs.length] }}
                    className="p-5 rounded-2xl flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#20243A] text-sm">{ann.titleEn}</span>
                        <span className="text-[11px] font-mono text-[#73788A] shrink-0">
                          {ann.priority} · {ann.audience}
                        </span>
                      </div>
                      <p className="text-xs text-[#20243A] leading-relaxed">{ann.bodyEn}</p>
                    </div>
                    <div className="text-[11px] text-[#73788A] pt-2 border-t border-black/5">
                      Published by: {ann.publishedBy}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 13. ASSIGNMENTS AND HOMEWORK */}
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

      {/* 14. EXAMINATION SCHEDULE AND RESULTS */}
      {activeSubTab === 'exam_space' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'የፈተና ፕሮግራም እና የኦንላይን ፈተና (Examinations)'
                  : 'Examination Schedule & Active Timed Assessments'}
              </h2>
              <p className="text-xs text-[#73788A] mt-0.5">
                Exams are visible during the minutes allotted by the teacher and automatically close once time expires.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#673AB7] tabular-nums">
              Active Exams: <strong>{activeTeacherExams.length}</strong>
            </span>
          </div>

          {examResultMsg && (
            <div className="p-4 bg-[#E7F8F0] border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-950">
              {examResultMsg}
            </div>
          )}

          {activeTeacherExams.length === 0 ? (
            <div className="p-8 text-center bg-[#FFF6D9] rounded-2xl space-y-2">
              <Clock className="w-6 h-6 text-[#B45309] mx-auto" />
              <div className="text-sm font-bold text-[#20243A]">No Active Exams Right Now</div>
              <p className="text-xs text-[#73788A] max-w-md mx-auto">
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
                    className="rounded-2xl p-4 flex flex-col justify-between gap-3 bg-[#FFF6D9]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-semibold text-[#20243A]">{ex.subjectCode}</span>
                        <span className="text-amber-900 font-bold tabular-nums">
                          {formatExamCountdown(remainingSecs)} left ({ex.durationMinutes}m)
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#20243A] mt-2">{ex.title}</h3>
                      <p className="text-[11px] text-[#73788A] mt-1">
                        {ex.gradeLevel} · {parsedQuestions.length} Question(s) · {ex.postedBy}
                      </p>
                      {prevSub && (
                        <div className="mt-2 px-2.5 py-1 bg-white rounded text-[11px] font-semibold text-emerald-900">
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
                      className="w-full py-2 text-xs font-semibold bg-[#673AB7] text-white rounded-xl hover:opacity-95"
                    >
                      Start Exam
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {activeExamId &&
            (() => {
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
                    <h3 className="text-sm font-bold text-[#20243A]">{currentExam.title}</h3>
                    <span className="text-xs font-mono font-bold text-amber-800 tabular-nums">
                      Time Remaining: {formatExamCountdown(remainingSecs)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-4 bg-[#F8F9FE] border border-slate-200 rounded-2xl space-y-2"
                      >
                        <div className="text-xs font-semibold text-[#20243A]">{q.question}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${
                                selectedAnswers[qIdx] === oIdx
                                  ? 'border-[#673AB7] bg-[#F0EBFF] font-semibold'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
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
                      className="px-4 py-2 text-xs font-medium text-[#20243A] bg-slate-100 rounded-xl"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExamSubmit(currentExam)}
                      className="px-5 py-2 text-xs font-semibold text-white bg-[#673AB7] rounded-xl"
                    >
                      Submit Exam Answers
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* 15. DIGITAL LIBRARY */}
      {activeSubTab === 'ebook' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am' ? 'ዲጂታል ላይብረሪ (Digital Library & E-Books)' : 'Digital Library & MoE Textbooks'}
              </h2>
              <span className="text-xs font-mono text-[#73788A]">
                {workspace.ebooks.length} Digital Textbooks
              </span>
            </div>

            {workspace.ebooks.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-[#FFF0E5] text-xs text-[#20243A]">
                {lang === 'am'
                  ? 'መምህራን ወይም ላይብረሪያን የሚጭኗቸው የመማሪያ መጽሐፍት (E-Books) እዚህ ይገኛሉ።'
                  : 'Digital textbooks uploaded by your teachers or school librarian appear here for instant reading.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workspace.ebooks.map((eb) => (
                  <button
                    key={eb.id}
                    type="button"
                    onClick={() => setSelectedEbookId(eb.id)}
                    className={`text-left p-4 rounded-2xl border transition-colors flex flex-col justify-between gap-2 ${
                      currentEbook?.id === eb.id
                        ? 'border-[#673AB7] bg-[#F0EBFF]'
                        : 'border-slate-200 bg-[#FFF0E5]/70 hover:border-[#673AB7]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#73788A]">
                        <span>
                          {eb.code} · {eb.subjectCode}
                        </span>
                        <span className="font-bold text-[#673AB7]">{eb.gradeLevel}</span>
                      </div>
                      <div className="text-sm font-bold text-[#20243A] mt-2">{eb.titleEn}</div>
                      <p className="text-xs text-[#73788A] mt-1 line-clamp-2">{eb.summary}</p>
                    </div>
                    <div className="text-[11px] font-mono text-[#73788A] pt-2 border-t border-black/5">
                      Author: {eb.author}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {currentEbook && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-[#673AB7]">
                    {currentEbook.code} · {currentEbook.gradeLevel}
                  </div>
                  <h3 className="text-base font-bold text-[#20243A] mt-0.5">
                    {currentEbook.titleEn}
                  </h3>
                </div>
                <span className="text-xs text-[#73788A]">Author: {currentEbook.author}</span>
              </div>
              <div className="p-5 bg-[#F8F9FE] border border-slate-200 rounded-2xl text-xs text-[#20243A] whitespace-pre-wrap leading-relaxed font-sans">
                {currentEbook.contentBody}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 16. UPCOMING EVENTS AND ETHIOPIAN ACADEMIC CALENDAR */}
      {activeSubTab === 'calendar' && (
        <section
          aria-label="Upcoming Events and Ethiopian Academic Calendar"
          data-testid="student-calendar-section"
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#20243A]">
                {lang === 'am'
                  ? 'የ2019 ዓ.ም የኢትዮጵያ የትምህርት ዘመን የቀን መቁጠሪያ'
                  : 'Upcoming Events & Ethiopian Academic Calendar (2019 E.C. / 2026–27 G.C.)'}
              </h2>
              <p className="text-xs text-[#73788A]">
                {lang === 'am'
                  ? 'ከመስከረም እስከ ሰኔ ያሉ የትምህርት፣ የፈተና እና የበዓላት መርሃ ግብር'
                  : 'Dual Ethiopian & Gregorian calendar milestones from Meskerem to Sene'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ETHIOPIAN_ACADEMIC_CALENDAR_MILESTONES.map((item) => (
              <article
                key={item.monthEc}
                style={{ backgroundColor: item.pastelBg }}
                className="rounded-2xl p-5 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-extrabold text-[#673AB7]">{item.monthEc}</span>
                  <span className="text-[#73788A]">{item.monthGc}</span>
                </div>
                <div className="text-xs font-bold text-[#304FC7]">{item.type}</div>
                <p className="text-xs sm:text-sm font-bold text-[#20243A] leading-snug">
                  {lang === 'am' ? item.eventAm : item.eventEn}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 17. BOTTOM NAVIGATION BAR: WHITE BACKGROUND WITH PURPLE (#673AB7) ACTIVE ICONS (HOME, CALENDAR, MESSAGES, MORE) */}
      <nav
        aria-label="Student Portal Bottom Navigation"
        data-testid="student-bottom-navigation"
        style={{ backgroundColor: STUDENT_PORTAL_THEME.navBackground }}
        className="sticky bottom-3 z-30 mx-auto max-w-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2 flex items-center justify-around no-print"
      >
        {STUDENT_PORTAL_BOTTOM_NAV.map((item) => {
          const isActive = bottomNav === item.id;
          const NavIcon =
            item.id === 'home'
              ? Home
              : item.id === 'calendar'
                ? Calendar
                : item.id === 'messages'
                  ? MessageCircle
                  : Grid;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`student-bottom-nav-${item.id}`}
              onClick={() => handleBottomNavClick(item.id)}
              style={{
                color: isActive
                  ? STUDENT_PORTAL_THEME.navActiveIcon
                  : STUDENT_PORTAL_THEME.secondaryText,
              }}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive ? 'bg-[#F0EBFF] font-extrabold' : 'hover:bg-slate-50'
              }`}
            >
              <NavIcon
                className="w-5 h-5"
                style={{
                  color: isActive
                    ? STUDENT_PORTAL_THEME.navActiveIcon
                    : STUDENT_PORTAL_THEME.secondaryText,
                }}
              />
              <span>{lang === 'am' ? item.labelAm : item.labelEn}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default StudentPortalDashboard;
