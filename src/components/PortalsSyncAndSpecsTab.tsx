import React, { useState } from 'react';
import { OfflineQueuedOperation, SharedViewProps } from '../types/esms';
import {
  buildStudentAttendanceProgressModel,
  calculateAnnualStudentStanding,
  formatCalendarDate,
  formatEtb,
  getGradePassFailBadge,
  SCHOOL_PAYMENT_ACCOUNTS,
} from '../utils/ethiopianRules';
import { DELIVERABLE_ARTIFACTS } from '../data/deliverablesReference';
import { UserCheck, RefreshCw, ShieldCheck, FileCode2, Copy, Check } from 'lucide-react';
import { StudentProfileCard } from './StudentProfileCard';
import { GoogleDriveDatabasePanel } from './GoogleDriveDatabasePanel';

export const ParentAndStudentPortalView: React.FC<SharedViewProps> = ({
  lang,
  calendarMode,
  workspace,
}) => {
  const defaultStu =
    workspace.students.find((s) => s.studentCode === 'STU-482910') || workspace.students[0];
  const [selectedGuardianStudentId, setSelectedGuardianStudentId] = useState<number>(
    defaultStu?.id || 1
  );

  const student =
    workspace.students.find((s) => s.id === selectedGuardianStudentId) ||
    defaultStu ||
    workspace.students[0];

  const studentAccount = workspace.portalAccounts.find(
    (p) =>
      (p.linkedStudentId === student?.id || p.accessCode === student?.studentCode) &&
      p.role === 'STUDENT'
  );

  const studentAttendance = workspace.attendance.filter((a) => a.studentId === student?.id);
  const attendanceProgress = buildStudentAttendanceProgressModel(studentAttendance);
  const studentMarks = workspace.marks.filter((m) => m.studentId === student?.id);
  const annualStanding = calculateAnnualStudentStanding(studentMarks);
  const studentInvoices = workspace.invoices.filter((i) => i.studentId === student?.id);
  const studentPayments = workspace.payments.filter((p) => p.studentId === student?.id);

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Verified Parent & Student Portal
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Guardians and students view verified academic, attendance, and tuition records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="portal-student-select" className="text-xs font-medium text-slate-700">
              Active Student:
            </label>
            <select
              id="portal-student-select"
              value={student?.id || ''}
              onChange={(e) => setSelectedGuardianStudentId(Number(e.target.value))}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white font-medium"
            >
              {workspace.students.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  {stu.studentCode} · {stu.firstName} {stu.fatherName} ({stu.gradeLevel})
                </option>
              ))}
            </select>
          </div>
        </div>

        {student && (
          <div className="space-y-6">
            <StudentProfileCard
              student={student}
              studentAccount={studentAccount}
              school={workspace.school}
              lang={lang}
              calendarMode={calendarMode}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <article className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Daily Attendance Rate
                  </span>
                  <span className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                    {attendanceProgress.clampedPercent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Student Daily Attendance Rate"
                  aria-valuenow={attendanceProgress.clampedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  data-testid="parent-portal-attendance-progress-bar"
                  className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200 flex"
                >
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${attendanceProgress.clampedPercent}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600">
                  <span>
                    Present: <strong className="text-emerald-800">{attendanceProgress.presentDays}</strong>
                    {' · '}Late: <strong className="text-amber-800">{attendanceProgress.lateDays}</strong>
                    {' · '}Absent: <strong className="text-red-800">{attendanceProgress.absentDays}</strong>
                  </span>
                  <span className="font-mono">
                    {attendanceProgress.totalRecordedDays} Recorded Days
                  </span>
                </div>
              </article>

              <article className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Tuition Fee Status</span>
                  <span className="text-xs font-mono text-slate-500">
                    {studentPayments.length} Official Receipt(s)
                  </span>
                </div>
                <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                  {studentInvoices[0]
                    ? formatEtb(studentInvoices[0].balanceEtb, lang)
                    : 'ETB 0.00'}{' '}
                  Balance
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {studentInvoices.length > 0
                    ? `Invoice ${studentInvoices[0].invoiceNumber} · ${studentInvoices[0].status}`
                    : 'All term tuition obligations settled'}
                </div>
                <div className="pt-2 mt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-700">
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded font-bold">
                    {SCHOOL_PAYMENT_ACCOUNTS.telebirr.displayLabel}
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded font-bold">
                    {SCHOOL_PAYMENT_ACCOUNTS.cbe.displayLabel}
                  </span>
                </div>
              </article>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Published Examination Results ({studentMarks.length}) · Overall: {annualStanding.overallPercentage}% / 100%
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {studentMarks.map((m) => {
                const badge = getGradePassFailBadge(m.totalMark);
                return (
                  <article
                    key={m.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{m.subjectNameEn}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {m.subjectCode} · {m.term}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
                            badge.passed
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-red-100 text-red-900 border-red-300'
                          }`}
                        >
                          {badge.badgeLabel}
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                          {m.gradeLetter}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-600">
                        {m.continuousMark} + {m.midtermMark} + {m.finalMark}
                      </span>
                      <span className="font-bold text-emerald-800">{m.totalMark}%</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              Family Invoices & Payment Receipts ({studentInvoices.length})
            </h3>
            {studentInvoices.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                No outstanding family invoices recorded for this student.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {studentInvoices.map((inv) => (
                  <article
                    key={inv.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                      <div className="text-slate-600 mt-0.5">
                        {inv.feeCategory} · Due {formatCalendarDate(inv.dueDate, calendarMode, lang)}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums sm:text-right">
                      <div className="text-slate-600">Paid: {formatEtb(inv.paidAmountEtb, lang)}</div>
                      <div className="font-bold text-slate-900">
                        Balance: {formatEtb(inv.balanceEtb, lang)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const OfflineSyncAndAuditView: React.FC<
  SharedViewProps & {
    offlineQueue: OfflineQueuedOperation[];
    onEnqueueOffline: (op: OfflineQueuedOperation) => void;
    onFlushOfflineQueue: () => Promise<void>;
  }
> = ({ lang, calendarMode, workspace, offlineQueue, onEnqueueOffline, onFlushOfflineQueue, apiFetch, onRefresh }) => {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleCreateSampleOfflineAttendance = () => {
    const firstStu = workspace.students[0];
    if (!firstStu) return;
    const op: OfflineQueuedOperation = {
      operationId: `OP-LOCAL-SRV-${firstStu.id}-${Date.now()}`,
      deviceId: 'ANDROID-BOLE-TAB-07',
      entityType: 'ATTENDANCE',
      entityId: `${firstStu.id}:2026-10-23`,
      action: 'UPSERT',
      payload: {
        studentId: firstStu.id,
        attendanceDate: '2026-10-23',
        status: 'PRESENT',
        remarks: 'Created offline during campus internet outage & buffered in SQLite/IndexedDB',
      },
      versionNumber: 2,
      clientTimestamp: new Date().toISOString(),
    };
    onEnqueueOffline(op);
    setSyncMsg(`Buffered offline operation ${op.operationId} in local persistent queue.`);
  };

  const handleSyncNow = async () => {
    setSyncMsg(null);
    await onFlushOfflineQueue();
    setSyncMsg(
      'Flushed all queued offline operations to /api/v1/sync with idempotent operation_id verification.'
    );
  };

  return (
    <div className="space-y-8">
      {/* Dedicated Google Drive Database Snapshot Export & Import Manager */}
      <GoogleDriveDatabasePanel
        lang={lang}
        apiFetch={apiFetch}
        onDatabaseRestored={onRefresh}
        workspaceContext={{
          activeSchoolId: workspace.school?.id || 1,
          activeTab: 'sync',
          lang,
          calendarMode,
          offlineQueue,
        }}
      />

      {/* Hybrid Local Server & Offline Sync Control Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Hybrid Local School Server & Android Offline Synchronization Engine
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Versioned synchronization protocol using deterministic{' '}
              <span className="font-mono">operation_id</span>,{' '}
              <span className="font-mono">version_number</span>, and{' '}
              <span className="font-mono">client_timestamp</span> to prevent duplicate records when
              internet returns.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateSampleOfflineAttendance}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Simulate Offline Attendance Operation
            </button>
            <button
              type="button"
              onClick={handleSyncNow}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Synchronize Offline Queue ({offlineQueue.length})
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 font-medium">
            {syncMsg}
          </div>
        )}

        {offlineQueue.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50/70 border border-amber-200 rounded-md">
            <div className="text-xs font-semibold text-amber-900 mb-2">
              Unsynchronized Local Queue ({offlineQueue.length} Pending Operations)
            </div>
            <div className="space-y-1.5 text-xs font-mono text-amber-900">
              {offlineQueue.map((q) => (
                <div key={q.operationId} className="flex justify-between">
                  <span>
                    {q.operationId} · {q.entityType} ({q.entityId})
                  </span>
                  <span>v{q.versionNumber} · PENDING</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2 pr-3">Operation ID</th>
                <th className="py-2 px-3">Source Device / Local Node</th>
                <th className="py-2 px-3">Entity & Action</th>
                <th className="py-2 px-3">Version</th>
                <th className="py-2 pl-3 text-right">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {workspace.syncOperations.map((op) => (
                <tr key={op.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono font-medium text-slate-900">
                    {op.operationId}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{op.deviceId}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {op.entityType} · {op.action} ({op.entityId})
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">v{op.versionNumber}</td>
                  <td className="py-2.5 pl-3 text-right font-mono font-semibold text-emerald-700">
                    {op.syncStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Security & Operational Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
          <ShieldCheck className="w-4 h-4 text-slate-700" />
          <h3 className="text-base font-semibold text-slate-900">
            Security, Tenant Isolation & Financial Audit Log ({workspace.auditLogs.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2 pr-3">Audit ID</th>
                <th className="py-2 px-3">Actor & Role</th>
                <th className="py-2 px-3">Module & Action</th>
                <th className="py-2 px-3">Target Ref</th>
                <th className="py-2 pl-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {workspace.auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono text-slate-500 tabular-nums">#{log.id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-900">{log.actorName}</div>
                    <div className="font-mono text-slate-500">{log.actorRole}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className="text-slate-900 font-semibold">{log.module}</span> ·{' '}
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{log.entityRef}</td>
                  <td className="py-2.5 pl-3 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const DeliverablesAndSpecsView: React.FC<{ lang: 'en' | 'am' }> = ({ lang }) => {
  const [selectedId, setSelectedId] = useState(DELIVERABLE_ARTIFACTS[0].id);
  const [copied, setCopied] = useState(false);

  const activeDoc =
    DELIVERABLE_ARTIFACTS.find((d) => d.id === selectedId) || DELIVERABLE_ARTIFACTS[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Engineering Deliverables, Prisma Schema, Flutter Android Sync & DevOps Runbooks
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DELIVERABLE_ARTIFACTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedId === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {lang === 'am' ? item.titleAm : item.titleEn}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">{activeDoc.category}</div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              {lang === 'am' ? activeDoc.titleAm : activeDoc.titleEn}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">{activeDoc.summary}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Code / Spec'}
          </button>
        </div>

        <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
          <code>{activeDoc.content}</code>
        </pre>
      </div>
    </div>
  );
};
