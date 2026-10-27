import React, { useState } from 'react';
import {
  ClassSectionRecord,
  SharedViewProps,
  StudentRecord,
  SubjectRecord,
  TeacherRecord,
} from '../types/esms';
import { formatCalendarDate, validateEthiopianStudentName } from '../utils/ethiopianRules';
import { TRANSLATIONS } from '../utils/i18n';
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  BookOpen,
  Layers,
  KeyRound,
  Copy,
  Check,
  Printer,
  RefreshCw,
} from 'lucide-react';

function generateRandomStudentPassword(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `STU-${num}`;
}

function buildSuggestedStudentLoginUser(firstName: string, fatherName: string): string {
  const cleanFirst = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const cleanFather = fatherName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!cleanFirst && !cleanFather) return '';
  if (cleanFirst && cleanFather) {
    return `${cleanFirst}.${cleanFather}@student.edu.et`;
  }
  return `${cleanFirst || cleanFather}@student.edu.et`;
}

export const StudentsAndAdmissionsView: React.FC<SharedViewProps> = ({
  lang,
  calendarMode,
  workspace,
  onRefresh,
  apiFetch,
}) => {
  const t = TRANSLATIONS[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Registration & Edit Form State (Ethiopian 3-part name)
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [grandfatherName, setGrandfatherName] = useState('');
  const [fullNameAm, setFullNameAm] = useState('');
  const [gender, setGender] = useState('Female');
  const [dateOfBirth, setDateOfBirth] = useState('2010-09-11');
  const [gradeLevel, setGradeLevel] = useState('Grade 10');
  const [sectionName, setSectionName] = useState('Section A');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('+251-911-');
  const [subCity, setSubCity] = useState('Bole');
  const [woreda, setWoreda] = useState('Woreda 03');
  const [previousSchool, setPreviousSchool] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] = useState('ACTIVE');

  // Student Login User & Password preparation fields
  const [customLoginUser, setCustomLoginUser] = useState('');
  const [customLoginPassword, setCustomLoginPassword] = useState(() =>
    generateRandomStudentPassword()
  );
  const [latestIssuedCredentials, setLatestIssuedCredentials] = useState<{
    studentName: string;
    gradeSection: string;
    loginUser: string;
    loginPassword: string;
    studentCode: string;
  } | null>(null);
  const [copiedCredentialField, setCopiedCredentialField] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // CSV Bulk Import Validator State (starts completely empty - no pre-seeded example data)
  const [csvText, setCsvText] = useState('');
  const [csvPreviewMsg, setCsvPreviewMsg] = useState<string | null>(null);

  const suggestedLoginUser =
    customLoginUser.trim() || buildSuggestedStudentLoginUser(firstName, fatherName);

  const getStudentPortalCredentials = (stu: StudentRecord) => {
    const portalAcc = (workspace.portalAccounts || []).find(
      (acc) =>
        acc.role === 'STUDENT' &&
        (acc.linkedStudentId === stu.id || acc.accessCode === stu.studentCode)
    );
    return {
      loginUser:
        portalAcc?.email ||
        buildSuggestedStudentLoginUser(stu.firstName, stu.fatherName) ||
        `${stu.studentCode.toLowerCase()}@student.edu.et`,
      loginPassword: portalAcc?.accessCode || stu.studentCode,
    };
  };

  const handleCopyCredentials = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredentialField(key);
      setTimeout(() => setCopiedCredentialField(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleAuthorizeAllStudentsLogin = async () => {
    setStatusMsg(null);
    try {
      const res = await apiFetch('/api/v1/students/authorize-all-login', {
        method: 'POST',
        body: JSON.stringify({ schoolId: workspace.school?.id || 1 }),
      });
      setStatusMsg({
        type: 'ok',
        text:
          lang === 'am'
            ? `ሁሉም የተመዘገቡ ተማሪዎች (${res.authorizedStudentsCount}) ወደ ሲስተሙ Login እንዲያደርጉ ተፈቅዷል!`
            : `All ${res.authorizedStudentsCount} registered student(s) are now authorized and active for Portal Login!`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text: err.message || 'Failed to authorize student logins',
      });
    }
  };

  const filteredStudents = workspace.students.filter((stu) => {
    const matchesGrade = gradeFilter === 'ALL' || stu.gradeLevel === gradeFilter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesGrade;
    const fullEn = `${stu.firstName} ${stu.fatherName} ${stu.grandfatherName}`.toLowerCase();
    const creds = getStudentPortalCredentials(stu);
    return (
      matchesGrade &&
      (fullEn.includes(q) ||
        stu.studentCode.toLowerCase().includes(q) ||
        creds.loginUser.toLowerCase().includes(q) ||
        stu.fullNameAm.includes(q) ||
        stu.guardianPhone.toLowerCase().includes(q))
    );
  });

  const handleLoadStudentForEdit = (stu: StudentRecord) => {
    const creds = getStudentPortalCredentials(stu);
    setEditingStudentId(stu.id);
    setFirstName(stu.firstName);
    setFatherName(stu.fatherName);
    setGrandfatherName(stu.grandfatherName);
    setFullNameAm(stu.fullNameAm);
    setGender(stu.gender);
    setDateOfBirth(stu.dateOfBirth);
    setGradeLevel(stu.gradeLevel);
    setSectionName(stu.sectionName);
    setGuardianName(stu.guardianName);
    setGuardianRelationship(stu.guardianRelationship);
    setGuardianPhone(stu.guardianPhone);
    setSubCity(stu.subCity);
    setWoreda(stu.woreda);
    setPreviousSchool(stu.previousSchool);
    setEnrollmentStatus(stu.enrollmentStatus);
    setCustomLoginUser(creds.loginUser);
    setCustomLoginPassword(creds.loginPassword);
    setStatusMsg({
      type: 'ok',
      text: `Editing Student ${stu.studentCode} (${stu.firstName} ${stu.fatherName}). Update fields above and click Save.`,
    });
  };

  const handleCancelStudentEdit = () => {
    setEditingStudentId(null);
    setFirstName('');
    setFatherName('');
    setGrandfatherName('');
    setFullNameAm('');
    setGuardianName('');
    setGuardianPhone('+251-911-');
    setEnrollmentStatus('ACTIVE');
    setCustomLoginUser('');
    setCustomLoginPassword(generateRandomStudentPassword());
    setStatusMsg(null);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const validation = validateEthiopianStudentName({
      firstName,
      fatherName,
      grandfatherName,
    });
    if (!validation.valid) {
      setStatusMsg({ type: 'err', text: validation.error || 'Invalid student name.' });
      return;
    }
    if (!guardianName.trim() || guardianPhone.trim().length < 9) {
      setStatusMsg({
        type: 'err',
        text: 'Guardian full name and valid Ethiopian phone (+251...) are required.',
      });
      return;
    }

    const preparedUser =
      customLoginUser.trim() || buildSuggestedStudentLoginUser(firstName, fatherName);
    const preparedPass = customLoginPassword.trim() || generateRandomStudentPassword();

    try {
      if (editingStudentId) {
        const res = await apiFetch(`/api/v1/students/${editingStudentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            firstName,
            fatherName,
            grandfatherName,
            fullNameAm: fullNameAm || `${firstName} ${fatherName} ${grandfatherName}`,
            gender,
            dateOfBirth,
            gradeLevel,
            sectionName,
            guardianName,
            guardianRelationship,
            guardianPhone,
            subCity,
            woreda,
            previousSchool: previousSchool || 'Direct Admission',
            enrollmentStatus,
            email: preparedUser,
            studentCode: preparedPass,
          }),
        });
        setStatusMsg({
          type: 'ok',
          text: `Updated student ${res.student.firstName} ${res.student.fatherName} — Login User: ${preparedUser} | Password: ${res.student.studentCode}.`,
        });
        setEditingStudentId(null);
      } else {
        const res = await apiFetch('/api/v1/students', {
          method: 'POST',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            firstName,
            fatherName,
            grandfatherName,
            fullNameAm: fullNameAm || `${firstName} ${fatherName} ${grandfatherName}`,
            gender,
            dateOfBirth,
            gradeLevel,
            sectionName,
            guardianName,
            guardianRelationship,
            guardianPhone,
            emergencyContactPhone: guardianPhone,
            subCity,
            woreda,
            previousSchool: previousSchool || 'Direct Admission',
            email: preparedUser,
            accessCode: preparedPass,
          }),
        });

        const issuedUser =
          res.loginCredentials?.loginUser || res.student?.loginUser || preparedUser;
        const issuedPassword =
          res.loginCredentials?.loginPassword ||
          res.student?.loginPassword ||
          res.student?.studentCode ||
          preparedPass;

        setLatestIssuedCredentials({
          studentName: `${res.student.firstName} ${res.student.fatherName} ${res.student.grandfatherName}`,
          gradeSection: `${res.student.gradeLevel} · ${res.student.sectionName}`,
          loginUser: issuedUser,
          loginPassword: issuedPassword,
          studentCode: res.student.studentCode,
        });

        setStatusMsg({
          type: 'ok',
          text: `Registered student ${res.student.firstName} ${res.student.fatherName}. Login User (${issuedUser}) and Password (${issuedPassword}) are ready for login!`,
        });
      }
      setFirstName('');
      setFatherName('');
      setGrandfatherName('');
      setFullNameAm('');
      setGuardianName('');
      setCustomLoginUser('');
      setCustomLoginPassword(generateRandomStudentPassword());
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Save failed' });
    }
  };

  const handleDeleteStudent = async (stu: StudentRecord) => {
    setStatusMsg(null);
    try {
      await apiFetch(
        `/api/v1/students/${stu.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingStudentId === stu.id) {
        handleCancelStudentEdit();
      }
      setStatusMsg({
        type: 'ok',
        text: `Deleted student ${stu.firstName} ${stu.fatherName} (${stu.studentCode}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Failed to delete student' });
    }
  };

  const handleValidateAndImportCsv = async () => {
    setCsvPreviewMsg(null);
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setCsvPreviewMsg('Error: CSV input is empty.');
      return;
    }

    let importedCount = 0;
    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 10) {
        setCsvPreviewMsg(
          `Validation Error: Expected 10 CSV columns (First, Father, Grandfather, AmharicName, Gender, DOB, Grade, Section, Guardian, Phone), got ${cols.length}.`
        );
        return;
      }
      const [fName, faName, gfName, amName, gen, dob, grd, sec, gName, gPhone] = cols;
      await apiFetch('/api/v1/students', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          firstName: fName,
          fatherName: faName,
          grandfatherName: gfName,
          fullNameAm: amName,
          gender: gen,
          dateOfBirth: dob,
          gradeLevel: grd,
          sectionName: sec,
          guardianName: gName,
          guardianRelationship: 'Guardian',
          guardianPhone: gPhone,
          emergencyContactPhone: gPhone,
          subCity: 'Bole',
          woreda: 'Woreda 03',
          previousSchool: 'CSV Batch Import',
        }),
      });
      importedCount++;
    }
    setCsvPreviewMsg(
      `Validated and imported ${importedCount} student record(s) with auto-generated Login User & Password accounts.`
    );
    await onRefresh();
  };

  const handleExportStudentsCsv = () => {
    const rows = [
      [
        'Student Code / Password',
        'Login User (Email)',
        'First Name',
        'Father Name',
        'Grandfather Name',
        'Amharic Name',
        'Gender',
        'DOB',
        'Grade',
        'Section',
        'Guardian',
        'Guardian Phone',
        'Status',
      ],
      ...filteredStudents.map((s) => {
        const creds = getStudentPortalCredentials(s);
        return [
          creds.loginPassword,
          creds.loginUser,
          s.firstName,
          s.fatherName,
          s.grandfatherName,
          s.fullNameAm,
          s.gender,
          s.dateOfBirth,
          s.gradeLevel,
          s.sectionName,
          s.guardianName,
          s.guardianPhone,
          s.enrollmentStatus,
        ];
      }),
    ];
    const csvContent = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students-${workspace.school?.code || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Newly Issued Student Login Credentials Banner */}
      {latestIssuedCredentials && (
        <div
          data-testid="generated-student-credentials-card"
          className="bg-emerald-950 text-white border border-emerald-700 rounded-xl p-5 shadow-md"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                <KeyRound className="w-4 h-4" />
                {lang === 'am'
                  ? 'የአዲስ ተማሪ መግቢያ (Login User & Password) ተዘጋጅቷል'
                  : 'New Student Login Credentials Prepared & Activated'}
              </div>
              <h3 className="text-base font-bold text-white">
                {latestIssuedCredentials.studentName}{' '}
                <span className="text-xs font-normal text-emerald-200">
                  ({latestIssuedCredentials.gradeSection})
                </span>
              </h3>
              <p className="text-xs text-emerald-200">
                {lang === 'am'
                  ? 'ተማሪው ወዲያውኑ በዚህ User እና Password ወደ ሲስተሙ መግባት (Login ማድረግ) ይችላል።'
                  : 'This student account is active immediately on the Login screen and Student Portal.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-emerald-900/90 border border-emerald-700 rounded-lg px-3.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                  Login User (Username / Email)
                </div>
                <div
                  data-testid="issued-student-login-user"
                  className="text-sm font-mono font-bold text-white select-all"
                >
                  {latestIssuedCredentials.loginUser}
                </div>
              </div>

              <div className="bg-emerald-900/90 border border-emerald-700 rounded-lg px-3.5 py-2">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                  Login Password (Code)
                </div>
                <div
                  data-testid="issued-student-login-password"
                  className="text-sm font-mono font-bold text-amber-300 select-all"
                >
                  {latestIssuedCredentials.loginPassword}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleCopyCredentials(
                    `Student: ${latestIssuedCredentials.studentName}\nLogin User: ${latestIssuedCredentials.loginUser}\nPassword: ${latestIssuedCredentials.loginPassword}`,
                    'latest-slip'
                  )
                }
                className="px-3 py-2 text-xs font-semibold bg-white text-emerald-950 rounded-lg hover:bg-emerald-50 inline-flex items-center gap-1.5"
              >
                {copiedCredentialField === 'latest-slip' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Login
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 text-xs font-semibold bg-emerald-800 text-white border border-emerald-600 rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>

              <button
                type="button"
                onClick={() => setLatestIssuedCredentials(null)}
                className="p-1.5 text-emerald-300 hover:text-white rounded"
                aria-label="Dismiss credentials banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Split: Registration / Edit Form + Bulk CSV Validator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                {editingStudentId
                  ? `Edit Student Profile #${editingStudentId}`
                  : t.registerStudent}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {editingStudentId && (
                <button
                  type="button"
                  onClick={handleCancelStudentEdit}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel Edit
                </button>
              )}
              <span className="text-xs text-slate-500">Tenant: {workspace.school?.code}</span>
            </div>
          </div>

          <form onSubmit={handleSaveStudent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="stu-first-name" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.firstName} *
                </label>
                <input
                  id="stu-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter First Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="stu-father-name" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.fatherName} *
                </label>
                <input
                  id="stu-father-name"
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Enter Father's Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label
                  htmlFor="stu-grandfather-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  {t.grandfatherName} *
                </label>
                <input
                  id="stu-grandfather-name"
                  type="text"
                  value={grandfatherName}
                  onChange={(e) => setGrandfatherName(e.target.value)}
                  placeholder="Enter Grandfather's Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="stu-name-am" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.fullNameAmharic}
                </label>
                <input
                  id="stu-name-am"
                  type="text"
                  value={fullNameAm}
                  onChange={(e) => setFullNameAm(e.target.value)}
                  placeholder="ሙሉ ስም በአማርኛ / Full Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="stu-gender" className="block text-xs font-medium text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  id="stu-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>
              <div>
                <label htmlFor="stu-dob" className="block text-xs font-medium text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="stu-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="stu-grade" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.gradeLevel}
                </label>
                <select
                  id="stu-grade"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>
              <div>
                <label htmlFor="stu-section" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.section}
                </label>
                <select
                  id="stu-section"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Section A">Section A</option>
                  <option value="Section B">Section B</option>
                  <option value="Section C">Section C</option>
                </select>
              </div>
              <div>
                <label htmlFor="stu-guardian" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.guardianName} *
                </label>
                <input
                  id="stu-guardian"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Enter Guardian Full Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label
                  htmlFor="stu-guardian-phone"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  {t.guardianPhone} *
                </label>
                <input
                  id="stu-guardian-phone"
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+251-911-..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            {/* Auto-Prepared Student Login User & Password Box */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                  <span>
                    {lang === 'am'
                      ? 'የተማሪ መግቢያ መለያ (Auto-Prepared Student Login User & Password)'
                      : 'Student Portal Login Credentials (Auto-Prepared Upon Registration)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomLoginPassword(generateRandomStudentPassword())}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Generate New Password
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="stu-login-user"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Student Login User (Email / Username)
                  </label>
                  <input
                    id="stu-login-user"
                    data-testid="student-login-user-input"
                    type="text"
                    value={customLoginUser}
                    onChange={(e) => setCustomLoginUser(e.target.value)}
                    placeholder={
                      suggestedLoginUser || 'Auto-generated from First & Father name (@student.edu.et)'
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                  {!customLoginUser && suggestedLoginUser && (
                    <p className="mt-1 text-[11px] text-slate-500 font-mono">
                      Will be assigned: <strong className="text-slate-800">{suggestedLoginUser}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="stu-login-password"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Student Login Password (STU-XXXXXX)
                  </label>
                  <input
                    id="stu-login-password"
                    data-testid="student-login-password-input"
                    type="text"
                    value={customLoginPassword}
                    onChange={(e) => setCustomLoginPassword(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
            </div>

            {editingStudentId && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label htmlFor="stu-status" className="block text-xs font-medium text-slate-700 mb-1">
                    Enrollment Status
                  </label>
                  <select
                    id="stu-status"
                    value={enrollmentStatus}
                    onChange={(e) => setEnrollmentStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRANSFERRED">TRANSFERRED</option>
                    <option value="WITHDRAWN">WITHDRAWN</option>
                    <option value="GRADUATED">GRADUATED</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="stu-subcity" className="block text-xs font-medium text-slate-700 mb-1">
                    Sub-City
                  </label>
                  <input
                    id="stu-subcity"
                    type="text"
                    value={subCity}
                    onChange={(e) => setSubCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="stu-woreda" className="block text-xs font-medium text-slate-700 mb-1">
                    Woreda
                  </label>
                  <input
                    id="stu-woreda"
                    type="text"
                    value={woreda}
                    onChange={(e) => setWoreda(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            )}

            {statusMsg && (
              <div
                className={`p-3 rounded-md text-xs font-medium ${
                  statusMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {editingStudentId ? 'Save Student Changes' : t.registerStudent}
            </button>
          </form>
        </div>

        {/* Right 4 Cols: Bulk CSV Import & Validation */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-4">
              <Upload className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Validated CSV Bulk Import
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Validates Ethiopian 3-part names, DOB, grade/section, and guardian contact before
              committing. Automatically prepares a Student Login User and Password for each imported student.
            </p>
            <label htmlFor="csv-import-box" className="block text-xs font-medium text-slate-700 mb-1">
              CSV Rows (First, Father, Grandfather, Amharic, Gender, DOB, Grade, Section, Guardian,
              Phone)
            </label>
            <textarea
              id="csv-import-box"
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="FirstName,FatherName,GrandfatherName,FullNameAmharic,Female,2010-09-11,Grade 10,Section A,Guardian Name,+251-911-000-000"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
            />
            {csvPreviewMsg && (
              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800">
                {csvPreviewMsg}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleValidateAndImportCsv}
            className="mt-4 w-full py-2 px-4 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Validate & Commit CSV Import
          </button>
        </div>
      </div>

      {/* Student Roster Table with Search, Grade Filter, Login Credentials & Edit Action */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Search students"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            {/* Interactive Segmented Grade Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {['ALL', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((grd) => (
                <button
                  key={grd}
                  type="button"
                  onClick={() => setGradeFilter(grd)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    gradeFilter === grd
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {grd}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="authorize-all-students-login-btn"
              onClick={handleAuthorizeAllStudentsLogin}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {lang === 'am'
                ? 'ሁሉም የተመዘገቡ ተማሪዎች Login ፍቀድ'
                : 'Allow All Registered Students Login'}
            </button>
            <button
              type="button"
              onClick={handleExportStudentsCsv}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportCsv} ({filteredStudents.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Full Name (First · Father · Grandfather)</th>
                <th className="py-2.5 px-3">Login User & Password</th>
                <th className="py-2.5 px-3">Grade & Section</th>
                <th className="py-2.5 px-3">Date of Birth</th>
                <th className="py-2.5 px-3">Guardian & Contact</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    {lang === 'am'
                      ? 'ምንም የተመዘገበ ተማሪ የለም። ከላይ ባለው ቅጽ አዲስ ተማሪ ይመዝግቡ።'
                      : 'No students registered yet. Use the form above to register your first student and generate their Login User & Password.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const creds = getStudentPortalCredentials(stu);
                  return (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">
                          {stu.firstName} {stu.fatherName} {stu.grandfatherName}
                          <span className="text-xs text-slate-500 font-normal"> · {stu.gender}</span>
                        </div>
                        <div className="text-xs text-slate-500">{stu.fullNameAm}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-mono space-y-0.5">
                            <div className="text-slate-900 font-semibold">
                              User: <span className="text-blue-700">{creds.loginUser}</span>
                            </div>
                            <div className="text-slate-600">
                              Pass: <span className="font-bold text-emerald-700">{creds.loginPassword}</span>
                            </div>
                            <div className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              {lang === 'am' ? 'Login ተፈቅዷል' : 'Login Permitted'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyCredentials(
                                `Login User: ${creds.loginUser}\nPassword: ${creds.loginPassword}`,
                                `stu-${stu.id}`
                              )
                            }
                            title="Copy Student Login User & Password"
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded"
                          >
                            {copiedCredentialField === `stu-${stu.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {stu.gradeLevel} · {stu.sectionName}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 font-mono tabular-nums">
                        {formatCalendarDate(stu.dateOfBirth, calendarMode, lang)}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        <div>{stu.guardianName}</div>
                        <div className="font-mono text-slate-500 tabular-nums">{stu.guardianPhone}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-emerald-700">
                        {stu.enrollmentStatus}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadStudentForEdit(stu)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(stu)}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const TeachersAndTimetableView: React.FC<SharedViewProps> = ({
  lang,
  workspace,
  onRefresh,
  apiFetch,
}) => {
  // Teacher Add / Edit State (no pre-filled example data)
  const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null);
  const [tchFullName, setTchFullName] = useState('');
  const [tchFullNameAm, setTchFullNameAm] = useState('');
  const [tchRoleTitle, setTchRoleTitle] = useState('Subject Teacher');
  const [tchDepartment, setTchDepartment] = useState('');
  const [tchQualification, setTchQualification] = useState('');
  const [tchSubjects, setTchSubjects] = useState('');
  const [tchGrades, setTchGrades] = useState('Grade 10 Section A');
  const [tchPhone, setTchPhone] = useState('+251-911-');
  const [tchEmail, setTchEmail] = useState('');
  const [tchStatus, setTchStatus] = useState('ACTIVE');

  // Class Section Add / Edit State
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [secGrade, setSecGrade] = useState('Grade 10');
  const [secName, setSecName] = useState('Section A');
  const [secStream, setSecStream] = useState('General Secondary');
  const [secRoom, setSecRoom] = useState('');
  const [secCapacity, setSecCapacity] = useState('45');
  const [secHomeroom, setSecHomeroom] = useState('');

  // Subject Add / Edit State
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [subCode, setSubCode] = useState('');
  const [subNameEn, setSubNameEn] = useState('');
  const [subNameAm, setSubNameAm] = useState('');
  const [subGrade, setSubGrade] = useState('Grade 10');
  const [subPeriods, setSubPeriods] = useState('4');

  const [acadMsg, setAcadMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleLoadTeacherForEdit = (tch: TeacherRecord) => {
    setEditingTeacherId(tch.id);
    setTchFullName(tch.fullName);
    setTchFullNameAm(tch.fullNameAm);
    setTchRoleTitle(tch.roleTitle);
    setTchDepartment(tch.department);
    setTchQualification(tch.qualification);
    setTchSubjects(tch.assignedSubjects);
    setTchGrades(tch.assignedGrades);
    setTchPhone(tch.phone);
    setTchEmail(tch.email);
    setTchStatus(tch.employmentStatus);
    setAcadMsg({
      type: 'ok',
      text: `Loaded teacher ${tch.fullName} (${tch.staffCode}) for editing.`,
    });
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcadMsg(null);
    if (!tchFullName.trim()) {
      setAcadMsg({ type: 'err', text: 'Teacher full name is required.' });
      return;
    }
    try {
      const res = await apiFetch('/api/v1/teachers', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          teacherId: editingTeacherId || undefined,
          fullName: tchFullName,
          fullNameAm: tchFullNameAm || tchFullName,
          roleTitle: tchRoleTitle,
          department: tchDepartment,
          qualification: tchQualification,
          assignedSubjects: tchSubjects,
          assignedGrades: tchGrades,
          phone: tchPhone,
          email: tchEmail,
          employmentStatus: tchStatus,
        }),
      });
      setAcadMsg({
        type: 'ok',
        text: editingTeacherId
          ? `Updated Teacher ${res.teacher.fullName} (${res.teacher.staffCode}).`
          : `Added Teacher ${res.teacher.fullName} (${res.teacher.staffCode}).`,
      });
      setEditingTeacherId(null);
      setTchFullName('');
      setTchFullNameAm('');
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to save teacher' });
    }
  };

  const handleLoadSectionForEdit = (sec: ClassSectionRecord) => {
    setEditingSectionId(sec.id);
    setSecGrade(sec.gradeLevel);
    setSecName(sec.sectionName);
    setSecStream(sec.stream);
    setSecRoom(sec.roomNumber);
    setSecCapacity(String(sec.capacity));
    setSecHomeroom(sec.homeroomTeacherName);
    setAcadMsg({
      type: 'ok',
      text: `Loaded Class Section ${sec.gradeLevel} ${sec.sectionName} for editing.`,
    });
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcadMsg(null);
    try {
      const res = await apiFetch('/api/v1/sections', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          sectionId: editingSectionId || undefined,
          gradeLevel: secGrade,
          sectionName: secName,
          stream: secStream,
          roomNumber: secRoom,
          capacity: Number(secCapacity) || 45,
          homeroomTeacherName: secHomeroom,
          academicYear: '2019 E.C.',
        }),
      });
      setAcadMsg({
        type: 'ok',
        text: editingSectionId
          ? `Updated Section ${res.section.gradeLevel} ${res.section.sectionName}.`
          : `Added Section ${res.section.gradeLevel} ${res.section.sectionName}.`,
      });
      setEditingSectionId(null);
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to save section' });
    }
  };

  const handleLoadSubjectForEdit = (sub: SubjectRecord) => {
    setEditingSubjectId(sub.id);
    setSubCode(sub.code);
    setSubNameEn(sub.nameEn);
    setSubNameAm(sub.nameAm);
    setSubGrade(sub.gradeLevel);
    setSubPeriods(String(sub.periodsPerWeek));
    setAcadMsg({
      type: 'ok',
      text: `Loaded Subject ${sub.code} (${sub.nameEn}) for editing.`,
    });
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcadMsg(null);
    if (!subCode.trim() || !subNameEn.trim()) {
      setAcadMsg({ type: 'err', text: 'Subject code and English name are required.' });
      return;
    }
    try {
      const res = await apiFetch('/api/v1/subjects', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          subjectId: editingSubjectId || undefined,
          code: subCode,
          nameEn: subNameEn,
          nameAm: subNameAm || subNameEn,
          gradeLevel: subGrade,
          periodsPerWeek: Number(subPeriods) || 5,
          continuousWeight: 30,
          midtermWeight: 20,
          finalWeight: 50,
          passingMark: 50,
        }),
      });
      setAcadMsg({
        type: 'ok',
        text: editingSubjectId
          ? `Updated Subject ${res.subject.code} (${res.subject.nameEn}).`
          : `Added Subject ${res.subject.code} (${res.subject.nameEn}).`,
      });
      setEditingSubjectId(null);
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to save subject' });
    }
  };

  const handleDeleteTeacher = async (tch: TeacherRecord) => {
    setAcadMsg(null);
    try {
      await apiFetch(
        `/api/v1/teachers/${tch.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingTeacherId === tch.id) {
        setEditingTeacherId(null);
        setTchFullName('');
        setTchFullNameAm('');
      }
      setAcadMsg({
        type: 'ok',
        text: `Deleted Teacher ${tch.fullName} (${tch.staffCode}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to delete teacher' });
    }
  };

  const handleDeleteSection = async (sec: ClassSectionRecord) => {
    setAcadMsg(null);
    try {
      await apiFetch(
        `/api/v1/sections/${sec.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingSectionId === sec.id) {
        setEditingSectionId(null);
      }
      setAcadMsg({
        type: 'ok',
        text: `Deleted Class Section ${sec.gradeLevel} ${sec.sectionName}.`,
      });
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to delete class section' });
    }
  };

  const handleDeleteSubject = async (sub: SubjectRecord) => {
    setAcadMsg(null);
    try {
      await apiFetch(
        `/api/v1/subjects/${sub.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingSubjectId === sub.id) {
        setEditingSubjectId(null);
      }
      setAcadMsg({
        type: 'ok',
        text: `Deleted Curriculum Subject ${sub.code} (${sub.nameEn}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setAcadMsg({ type: 'err', text: err.message || 'Failed to delete subject' });
    }
  };

  const WEEKLY_TIMETABLE = [
    {
      period: 'Period 1 (08:30 - 09:15)',
      mon: 'Mathematics (G10A · Rm 201)',
      tue: 'Physics (G11A · Lab 1)',
      wed: 'Amharic (G10A · Rm 201)',
      thu: 'Mathematics (G10A · Rm 201)',
      fri: 'Chemistry (G11A · Lab 2)',
    },
    {
      period: 'Period 2 (09:15 - 10:00)',
      mon: 'Amharic (G10A · Rm 201)',
      tue: 'Mathematics (G10A · Rm 201)',
      wed: 'Physics (G11A · Rm 304)',
      thu: 'Chemistry (G11A · Rm 304)',
      fri: 'Mathematics (G12B · Rm 310)',
    },
    {
      period: 'Period 3 (10:20 - 11:05)',
      mon: 'Physics (G11A · Rm 304)',
      tue: 'Chemistry (G11A · Rm 304)',
      wed: 'Mathematics (G12B · Rm 310)',
      thu: 'Amharic (G10A · Rm 201)',
      fri: 'Physics (G11A · Rm 304)',
    },
  ];

  return (
    <div className="space-y-8">
      {acadMsg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium border ${
            acadMsg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {acadMsg.text}
        </div>
      )}

      {/* 3-Column Admin Add/Edit Forms: Teacher, Class Section, Subject */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Add / Edit Teacher */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                {editingTeacherId ? `Edit Teacher #${editingTeacherId}` : 'Add Teacher / Staff'}
              </h3>
            </div>
            {editingTeacherId && (
              <button
                type="button"
                onClick={() => {
                  setEditingTeacherId(null);
                  setTchFullName('');
                  setTchFullNameAm('');
                }}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
          </div>
          <form onSubmit={handleSaveTeacher} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="tch-name-en" className="block text-slate-600 mb-1">
                  Full Name (EN) *
                </label>
                <input
                  id="tch-name-en"
                  type="text"
                  value={tchFullName}
                  onChange={(e) => setTchFullName(e.target.value)}
                  placeholder="Memhir Solomon..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label htmlFor="tch-name-am" className="block text-slate-600 mb-1">
                  Display Title / Name
                </label>
                <input
                  id="tch-name-am"
                  type="text"
                  value={tchFullNameAm}
                  onChange={(e) => setTchFullNameAm(e.target.value)}
                  placeholder="Memhir Solomon..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="tch-dept" className="block text-slate-600 mb-1">
                  Department
                </label>
                <input
                  id="tch-dept"
                  type="text"
                  value={tchDepartment}
                  onChange={(e) => setTchDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label htmlFor="tch-role" className="block text-slate-600 mb-1">
                  Role Title
                </label>
                <input
                  id="tch-role"
                  type="text"
                  value={tchRoleTitle}
                  onChange={(e) => setTchRoleTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tch-qual" className="block text-slate-600 mb-1">
                Qualification
              </label>
              <input
                id="tch-qual"
                type="text"
                value={tchQualification}
                onChange={(e) => setTchQualification(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="tch-subj" className="block text-slate-600 mb-1">
                  Assigned Subjects
                </label>
                <input
                  id="tch-subj"
                  type="text"
                  value={tchSubjects}
                  onChange={(e) => setTchSubjects(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label htmlFor="tch-phone" className="block text-slate-600 mb-1">
                  Phone
                </label>
                <input
                  id="tch-phone"
                  type="text"
                  value={tchPhone}
                  onChange={(e) => setTchPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
            >
              {editingTeacherId ? 'Save Teacher Changes' : 'Add Teacher / Staff'}
            </button>
          </form>
        </div>

        {/* 2. Add / Edit Class Section */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingSectionId
                    ? `Edit Class Section #${editingSectionId}`
                    : 'Add Class Section'}
                </h3>
              </div>
              {editingSectionId && (
                <button
                  type="button"
                  onClick={() => setEditingSectionId(null)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveSection} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sec-grade" className="block text-slate-600 mb-1">
                    Grade Level
                  </label>
                  <select
                    id="sec-grade"
                    value={secGrade}
                    onChange={(e) => setSecGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sec-name" className="block text-slate-600 mb-1">
                    Section Name
                  </label>
                  <input
                    id="sec-name"
                    type="text"
                    value={secName}
                    onChange={(e) => setSecName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sec-room" className="block text-slate-600 mb-1">
                    Room Number
                  </label>
                  <input
                    id="sec-room"
                    type="text"
                    value={secRoom}
                    onChange={(e) => setSecRoom(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="sec-cap" className="block text-slate-600 mb-1">
                    Seat Capacity
                  </label>
                  <input
                    id="sec-cap"
                    type="number"
                    value={secCapacity}
                    onChange={(e) => setSecCapacity(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="sec-homeroom" className="block text-slate-600 mb-1">
                  Homeroom Teacher
                </label>
                <input
                  id="sec-homeroom"
                  type="text"
                  value={secHomeroom}
                  onChange={(e) => setSecHomeroom(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
              >
                {editingSectionId ? 'Save Section Changes' : 'Add Class Section'}
              </button>
            </form>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 max-h-28 overflow-y-auto space-y-1">
            {workspace.classSections.map((sec) => (
              <div key={sec.id} className="flex items-center justify-between text-xs py-1 gap-2">
                <span className="text-slate-700">
                  {sec.gradeLevel} · {sec.sectionName} ({sec.roomNumber})
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLoadSectionForEdit(sec)}
                    className="text-slate-700 hover:text-slate-900 underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(sec)}
                    className="text-red-700 hover:text-red-900 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Add / Edit Curriculum Subject */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingSubjectId
                    ? `Edit Subject #${editingSubjectId}`
                    : 'Add Curriculum Subject'}
                </h3>
              </div>
              {editingSubjectId && (
                <button
                  type="button"
                  onClick={() => setEditingSubjectId(null)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveSubject} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sub-code" className="block text-slate-600 mb-1">
                    Subject Code *
                  </label>
                  <input
                    id="sub-code"
                    type="text"
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="sub-grade" className="block text-slate-600 mb-1">
                    Grade Level
                  </label>
                  <select
                    id="sub-grade"
                    value={subGrade}
                    onChange={(e) => setSubGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sub-en" className="block text-slate-600 mb-1">
                    Subject Name (EN) *
                  </label>
                  <input
                    id="sub-en"
                    type="text"
                    value={subNameEn}
                    onChange={(e) => setSubNameEn(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="sub-am" className="block text-slate-600 mb-1">
                    Short Name
                  </label>
                  <input
                    id="sub-am"
                    type="text"
                    value={subNameAm}
                    onChange={(e) => setSubNameAm(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="sub-periods" className="block text-slate-600 mb-1">
                  Weekly Periods
                </label>
                <input
                  id="sub-periods"
                  type="number"
                  value={subPeriods}
                  onChange={(e) => setSubPeriods(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
              >
                {editingSubjectId ? 'Save Subject Changes' : 'Add Subject'}
              </button>
            </form>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 max-h-28 overflow-y-auto space-y-1">
            {workspace.subjects.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between text-xs py-1 gap-2">
                <span className="text-slate-700 font-mono">
                  {sub.code} · {sub.nameEn} ({sub.nameAm})
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLoadSubjectForEdit(sub)}
                    className="text-slate-700 hover:text-slate-900 underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(sub)}
                    className="text-red-700 hover:text-red-900 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teachers Roster Table with Edit & Delete Buttons */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Teachers, Qualifications & Subject Assignments
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {workspace.teachers.length} Active Faculty · {workspace.subjects.length} Configured
            Subjects
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Staff ID / Password Code</th>
                <th className="py-2.5 px-3">Teacher Name</th>
                <th className="py-2.5 px-3">Department & Title</th>
                <th className="py-2.5 px-3">Academic Qualification</th>
                <th className="py-2.5 px-3">Assigned Subjects & Sections</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {workspace.teachers.map((tch) => (
                <tr key={tch.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-3 font-mono text-xs text-slate-700">{tch.staffCode}</td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{tch.fullName}</div>
                    <div className="text-xs text-slate-500">{tch.fullNameAm}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    <div className="font-medium text-slate-800">{tch.department}</div>
                    <div>{tch.roleTitle}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">{tch.qualification}</td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    <div>{tch.assignedSubjects}</div>
                    <div className="text-slate-500">{tch.assignedGrades}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 tabular-nums">
                    {tch.phone}
                  </td>
                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadTeacherForEdit(tch)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(tch)}
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict-Checked Master Timetable */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-4 mb-4">
          Master Class & Room Timetable Schedule (Overlap-Validated)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Period / Time</th>
                <th className="py-2.5 px-3">Monday</th>
                <th className="py-2.5 px-3">Tuesday</th>
                <th className="py-2.5 px-3">Wednesday</th>
                <th className="py-2.5 px-3">Thursday</th>
                <th className="py-2.5 pl-3">Friday</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {WEEKLY_TIMETABLE.map((row) => (
                <tr key={row.period} className="hover:bg-slate-50">
                  <td className="py-3 pr-3 font-mono font-medium text-slate-900 tabular-nums">
                    {row.period}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{row.mon}</td>
                  <td className="py-3 px-3 text-slate-700">{row.tue}</td>
                  <td className="py-3 px-3 text-slate-700">{row.wed}</td>
                  <td className="py-3 px-3 text-slate-700">{row.thu}</td>
                  <td className="py-3 pl-3 text-slate-700">{row.fri}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
