import React, { useEffect, useState } from 'react';
import {
  CalendarDisplayMode,
  HomeworkRecord,
  HomeworkSubmissionFileRecord,
  LanguageCode,
  StudentRecord,
} from '../types/esms';
import {
  buildStudentHomeworkSubmissionSummary,
  formatCalendarDate,
  formatFileSize,
  removeHomeworkSubmissionFromWorkspace,
} from '../utils/ethiopianRules';
import {
  ClipboardList,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  MessageSquareText,
  Eye,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export interface StudentHomeworkSectionProps {
  homeworks: HomeworkRecord[];
  student?: StudentRecord;
  studentIdCode: string;
  activeSchoolId: number;
  lang: LanguageCode;
  calendarMode: CalendarDisplayMode;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onRefresh: () => Promise<void>;
}

export const StudentHomeworkSection: React.FC<StudentHomeworkSectionProps> = ({
  homeworks,
  student,
  studentIdCode,
  activeSchoolId,
  calendarMode,
  apiFetch,
  onRefresh,
}) => {
  const [localHomeworks, setLocalHomeworks] = useState<HomeworkRecord[]>(homeworks);
  const serializedHomeworks = JSON.stringify(homeworks);
  useEffect(() => {
    setLocalHomeworks(homeworks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedHomeworks]);

  const defaultHw = localHomeworks[0];
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<number>(defaultHw?.id || 1);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileSize, setSelectedFileSize] = useState<number>(142800);
  const [selectedFileType, setSelectedFileType] = useState<string>('application/pdf');
  const [filePreviewContent, setFilePreviewContent] = useState<string>('');
  const [submissionNotes, setSubmissionNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    submission: HomeworkSubmissionFileRecord;
    homeworkTitle: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [previewSubmissionId, setPreviewSubmissionId] = useState<string | null>(null);

  const studentFullName = student
    ? `${student.firstName} ${student.fatherName} ${student.grandfatherName}`
    : 'Yohannes Kebede Worku';

  const allStudentSubmissions: Array<{
    homework: HomeworkRecord;
    submission: HomeworkSubmissionFileRecord;
  }> = [];

  localHomeworks.forEach((hw) => {
    const subs = hw.submissions || [];
    subs.forEach((sub) => {
      if (
        !student ||
        sub.studentId === student.id ||
        sub.studentCode.toUpperCase() === studentIdCode.toUpperCase()
      ) {
        allStudentSubmissions.push({ homework: hw, submission: sub });
      }
    });
  });

  allStudentSubmissions.sort(
    (a, b) =>
      new Date(b.submission.submittedAt).getTime() -
      new Date(a.submission.submittedAt).getTime()
  );

  const summary = buildStudentHomeworkSubmissionSummary(
    allStudentSubmissions.map((item) => item.submission),
    student?.id || 1
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size || 128400);
    setSelectedFileType(file.type || 'application/pdf');

    if (
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.csv')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result.slice(0, 600) : '';
        setFilePreviewContent(text);
      };
      reader.readAsText(file);
    } else {
      setFilePreviewContent(
        `Attached file "${file.name}" (${formatFileSize(file.size || 128400)}) prepared by ${studentFullName} (${studentIdCode}).`
      );
    }
  };

  const handleUploadHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const targetHw =
      localHomeworks.find((h) => h.id === Number(selectedHomeworkId)) || localHomeworks[0];
    if (!targetHw) {
      setStatusMessage({
        type: 'err',
        text: 'Please select a valid teacher-uploaded homework assignment first.',
      });
      return;
    }

    const cleanName = selectedFileName.trim();
    if (!cleanName) {
      setStatusMessage({
        type: 'err',
        text: 'Please choose a file or enter the homework file name before uploading.',
      });
      return;
    }

    setUploading(true);
    try {
      const previewSnippet =
        filePreviewContent.trim() ||
        submissionNotes.trim() ||
        `Completed homework submission "${cleanName}" for ${targetHw.title} (${targetHw.subjectCode}) by ${studentFullName} (${studentIdCode}).`;

      const res = await apiFetch(`/api/v1/homeworks/${targetHw.id}/submissions`, {
        method: 'POST',
        body: JSON.stringify({
          schoolId: activeSchoolId,
          homeworkTitle: targetHw.title,
          subjectCode: targetHw.subjectCode,
          studentId: student?.id || 1,
          studentCode: studentIdCode,
          studentName: studentFullName,
          fileName: cleanName,
          fileSizeBytes: selectedFileSize,
          fileType: selectedFileType,
          fileContentPreview: previewSnippet,
          filePreviewText: previewSnippet,
          notes: submissionNotes.trim(),
          submissionNotes: submissionNotes.trim(),
        }),
      });

      await onRefresh();

      if (res?.submission) {
        setLocalHomeworks((prev) =>
          prev.map((hw) => {
            if (hw.id !== targetHw.id) return hw;
            const exists = (hw.submissions || []).some((s) => s.id === res.submission.id);
            return exists
              ? hw
              : { ...hw, submissions: [res.submission, ...(hw.submissions || [])] };
          })
        );
      }

      setSelectedFileName('');
      setFilePreviewContent('');
      setSubmissionNotes('');
      setStatusMessage({
        type: 'ok',
        text: `Homework file "${cleanName}" uploaded and saved to your submission record!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'err',
        text: err.message || 'Failed to upload homework file.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRequestDeleteSubmission = (
    submission: HomeworkSubmissionFileRecord,
    homeworkTitle: string
  ) => {
    setStatusMessage(null);
    setPendingDeleteTarget({ submission, homeworkTitle });
  };

  const handleCancelDeleteSubmission = () => {
    if (pendingDeleteTarget) {
      // Explicit unconfirmed call preserves workspace.homeworks
      const preserved = removeHomeworkSubmissionFromWorkspace(
        localHomeworks,
        pendingDeleteTarget.submission.id,
        false
      );
      setLocalHomeworks(preserved.updatedHomeworks);
    }
    setPendingDeleteTarget(null);
  };

  const handleConfirmDeleteSubmission = async () => {
    if (!pendingDeleteTarget) return;
    const { submission } = pendingDeleteTarget;
    setStatusMessage(null);
    setDeletingId(submission.id);

    try {
      const { updatedHomeworks } = removeHomeworkSubmissionFromWorkspace(
        localHomeworks,
        submission.id,
        true
      );
      setLocalHomeworks(updatedHomeworks);

      await apiFetch(
        `/api/v1/homeworks/submissions/${encodeURIComponent(submission.id)}?schoolId=${activeSchoolId}`,
        { method: 'DELETE' }
      );
      if (previewSubmissionId === submission.id) {
        setPreviewSubmissionId(null);
      }
      setPendingDeleteTarget(null);
      setStatusMessage({
        type: 'ok',
        text: `Confirmed and removed "${submission.fileName}" from workspace.homeworks.`,
      });
      await onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'err',
        text: err.message || 'Failed to delete homework submission.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      aria-label="Student Homework & Submissions"
      className="space-y-6"
    >
      {/* Top Homework Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              8. Homework — Assignments & Student File Submissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload homework files directly into workspace.homeworks and review submitted files, status, and teacher feedback.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-600 tabular-nums self-start sm:self-auto">
            Assigned: <strong className="text-slate-900">{localHomeworks.length}</strong>
            {' · '}Submitted Files: <strong className="text-emerald-800">{summary.totalSubmitted}</strong>
          </div>
        </div>

        {/* 3-Card Submission Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">
                Submitted Files
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {summary.totalSubmitted}
              </div>
            </div>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-emerald-900">
                Reviewed by Teacher
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
                {summary.reviewedCount}
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-900">
                Teacher Feedback Available
              </div>
              <div className="text-2xl font-bold font-mono text-amber-950 mt-1">
                {summary.withFeedbackCount}
              </div>
            </div>
            <MessageSquareText className="w-5 h-5 text-amber-600" />
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            statusMessage.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Teacher-Uploaded Homeworks + Upload Homework Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Teacher-Uploaded Homework List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-700" />
            Assigned Homework Exercises
          </h3>

          {localHomeworks.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <ClipboardList className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                No Homework Uploaded by Your Teachers Yet
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Homework items are created only when your teacher uploads an assignment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {localHomeworks.map((hw) => {
                const isSelected = Number(selectedHomeworkId) === hw.id;
                const hwStudentSubs = (hw.submissions || []).filter(
                  (s) =>
                    !student ||
                    s.studentId === student.id ||
                    s.studentCode.toUpperCase() === studentIdCode.toUpperCase()
                );

                return (
                  <div
                    key={hw.id}
                    onClick={() => setSelectedHomeworkId(hw.id)}
                    className={`p-4 border rounded-xl transition-colors cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/80'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-900 text-sm">{hw.title}</span>
                      <span className="font-mono text-amber-800 font-semibold tabular-nums">
                        Due: {formatCalendarDate(hw.dueDate, calendarMode, 'en')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{hw.instructions}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-slate-500">
                      <span>
                        {hw.subjectCode} · {hw.gradeLevel} ({hw.sectionName}) · {hw.postedBy}
                      </span>
                      <span className="text-emerald-800 font-semibold tabular-nums">
                        {hwStudentSubs.length} file(s) submitted
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Upload Homework Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-700" />
              Submit Homework File
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your completed homework file and click Upload Homework to save it to your submission record.
            </p>
          </div>

          <form onSubmit={handleUploadHomework} className="space-y-3.5 text-xs">
            <div>
              <label
                htmlFor="homework-assignment-select"
                className="block font-semibold text-slate-700 mb-1"
              >
                Homework Assignment
              </label>
              <select
                id="homework-assignment-select"
                value={selectedHomeworkId}
                onChange={(e) => setSelectedHomeworkId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium text-slate-900"
              >
                {localHomeworks.map((hw) => (
                  <option key={hw.id} value={hw.id}>
                    {hw.subjectCode} · {hw.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="homework-file-picker"
                className="block font-semibold text-slate-700 mb-1"
              >
                Attach File from Device
              </label>
              <input
                id="homework-file-picker"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                onChange={handleFileInputChange}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 border border-slate-300 rounded-lg p-1.5 bg-slate-50"
              />
            </div>

            <div>
              <label
                htmlFor="homework-file-name-input"
                className="block font-semibold text-slate-700 mb-1"
              >
                Submission File Name *
              </label>
              <input
                id="homework-file-name-input"
                type="text"
                required
                value={selectedFileName}
                onChange={(e) => setSelectedFileName(e.target.value)}
                placeholder="e.g. Yohannes_Math_Unit2_Solutions.pdf"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="homework-submission-notes"
                className="block font-semibold text-slate-700 mb-1"
              >
                Solution Summary / Submission Notes
              </label>
              <textarea
                id="homework-submission-notes"
                rows={3}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Optional notes or key answers for your teacher..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || homeworks.length === 0}
              data-testid="upload-homework-btn"
              className="w-full py-2.5 px-4 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Uploading Homework...' : 'Upload Homework'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Preview List of Previously Submitted Files, Status & Teacher Feedback */}
      <div
        data-testid="submitted-homework-files-list"
        className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              Submitted Homework Files — Preview, Status & Teacher Feedback
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview your uploaded homework files, check teacher grading feedback, or delete a submission with confirmation
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums self-start sm:self-auto">
            {allStudentSubmissions.length} Submitted File(s)
          </span>
        </div>

        {allStudentSubmissions.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            No homework files submitted yet. Use the Upload Homework button above to submit your work.
          </div>
        ) : (
          <div className="space-y-4">
            {allStudentSubmissions.map(({ homework, submission }) => {
              const isReviewed = submission.status === 'REVIEWED';
              const isRevision = submission.status === 'NEEDS_REVISION';
              const isPreviewOpen = previewSubmissionId === submission.id;

              return (
                <div
                  key={submission.id}
                  data-testid="homework-submission-item"
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50/60 space-y-3"
                >
                  {/* File Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {submission.fileName}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-xs font-mono text-slate-600 tabular-nums">
                            {formatFileSize(submission.fileSizeBytes)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {homework.title} · <span className="font-mono">{homework.subjectCode}</span> · Submitted:{' '}
                          {formatCalendarDate(submission.submittedAt, calendarMode, 'en')}
                        </div>
                      </div>
                    </div>

                    {/* Submission Status & Action Buttons (Preview + Delete) */}
                    <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                      <span
                        data-testid="submission-status-badge"
                        className={`inline-flex items-center gap-1 text-xs font-mono font-bold ${
                          isReviewed
                            ? 'text-emerald-800'
                            : isRevision
                              ? 'text-amber-800'
                              : 'text-blue-800'
                        }`}
                      >
                        {isReviewed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-blue-700" />
                        )}
                        Status: {submission.status}
                        {submission.gradeScore ? ` · Score: ${submission.gradeScore}` : ''}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setPreviewSubmissionId(isPreviewOpen ? null : submission.id)
                        }
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1 text-slate-800"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isPreviewOpen ? 'Hide Preview' : 'Preview File'}
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${submission.fileName}`}
                        data-testid="delete-homework-submission-btn"
                        onClick={() => handleRequestDeleteSubmission(submission, homework.title)}
                        className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Confirmation Prompt Before Removing File from workspace.homeworks */}
                  {pendingDeleteTarget?.submission.id === submission.id && (
                    <div
                      role="alertdialog"
                      aria-label="Confirm Homework File Deletion"
                      data-testid="confirm-delete-submission-dialog"
                      className="p-3.5 bg-red-50 border border-red-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 text-xs text-red-950">
                        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">
                            Confirm deletion of &ldquo;{submission.fileName}&rdquo;?
                          </div>
                          <p className="text-red-800 mt-0.5">
                            This will permanently remove this file entry from your{' '}
                            <span className="font-mono font-semibold">workspace.homeworks</span>{' '}
                            submission record for {homework.title}.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          data-testid="cancel-delete-submission-btn"
                          onClick={handleCancelDeleteSubmission}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === submission.id}
                          data-testid="confirm-delete-submission-btn"
                          onClick={handleConfirmDeleteSubmission}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 border border-red-800 rounded-md hover:bg-red-800 disabled:opacity-50"
                        >
                          {deletingId === submission.id ? 'Removing...' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline File Content Preview */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-mono leading-relaxed">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      File Preview ({submission.fileType}):
                    </div>
                    {isPreviewOpen
                      ? submission.fileContentPreview
                      : submission.fileContentPreview.slice(0, 180)}
                    {submission.notes && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-slate-600 font-sans">
                        <strong>Student Notes:</strong> {submission.notes}
                      </div>
                    )}
                  </div>

                  {/* Teacher Feedback Section */}
                  <div
                    data-testid="teacher-feedback-box"
                    className={`p-3.5 rounded-lg border text-xs ${
                      submission.teacherFeedback
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-slate-100/80 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
                      <span>Teacher Feedback:</span>
                    </div>
                    <p className="mt-1 leading-relaxed">
                      {submission.teacherFeedback
                        ? submission.teacherFeedback
                        : 'Submitted on time — awaiting teacher review and feedback.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
