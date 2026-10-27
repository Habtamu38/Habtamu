import React, { useState } from 'react';
import { OfflineQueuedOperation, SharedViewProps, StudentMarkRecord } from '../types/esms';
import {
  calculateAnnualStudentStanding,
  calculateAssessmentResult,
  DEFAULT_ETHIOPIAN_GRADING_SCALE,
  formatCalendarDate,
  getGradePassFailBadge,
} from '../utils/ethiopianRules';
import { TRANSLATIONS } from '../utils/i18n';
import { CalendarCheck, Award, Printer, WifiOff, Pencil, Trash2 } from 'lucide-react';

export const AttendanceManagementView: React.FC<
  SharedViewProps & {
    onEnqueueOffline: (op: OfflineQueuedOperation) => void;
  }
> = ({
  lang,
  calendarMode,
  workspace,
  onRefresh,
  apiFetch,
  onEnqueueOffline,
}) => {
  const t = TRANSLATIONS[lang];
  const [selectedDate, setSelectedDate] = useState('2026-10-23');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const students = workspace.students.filter(
    (s) => selectedGrade === 'ALL' || s.gradeLevel === selectedGrade
  );

  const getStudentStatusForDate = (studentId: number) => {
    const found = workspace.attendance.find(
      (a) => a.studentId === studentId && a.attendanceDate === selectedDate
    );
    return found?.status || 'UNRECORDED';
  };

  const handleMarkAttendance = async (
    studentId: number,
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    mode: 'CLOUD' | 'OFFLINE_QUEUE'
  ) => {
    setFeedback(null);
    if (mode === 'OFFLINE_QUEUE') {
      const op: OfflineQueuedOperation = {
        operationId: `OP-OFFLINE-ATT-${studentId}-${selectedDate}-${Date.now()}`,
        deviceId: 'LOCAL-CLASSROOM-TABLET-01',
        entityType: 'ATTENDANCE',
        entityId: `${studentId}:${selectedDate}`,
        action: 'UPSERT',
        payload: {
          studentId,
          attendanceDate: selectedDate,
          status,
          remarks: 'Recorded in offline classroom mode',
        },
        versionNumber: 1,
        clientTimestamp: new Date().toISOString(),
      };
      onEnqueueOffline(op);
      setFeedback(
        `Queued ${status} for Student #${studentId} in local offline storage (${op.operationId}). Ready to sync.`
      );
      return;
    }

    try {
      await apiFetch('/api/v1/attendance', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          studentId,
          attendanceDate: selectedDate,
          status,
          remarks: `Updated on ${selectedDate}`,
        }),
      });
      setFeedback(
        `Saved ${status} for Student #${studentId} on ${formatCalendarDate(
          selectedDate,
          calendarMode,
          lang
        )} (Unique constraint enforced).`
      );
      await onRefresh();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to record attendance');
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                {t.navAttendance} · {formatCalendarDate(selectedDate, calendarMode, lang)}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Unique index <span className="font-mono">(school_id, student_id, attendance_date)</span>{' '}
              prevents duplicate attendance entries across cloud and offline retries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="att-date" className="sr-only">
                Attendance Date
              </label>
              <input
                id="att-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {['ALL', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((grd) => (
                <button
                  key={grd}
                  type="button"
                  onClick={() => setSelectedGrade(grd)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedGrade === grd
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {grd}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-emerald-900">Daily Attendance Rate</div>
            <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5">100%</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-900">
            <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md">Grade 9 · 100%</span>
            <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md">Grade 10 · 100%</span>
            <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md">Grade 11 · 100%</span>
            <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-md">Grade 12 · 100%</span>
          </div>
        </div>

        {feedback && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 font-medium">
            {feedback}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Student ID</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Grade & Section</th>
                <th className="py-2.5 px-3">Current Status</th>
                <th className="py-2.5 px-3">Mark Attendance (Cloud DB)</th>
                <th className="py-2.5 pl-3 text-right">Offline Queue Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {students.map((stu) => {
                const currentStatus = getStudentStatusForDate(stu.id);
                return (
                  <tr key={stu.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-mono text-xs text-slate-700 tabular-nums">
                      {stu.studentCode}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">
                        {stu.firstName} {stu.fatherName} {stu.grandfatherName}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      {stu.gradeLevel} · {stu.sectionName}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs font-semibold">
                      <span
                        className={
                          currentStatus === 'PRESENT'
                            ? 'text-emerald-700'
                            : currentStatus === 'ABSENT'
                            ? 'text-red-700'
                            : currentStatus === 'LATE'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }
                      >
                        {currentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleMarkAttendance(stu.id, st, 'CLOUD')}
                            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                              currentStatus === st
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleMarkAttendance(stu.id, 'PRESENT', 'OFFLINE_QUEUE')}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <WifiOff className="w-3 h-3" />
                        Queue Offline
                      </button>
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

export const ExaminationsAndResultsView: React.FC<SharedViewProps> = ({
  lang,
  workspace,
  onRefresh,
  apiFetch,
}) => {
  const defaultStudentWithMarks =
    workspace.students.find((s) => workspace.marks.some((m) => m.studentId === s.id)) ||
    workspace.students.find((s) => s.studentCode === 'STU-482910') ||
    workspace.students[0];
  const [selectedStudentId, setSelectedStudentId] = useState<number>(
    defaultStudentWithMarks?.id || 1
  );
  const [subjectCode, setSubjectCode] = useState('MATH-10');
  const [continuousMark, setContinuousMark] = useState('27');
  const [midtermMark, setMidtermMark] = useState('18');
  const [finalMark, setFinalMark] = useState('44');
  const [markMsg, setMarkMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selectedStudent =
    workspace.students.find((s) => s.id === selectedStudentId) ||
    defaultStudentWithMarks ||
    workspace.students[0];

  const subjectLookup: Record<string, { en: string; am: string }> = {
    'MATH-10': { en: 'Mathematics', am: 'Mathematics' },
    'AMH-10': { en: 'Language & Literature', am: 'Language & Literature' },
    'PHY-11': { en: 'Physics', am: 'Physics' },
    'CHEM-11': { en: 'Chemistry', am: 'Chemistry' },
    'ENG-09': { en: 'English for Ethiopia', am: 'English for Ethiopia' },
  };
  workspace.subjects.forEach((s) => {
    subjectLookup[s.code] = { en: s.nameEn, am: s.nameEn };
  });

  let livePreviewResult = null;
  let livePreviewError: string | null = null;
  try {
    livePreviewResult = calculateAssessmentResult({
      continuousMark: Number(continuousMark),
      midtermMark: Number(midtermMark),
      finalMark: Number(finalMark),
    });
  } catch (err: any) {
    livePreviewError = err.message;
  }

  const handleLoadMarkForEdit = (mk: StudentMarkRecord) => {
    setSelectedStudentId(mk.studentId);
    setSubjectCode(mk.subjectCode);
    setContinuousMark(String(mk.continuousMark));
    setMidtermMark(String(mk.midtermMark));
    setFinalMark(String(mk.finalMark));
    setMarkMsg({
      type: 'ok',
      text: `Loaded ${mk.subjectCode} (${mk.subjectNameEn}) marks for editing — adjust values and click Validate & Publish Result.`,
    });
  };

  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setMarkMsg(null);
    if (livePreviewError) {
      setMarkMsg({ type: 'err', text: livePreviewError });
      return;
    }
    const subj = subjectLookup[subjectCode] || { en: subjectCode, am: subjectCode };
    try {
      const res = await apiFetch('/api/v1/examinations/marks', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          studentId: selectedStudent?.id,
          subjectCode,
          subjectNameEn: subj.en,
          subjectNameAm: subj.am,
          academicYear: '2019 E.C.',
          term: 'Term 1',
          continuousMark: Number(continuousMark),
          midtermMark: Number(midtermMark),
          finalMark: Number(finalMark),
          status: 'PUBLISHED',
        }),
      });
      setMarkMsg({
        type: 'ok',
        text: `Validated & saved ${subj.en}: Total ${res.mark.totalMark}% (${res.mark.gradeLetter}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setMarkMsg({ type: 'err', text: err.message || 'Failed to save mark' });
    }
  };

  const handleDeleteMark = async (mk: StudentMarkRecord) => {
    setMarkMsg(null);
    try {
      await apiFetch(
        `/api/v1/examinations/marks/${mk.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      setMarkMsg({
        type: 'ok',
        text: `Deleted examination mark for ${mk.subjectNameEn} (${mk.subjectCode}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setMarkMsg({ type: 'err', text: err.message || 'Failed to delete mark' });
    }
  };

  const studentReportMarks = workspace.marks.filter(
    (m) => m.studentId === selectedStudent?.id
  );
  const annualStanding = calculateAnnualStudentStanding(studentReportMarks);

  return (
    <div className="space-y-6">
      {/* Examinations View Toolbar with Print Report Button */}
      <div
        data-testid="examinations-view-toolbar"
        className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {lang === 'am'
              ? 'የፈተና ውጤቶች እና የሪፖርት ካርድ (Examinations & Report Cards)'
              : 'Examinations & Official Student Report Cards'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {lang === 'am'
              ? 'የተከታታይ ምዘና (30%)፣ አጋማሽ ፈተና (20%) እና ማጠቃለያ ፈተና (50%) ውጤቶች'
              : 'Continuous Assessment (30%), Midterm (20%), and Final Exam (50%) weighted grading'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="examinations-print-report-btn"
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-report-grid">
        {/* Left 5 Cols: Mark Entry & Edit Form with Max-Weight Validation */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 no-print">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-4">
            <Award className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Examination & Assessment Mark Entry / Edit
            </h2>
          </div>

          <form onSubmit={handleSaveMark} className="space-y-4">
            <div>
              <label htmlFor="exam-student" className="block text-xs font-medium text-slate-700 mb-1">
                Select Student
              </label>
              <select
                id="exam-student"
                value={selectedStudent?.id || ''}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {workspace.students.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.studentCode} — {stu.firstName} {stu.fatherName} {stu.grandfatherName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="exam-subject" className="block text-xs font-medium text-slate-700 mb-1">
                Subject
              </label>
              <select
                id="exam-subject"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {Object.entries(subjectLookup).map(([codeKey, labels]) => (
                  <option key={codeKey} value={codeKey}>
                    {codeKey} · {labels.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="mark-cont" className="block text-xs font-medium text-slate-700 mb-1">
                  Continuous (Max 30)
                </label>
                <input
                  id="mark-cont"
                  type="number"
                  step="0.5"
                  value={continuousMark}
                  onChange={(e) => setContinuousMark(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="mark-mid" className="block text-xs font-medium text-slate-700 mb-1">
                  Midterm (Max 20)
                </label>
                <input
                  id="mark-mid"
                  type="number"
                  step="0.5"
                  value={midtermMark}
                  onChange={(e) => setMidtermMark(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="mark-final" className="block text-xs font-medium text-slate-700 mb-1">
                  Final Exam (Max 50)
                </label>
                <input
                  id="mark-final"
                  type="number"
                  step="0.5"
                  value={finalMark}
                  onChange={(e) => setFinalMark(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Live Weighted Calculation Preview */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs">
              {livePreviewError ? (
                <div className="text-red-700 font-medium">{livePreviewError}</div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500">Weighted Total: </span>
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {livePreviewResult?.totalMark} / 100
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Grade: </span>
                    <strong className="font-mono text-emerald-700">
                      {livePreviewResult?.gradeLetter} ({livePreviewResult?.labelEn})
                    </strong>
                    {livePreviewResult && (() => {
                      const badge = getGradePassFailBadge(livePreviewResult.totalMark);
                      return (
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
                            badge.passed
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-red-100 text-red-900 border-red-300'
                          }`}
                        >
                          {badge.badgeLabel}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {markMsg && (
              <div
                className={`p-3 rounded-md text-xs font-medium ${
                  markMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {markMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Validate & Publish Result
            </button>
          </form>

          {/* School Grading Scale Reference */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Configured Grading Scale
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
              {DEFAULT_ETHIOPIAN_GRADING_SCALE.map((g) => (
                <div key={g.letter} className="flex justify-between font-mono">
                  <span>
                    {g.letter} (≥{g.minPercentage}%)
                  </span>
                  <span>{g.labelEn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Official Student Report Card with 1-Click Edit */}
        <div
          data-testid="student-results-report-sheet"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 print-report-sheet print-student-results"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <div>
              <div className="text-xs text-slate-500">{workspace.school?.nameEn}</div>
              <h3 className="text-base font-bold text-slate-900">
                Official Student Report Card
              </h3>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="print-student-results-pdf-btn"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 no-print whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Official PDF Report Card
            </button>
          </div>

          {selectedStudent && (
            <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Student Name</div>
                <div className="font-semibold text-slate-900">
                  {selectedStudent.firstName} {selectedStudent.fatherName}{' '}
                  {selectedStudent.grandfatherName}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Student ID</div>
                <div className="font-mono font-semibold text-slate-900 tabular-nums">
                  {selectedStudent.studentCode}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Class & Section</div>
                <div className="font-semibold text-slate-900">
                  {selectedStudent.gradeLevel} · {selectedStudent.sectionName}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Academic Year</div>
                <div className="font-semibold text-slate-900">2019 E.C. · Term 1</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print-report-table">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-2">Code</th>
                  <th className="py-2.5 px-2">Subject</th>
                  <th className="py-2.5 px-2 text-right">Cont. (30)</th>
                  <th className="py-2.5 px-2 text-right">Mid (20)</th>
                  <th className="py-2.5 px-2 text-right">Final (50)</th>
                  <th className="py-2.5 px-2 text-right">Final Grade &amp; Status</th>
                  <th className="py-2.5 pl-2 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {studentReportMarks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                      No published marks for this student yet. Use the form on the left to enter
                      marks.
                    </td>
                  </tr>
                ) : (
                  studentReportMarks.map((mk) => {
                    const statusBadge = getGradePassFailBadge(mk.totalMark);
                    return (
                      <tr key={mk.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-2 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {mk.subjectCode}
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-slate-900 text-xs">{mk.subjectNameEn}</div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-xs tabular-nums">
                          {mk.continuousMark}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-xs tabular-nums">
                          {mk.midtermMark}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-xs tabular-nums">
                          {mk.finalMark}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-xs whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <span className="font-bold text-slate-900 tabular-nums">
                              {mk.totalMark}% ({mk.gradeLetter})
                            </span>
                            <span
                              data-testid="results-table-pass-fail-badge"
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                statusBadge.passed
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-red-100 text-red-900 border-red-300'
                              }`}
                            >
                              {statusBadge.badgeLabel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pl-2 text-right no-print whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleLoadMarkForEdit(mk)}
                              className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMark(mk)}
                              className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
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
              {studentReportMarks.length > 0 && (() => {
                const overallBadge = getGradePassFailBadge(annualStanding.overallPercentage);
                return (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/80 text-xs font-mono">
                      <td colSpan={5} className="py-3 pr-2 font-sans font-bold text-slate-900">
                        Calculated Final Average (Out of 100% · 50% Pass Threshold)
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="font-extrabold text-slate-900 tabular-nums">
                            {annualStanding.overallPercentage}%
                          </span>
                          <span
                            data-testid="results-table-overall-pass-fail-badge"
                            className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold border ${
                              overallBadge.passed
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-red-600 text-white border-red-700'
                            }`}
                          >
                            {overallBadge.badgeLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pl-2 no-print" />
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>

          {/* End-of-Year Overall Score Out of 100% & 50% Promotion Decision */}
          <div
            data-testid="report-card-annual-standing"
            className={`mt-5 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print-avoid-break ${
              annualStanding.statusCode === 'PASSED'
                ? 'bg-emerald-50 border-emerald-200'
                : annualStanding.statusCode === 'FAILED'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="text-xs font-bold text-slate-900">
                End-of-Year Overall Teacher-Recorded Score (Out of 100%)
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Rule: Below 50% (&lt; 50%) = Failed (Not Promoted) · 50% or Above (≥ 50%) = Passed (Promoted)
              </div>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
              <div className="text-right font-mono tabular-nums whitespace-nowrap">
                <div className="text-sm font-extrabold text-slate-900">
                  {annualStanding.overallPercentage}% / 100%
                </div>
                <div className="text-[11px] text-slate-500">
                  {annualStanding.totalPointsEarned} / {annualStanding.maxPossiblePoints} pts
                </div>
              </div>
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold whitespace-nowrap shrink-0 ${
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

          {/* Official Print-Only Signature Footer for PDF Export */}
          <div className="print-only mt-8 pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700">
            <div>
              <div className="font-semibold text-slate-900">Homeroom Teacher</div>
              <div className="mt-6 border-b border-slate-400" />
              <div className="mt-1 text-[11px] text-slate-500">Signature &amp; Date</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">Academic Registrar</div>
              <div className="mt-6 border-b border-slate-400" />
              <div className="mt-1 text-[11px] text-slate-500">Verification Seal</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">School Principal</div>
              <div className="mt-6 border-b border-slate-400" />
              <div className="mt-1 text-[11px] text-slate-500">Official Stamp &amp; Date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
