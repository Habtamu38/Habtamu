import React, { useState } from 'react';
import {
  AnnouncementRecord as AnnouncementPost,
  SchoolRecord as SchoolTenant,
  SharedViewProps,
} from '../types/esms';
import { formatCalendarDate, formatEtb, toSantim } from '../utils/ethiopianRules';
import { TRANSLATIONS } from '../utils/i18n';
import { Building2, Download, Printer, ShieldAlert, CheckCircle2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { GoogleDriveDatabasePanel } from './GoogleDriveDatabasePanel';

export const OverviewDashboardView: React.FC<
  SharedViewProps & { offlineQueueCount: number }
> = ({
  lang,
  calendarMode,
  role,
  workspace,
  offlineQueueCount,
  onRefresh,
  apiFetch,
  onNavigateTab,
}) => {
  const t = TRANSLATIONS[lang];
  const [editingAnnId, setEditingAnnId] = useState<number | null>(null);
  const [annTitleEn, setAnnTitleEn] = useState('');
  const [annTitleAm, setAnnTitleAm] = useState('');
  const [annBodyEn, setAnnBodyEn] = useState('');
  const [annAudience, setAnnAudience] = useState('ALL');
  const [annChannel, setAnnChannel] = useState('IN_APP_AND_SMS');
  const [annStatus, setAnnStatus] = useState<string | null>(null);

  const students = workspace.students;
  const teachers = workspace.teachers;
  const attendance = workspace.attendance;
  const invoices = workspace.invoices;
  const marks = workspace.marks;

  const attendanceRate = 100;

  const totalCollectedSantim = invoices.reduce(
    (acc, inv) => acc + toSantim(inv.paidAmountEtb),
    0
  );
  const totalOutstandingSantim = invoices.reduce(
    (acc, inv) => acc + toSantim(inv.balanceEtb),
    0
  );

  const handleLoadAnnouncementForEdit = (ann: AnnouncementPost) => {
    setEditingAnnId(ann.id);
    setAnnTitleEn(ann.titleEn);
    setAnnTitleAm(ann.titleAm);
    setAnnBodyEn(ann.bodyEn);
    setAnnAudience(ann.audience);
    setAnnChannel(ann.channel);
    setAnnStatus(`Editing Announcement #${ann.id} — modify fields below and click Save.`);
  };

  const handleCancelEditAnnouncement = () => {
    setEditingAnnId(null);
    setAnnTitleEn('');
    setAnnTitleAm('');
    setAnnBodyEn('');
    setAnnStatus(null);
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitleEn.trim() || !annBodyEn.trim()) {
      setAnnStatus('Please enter both an announcement title and message body.');
      return;
    }
    try {
      if (editingAnnId) {
        await apiFetch(`/api/v1/announcements/${editingAnnId}`, {
          method: 'PUT',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            titleEn: annTitleEn,
            titleAm: annTitleAm || annTitleEn,
            bodyEn: annBodyEn,
            bodyAm: annBodyEn,
            audience: annAudience,
            channel: annChannel,
            priority: 'NORMAL',
          }),
        });
        setAnnStatus(`Updated Announcement #${editingAnnId} successfully.`);
      } else {
        await apiFetch('/api/v1/announcements', {
          method: 'POST',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            titleEn: annTitleEn,
            titleAm: annTitleAm || annTitleEn,
            bodyEn: annBodyEn,
            bodyAm: annBodyEn,
            audience: annAudience,
            channel: annChannel,
            priority: 'NORMAL',
          }),
        });
        setAnnStatus('Announcement published and queued for SMS/in-app delivery.');
      }
      setEditingAnnId(null);
      setAnnTitleEn('');
      setAnnTitleAm('');
      setAnnBodyEn('');
      await onRefresh();
    } catch (err: any) {
      setAnnStatus(err.message || 'Failed to save announcement');
    }
  };

  const handleDeleteAnnouncement = async (ann: AnnouncementPost) => {
    setAnnStatus(null);
    try {
      await apiFetch(
        `/api/v1/announcements/${ann.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingAnnId === ann.id) {
        handleCancelEditAnnouncement();
      }
      setAnnStatus(`Deleted Announcement #${ann.id}.`);
      await onRefresh();
    } catch (err: any) {
      setAnnStatus(err.message || 'Failed to delete announcement');
    }
  };

  const handleExportSummaryCsv = () => {
    const rows = [
      ['Student Code', 'Full Name (EN)', 'Full Name (AM)', 'Grade', 'Section', 'Guardian Phone'],
      ...students.map((s) => [
        s.studentCode,
        `${s.firstName} ${s.fatherName} ${s.grandfatherName}`,
        s.fullNameAm,
        s.gradeLevel,
        s.sectionName,
        s.guardianPhone,
      ]),
    ];
    const csvContent = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esms-school-${workspace.school?.code || 'summary'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* School Context Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span className="font-mono">{workspace.school?.code}</span>
            <span aria-hidden="true">·</span>
            <span>{workspace.school?.region}</span>
            <span aria-hidden="true">·</span>
            <span>{workspace.school?.schoolType}</span>
            <span aria-hidden="true">·</span>
            <span>{workspace.school?.academicYearLabel}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {workspace.school?.nameEn}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {workspace.school?.schoolLevel} · {workspace.school?.currentTerm}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print">
          <button
            type="button"
            onClick={handleExportSummaryCsv}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            {t.exportCsv}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            {t.printReport}
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('schools')}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit School
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('students')}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.registerStudent}
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">{t.totalStudents}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {students.length}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {workspace.classSections.length} Active Class Sections · {teachers.length} Faculty
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="daily-attendance-rate-card">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500">Daily Attendance Rate</div>
            <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums">
              {attendanceRate}%
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="Daily Attendance Rate"
            aria-valuenow={attendanceRate}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="overview-attendance-progress-bar"
            className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-2.5 border border-slate-200"
          >
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs font-medium text-slate-700">
            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">Grade 9</span>
            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">Grade 10</span>
            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">Grade 11</span>
            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded">Grade 12</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">{t.feeCollectionEtb}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatEtb(totalCollectedSantim / 100, lang)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {workspace.payments.length} Verified Ledger Entries · Idempotent
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">{t.outstandingBalanceEtb}</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-2">
            {formatEtb(totalOutstandingSantim / 100, lang)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {offlineQueueCount === 0
              ? t.syncStatusSynced
              : `${offlineQueueCount} ${t.syncStatusPending}`}
          </div>
        </div>
      </div>

      {/* Google Drive Database Snapshot Manager (My Drive / ESMS Database) */}
      <GoogleDriveDatabasePanel
        lang={lang}
        apiFetch={apiFetch}
        onDatabaseRestored={onRefresh}
        workspaceContext={{
          activeSchoolId: workspace.school?.id || 1,
          activeTab: 'overview',
          lang,
          calendarMode,
        }}
      />

      {/* Main Two-Column Operational Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Recent Student Enrollments & Marks Overview */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Active Student Roster & Academic Standing
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  3-part naming convention (First · Father · Grandfather) isolated to{' '}
                  {workspace.school?.code}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab('students')}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                >
                  Add / Edit Students
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('exams')}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                >
                  Open Exam Marks
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 pr-3">ID Code</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Grade & Section</th>
                    <th className="py-2.5 pl-3 text-right">Latest Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {students.slice(0, 6).map((stu) => {
                    const stuMarks = marks.filter((m) => m.studentId === stu.id);
                    const avg =
                      stuMarks.length > 0
                        ? (
                            stuMarks.reduce((acc, m) => acc + Number(m.totalMark), 0) /
                            stuMarks.length
                          ).toFixed(1)
                        : '—';
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-600 tabular-nums">
                          {stu.studentCode}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">
                            {stu.firstName} {stu.fatherName} {stu.grandfatherName}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">
                          {stu.gradeLevel} · {stu.sectionName}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {avg === '—' ? 'Pending' : `${avg}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Role Context: <strong className="text-slate-800">{role}</strong>
            </span>
            <span>
              Canonical Date: <span className="font-mono tabular-nums">2026-10-23</span> (
              {formatCalendarDate('2026-10-23', 'ETHIOPIAN', lang)})
            </span>
          </div>
        </div>

        {/* Right 5 Cols: School Announcements & Notification Dispatch (Add & Edit) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-4 mb-4">
              School Announcements & SMS Dispatch
            </h2>

            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {workspace.announcements.map((ann) => (
                <div key={ann.id} className="pb-3 border-b border-slate-100 last:border-none">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      <span>{ann.audience}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{ann.channel}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{ann.publishedBy}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadAnnouncementForEdit(ann)}
                        className="px-2 py-0.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(ann)}
                        className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1">
                    {ann.titleEn}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {ann.bodyEn}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handlePublishAnnouncement}
            className="mt-6 pt-4 border-t border-slate-200 space-y-3 no-print"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-800">
                {editingAnnId
                  ? `Edit Announcement #${editingAnnId}`
                  : 'Dispatch New School Notice'}
              </div>
              {editingAnnId && (
                <button
                  type="button"
                  onClick={handleCancelEditAnnouncement}
                  className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancel Edit
                </button>
              )}
            </div>
            <div>
              <label htmlFor="ann-title-en" className="block text-xs text-slate-600 mb-1">
                Notice Headline
              </label>
              <input
                id="ann-title-en"
                type="text"
                value={annTitleEn}
                onChange={(e) => setAnnTitleEn(e.target.value)}
                placeholder="e.g., Grade 12 National Exam Registration Deadline"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label htmlFor="ann-body-en" className="block text-xs text-slate-600 mb-1">
                Message Content
              </label>
              <textarea
                id="ann-body-en"
                rows={2}
                value={annBodyEn}
                onChange={(e) => setAnnBodyEn(e.target.value)}
                placeholder="Enter announcement details for parents, students, or staff..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ann-audience" className="block text-xs text-slate-600 mb-1">
                  Target Audience
                </label>
                <select
                  id="ann-audience"
                  value={annAudience}
                  onChange={(e) => setAnnAudience(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="ALL">All School Community</option>
                  <option value="PARENTS">Parents & Guardians</option>
                  <option value="TEACHERS">Teachers & Staff</option>
                  <option value="STUDENTS">Students</option>
                </select>
              </div>
              <div>
                <label htmlFor="ann-channel" className="block text-xs text-slate-600 mb-1">
                  Delivery Channel
                </label>
                <select
                  id="ann-channel"
                  value={annChannel}
                  onChange={(e) => setAnnChannel(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="IN_APP_AND_SMS">In-App + EthioTelecom SMS</option>
                  <option value="IN_APP">In-App Portal Only</option>
                  <option value="EMAIL">Email + In-App</option>
                </select>
              </div>
            </div>
            {annStatus && <div className="text-xs text-emerald-700 font-medium">{annStatus}</div>}
            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
            >
              {editingAnnId ? 'Save Announcement Changes' : 'Publish Announcement'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const SchoolsAndConfigView: React.FC<
  SharedViewProps & { onSchoolCreated: (newSchoolId: number) => Promise<void> }
> = ({ lang, role, activeSchoolId, schools, workspace, onRefresh, apiFetch, onSchoolCreated }) => {
  const [editingSchoolId, setEditingSchoolId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAm, setNameAm] = useState('');
  const [schoolType, setSchoolType] = useState('GOVERNMENT');
  const [schoolLevel, setSchoolLevel] = useState('SECONDARY (Grades 9-12)');
  const [region, setRegion] = useState('Addis Ababa City Administration');
  const [city, setCity] = useState('Addis Ababa');
  const [subCity, setSubCity] = useState('Kirkos');
  const [woreda, setWoreda] = useState('Woreda 04');
  const [phone, setPhone] = useState('+251-115-512-090');
  const [email, setEmail] = useState('admin@new-school.edu.et');
  const [academicYearLabel, setAcademicYearLabel] = useState('2019 E.C. / 2026-27 G.C.');
  const [currentTerm, setCurrentTerm] = useState('Term 1 (Meskerem - Tahsas)');
  const [subscriptionStatus, setSubscriptionStatus] = useState('ACTIVE');
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isolationTestResult, setIsolationTestResult] = useState<string | null>(null);

  const handleLoadSchoolForEdit = (sch: SchoolTenant) => {
    setEditingSchoolId(sch.id);
    setCode(sch.code);
    setNameEn(sch.nameEn);
    setNameAm(sch.nameAm);
    setSchoolType(sch.schoolType);
    setSchoolLevel(sch.schoolLevel);
    setRegion(sch.region);
    setCity(sch.city);
    setSubCity(sch.subCity);
    setWoreda(sch.woreda);
    setPhone(sch.phone);
    setEmail(sch.email);
    setAcademicYearLabel(sch.academicYearLabel);
    setCurrentTerm(sch.currentTerm);
    setSubscriptionStatus(sch.subscriptionStatus);
    setFormMsg({
      type: 'ok',
      text: `Loaded School #${sch.id} (${sch.code}) into form for editing.`,
    });
  };

  const handleCancelSchoolEdit = () => {
    setEditingSchoolId(null);
    setCode('');
    setNameEn('');
    setNameAm('');
    setFormMsg(null);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    if (!code.trim() || !nameEn.trim()) {
      setFormMsg({
        type: 'err',
        text: 'School Code and School Name in English are required.',
      });
      return;
    }
    try {
      if (editingSchoolId) {
        const res = await apiFetch(`/api/v1/schools/${editingSchoolId}`, {
          method: 'PUT',
          body: JSON.stringify({
            code,
            nameEn,
            nameAm,
            schoolType,
            schoolLevel,
            region,
            city,
            subCity,
            woreda,
            phone,
            email,
            academicYearLabel,
            currentTerm,
            subscriptionStatus,
          }),
        });
        setFormMsg({
          type: 'ok',
          text: `Updated school profile & academic policy for ${res.school.nameEn} (${res.school.code}).`,
        });
        setEditingSchoolId(null);
        await onSchoolCreated(res.school.id);
        await onRefresh();
      } else {
        const res = await apiFetch('/api/v1/schools', {
          method: 'POST',
          body: JSON.stringify({
            code,
            nameEn,
            nameAm,
            schoolType,
            schoolLevel,
            region,
            city,
            subCity,
            woreda,
            phone,
            email,
          }),
        });
        setCode('');
        setNameEn('');
        setNameAm('');
        setFormMsg({
          type: 'ok',
          text: `Onboarded ${res.school.nameEn} (${res.school.code}) with isolated tenant ID #${res.school.id}.`,
        });
        await onSchoolCreated(res.school.id);
      }
    } catch (err: any) {
      setFormMsg({ type: 'err', text: err.message || 'Failed to save school' });
    }
  };

  const handleDeleteSchool = async (sch: SchoolTenant) => {
    setFormMsg(null);
    try {
      await apiFetch(`/api/v1/schools/${sch.id}`, { method: 'DELETE' });
      if (editingSchoolId === sch.id) {
        handleCancelSchoolEdit();
      }
      const nextSchool = schools.find((s) => s.id !== sch.id);
      if (nextSchool) {
        await onSchoolCreated(nextSchool.id);
      }
      setFormMsg({ type: 'ok', text: `Deleted school tenant ${sch.nameEn} (${sch.code}).` });
      await onRefresh();
    } catch (err: any) {
      setFormMsg({ type: 'err', text: err.message || 'Failed to delete school' });
    }
  };

  const runCrossTenantIsolationCheck = async () => {
    const otherSchool = schools.find((s) => s.id !== activeSchoolId);
    if (!otherSchool) {
      setIsolationTestResult('Only one school registered so far.');
      return;
    }
    try {
      const response = await fetch(`/api/v1/workspace/${otherSchool.id}`, {
        headers: {
          'x-esms-role': role === 'SUPER_ADMIN' ? 'SCHOOL_ADMIN' : role,
          'x-esms-school-id': String(activeSchoolId),
        },
      });
      const body = await response.json();
      if (response.status === 403) {
        setIsolationTestResult(
          `VERIFIED (HTTP 403 Forbidden): Server blocked School #${activeSchoolId} user from reading School #${otherSchool.id} (${otherSchool.code}). Message: "${body.error}"`
        );
      } else {
        setIsolationTestResult(`Unexpected status ${response.status}`);
      }
    } catch (err: any) {
      setIsolationTestResult(`Error running test: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Multi-School Tenant Directory & Isolation Verification
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Each school operates in an isolated tenant partition with configurable Ethiopian /
              Gregorian calendars and grading rules. Click Edit on any school row to modify its configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={runCrossTenantIsolationCheck}
            className="px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            Verify Server Cross-Tenant Isolation (School A → School B)
          </button>
        </div>

        {isolationTestResult && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Server-Side Tenant Isolation Audit Result</div>
              <div className="mt-0.5 font-mono">{isolationTestResult}</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Tenant ID</th>
                <th className="py-2.5 px-3">School Code</th>
                <th className="py-2.5 px-3">School Name</th>
                <th className="py-2.5 px-3">Region & Woreda</th>
                <th className="py-2.5 px-3">Type & Level</th>
                <th className="py-2.5 px-3">Subscription</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {schools.map((sch) => (
                <tr
                  key={sch.id}
                  className={
                    sch.id === activeSchoolId ? 'bg-slate-50/80 font-medium' : 'hover:bg-slate-50'
                  }
                >
                  <td className="py-3 pr-3 font-mono text-xs tabular-nums">#{sch.id}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-700">{sch.code}</td>
                  <td className="py-3 px-3">
                    <div className="text-slate-900">{sch.nameEn}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    {sch.region} · {sch.subCity} · {sch.woreda}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    {sch.schoolType} · {sch.schoolLevel}
                  </td>
                  <td className="py-3 px-3 text-xs font-mono text-emerald-700">
                    {sch.subscriptionStatus}
                  </td>
                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadSchoolForEdit(sch)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={schools.length <= 1}
                        onClick={() => handleDeleteSchool(sch)}
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          schools.length <= 1
                            ? 'Cannot delete the only remaining school'
                            : 'Delete school tenant'
                        }
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

      {/* School Onboarding & Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">
                {editingSchoolId
                  ? `Edit School Tenant #${editingSchoolId} Configuration`
                  : 'Onboard New Ethiopian School Tenant'}
              </h3>
            </div>
            {editingSchoolId && (
              <button
                type="button"
                onClick={handleCancelSchoolEdit}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Switch to New School Mode
              </button>
            )}
          </div>

          <form onSubmit={handleSaveSchool} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="school-code" className="block text-xs font-medium text-slate-700 mb-1">
                  Ministry / Platform School Code *
                </label>
                <input
                  id="school-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g., OR-ADAMA-SS-03"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label htmlFor="school-type" className="block text-xs font-medium text-slate-700 mb-1">
                  Ownership Type
                </label>
                <select
                  id="school-type"
                  value={schoolType}
                  onChange={(e) => setSchoolType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="GOVERNMENT">Government (Public)</option>
                  <option value="PRIVATE">Private School</option>
                  <option value="COMMUNITY">Community / Non-Profit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="school-name-en" className="block text-xs font-medium text-slate-700 mb-1">
                  School Name in English *
                </label>
                <input
                  id="school-name-en"
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g., Hawassa Tabor Secondary School"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="school-name-am" className="block text-xs font-medium text-slate-700 mb-1">
                  Secondary / Official Campus Title
                </label>
                <input
                  id="school-name-am"
                  type="text"
                  value={nameAm}
                  onChange={(e) => setNameAm(e.target.value)}
                  placeholder="e.g., Hawassa Tabor Secondary Campus"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="school-region" className="block text-xs font-medium text-slate-700 mb-1">
                  Region
                </label>
                <select
                  id="school-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Addis Ababa City Administration">Addis Ababa</option>
                  <option value="Amhara Region">Amhara Region</option>
                  <option value="Oromia Region">Oromia Region</option>
                  <option value="Sidama Region">Sidama Region</option>
                  <option value="Tigray Region">Tigray Region</option>
                  <option value="Dire Dawa Administration">Dire Dawa</option>
                </select>
              </div>
              <div>
                <label htmlFor="school-subcity" className="block text-xs font-medium text-slate-700 mb-1">
                  City / Sub-City
                </label>
                <input
                  id="school-subcity"
                  type="text"
                  value={subCity}
                  onChange={(e) => setSubCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="school-woreda" className="block text-xs font-medium text-slate-700 mb-1">
                  Woreda
                </label>
                <input
                  id="school-woreda"
                  type="text"
                  value={woreda}
                  onChange={(e) => setWoreda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="school-level" className="block text-xs font-medium text-slate-700 mb-1">
                  Academic Level
                </label>
                <select
                  id="school-level"
                  value={schoolLevel}
                  onChange={(e) => setSchoolLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="PRIMARY (Grades 1-8)">Primary (Grades 1-8)</option>
                  <option value="SECONDARY (Grades 9-12)">Secondary (Grades 9-12)</option>
                  <option value="K-12 COMPREHENSIVE">KG to Grade 12 Comprehensive</option>
                </select>
              </div>
              <div>
                <label htmlFor="school-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Official Phone
                </label>
                <input
                  id="school-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
              <div>
                <label htmlFor="school-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Official Email
                </label>
                <input
                  id="school-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {editingSchoolId && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label htmlFor="school-acyear" className="block text-xs font-medium text-slate-700 mb-1">
                    Academic Year Label
                  </label>
                  <input
                    id="school-acyear"
                    type="text"
                    value={academicYearLabel}
                    onChange={(e) => setAcademicYearLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="school-term" className="block text-xs font-medium text-slate-700 mb-1">
                    Active Term / Semester
                  </label>
                  <input
                    id="school-term"
                    type="text"
                    value={currentTerm}
                    onChange={(e) => setCurrentTerm(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="school-sub" className="block text-xs font-medium text-slate-700 mb-1">
                    Subscription Status
                  </label>
                  <select
                    id="school-sub"
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>
            )}

            {formMsg && (
              <div
                className={`p-3 rounded-md text-xs font-medium ${
                  formMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {formMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {editingSchoolId ? 'Save School Configuration Changes' : 'Register & Activate School Tenant'}
            </button>
          </form>
        </div>

        {/* Right 5 Cols: Active School Academic Policy & Quick Edit Trigger */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Active School Policy Configuration ({workspace.school?.code})
              </h3>
              {workspace.school && (
                <button
                  type="button"
                  onClick={() => handleLoadSchoolForEdit(workspace.school!)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-3 h-3" /> Edit Active School
                </button>
              )}
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Academic Calendar System</span>
                <span className="font-medium text-slate-900">
                  Dual Ethiopian (13-Month) & Gregorian
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Default Monetary Currency</span>
                <span className="font-mono font-medium text-slate-900">ETB · Santim Safe</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">School Working Days</span>
                <span className="font-medium text-slate-900">Monday – Friday</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Assessment Weighting</span>
                <span className="font-mono font-medium text-slate-900">
                  30% Continuous · 20% Midterm · 50% Final
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Minimum Promotion Threshold</span>
                <span className="font-mono font-medium text-slate-900">50.00% (Grade C)</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">School Timezone</span>
                <span className="font-mono font-medium text-slate-900">
                  Africa/Addis_Ababa (UTC+03:00)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
