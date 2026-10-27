import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  UploadCloud,
  DownloadCloud,
  FolderCheck,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HardDriveDownload,
  HardDriveUpload,
  ExternalLink,
} from 'lucide-react';
import {
  DRIVE_FOLDER_NAME,
  DriveFolderInfo,
  DriveSnapshotFile,
  PRIMARY_MASTER_SNAPSHOT_FILENAME,
  ValidatedWorkspaceSnapshot,
  WorkspaceStateContext,
  buildWorkspaceStateSnapshot,
  deleteSnapshotFromDrive,
  disconnectGoogleDrive,
  downloadSnapshotFromDrive,
  ensureEsmsDriveFolder,
  findPreferredDriveSnapshotFile,
  getCachedDriveAccessToken,
  initDriveAuth,
  listDriveSnapshots,
  parseAndValidateWorkspaceSnapshot,
  requestGoogleDriveAccessToken,
  uploadSnapshotToDrive,
} from '../utils/googleDriveDb';

export { PRIMARY_MASTER_SNAPSHOT_FILENAME };

export interface GoogleDriveDatabasePanelProps {
  lang: 'en' | 'am';
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  onDatabaseRestored: () => Promise<void>;
  workspaceContext?: WorkspaceStateContext;
  onWorkspaceContextRestored?: (ctx: WorkspaceStateContext) => void;
}

type PendingDriveConfirmation =
  | {
      type: 'OVERWRITE_MASTER';
      existingFile: DriveSnapshotFile;
    }
  | {
      type: 'RESTORE_FROM_DRIVE';
      file: DriveSnapshotFile;
    }
  | {
      type: 'DELETE_FROM_DRIVE';
      file: DriveSnapshotFile;
    }
  | {
      type: 'RESTORE_LOCAL_FILE';
      fileName: string;
      snapshot: ValidatedWorkspaceSnapshot;
    };

export const GoogleDriveDatabasePanel: React.FC<GoogleDriveDatabasePanelProps> = ({
  lang,
  apiFetch,
  onDatabaseRestored,
  workspaceContext,
  onWorkspaceContextRestored,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getCachedDriveAccessToken());
  const [folder, setFolder] = useState<DriveFolderInfo | null>(null);
  const [snapshots, setSnapshots] = useState<DriveSnapshotFile[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingDriveConfirmation | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = initDriveAuth(
      (_user, token) => {
        setAccessToken(token);
      },
      () => {
        setAccessToken(null);
      }
    );
    return () => unsub();
  }, []);

  const loadFolderAndSnapshots = async (token: string) => {
    setBusyAction('loading');
    try {
      const folderInfo = await ensureEsmsDriveFolder(token);
      setFolder(folderInfo);
      const files = await listDriveSnapshots(token, folderInfo.id);
      setSnapshots(files);
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to load ESMS Database folder from Google Drive.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadFolderAndSnapshots(accessToken);
    }
  }, [accessToken]);

  const handleConnectDrive = async () => {
    setStatusBanner(null);
    setBusyAction('connecting');
    try {
      const token = await requestGoogleDriveAccessToken();
      setAccessToken(token);
      const folderInfo = await ensureEsmsDriveFolder(token);
      setFolder(folderInfo);
      const files = await listDriveSnapshots(token, folderInfo.id);
      setSnapshots(files);
      setStatusBanner({
        kind: 'success',
        text:
          lang === 'am'
            ? `ከ Google Drive ጋር ተገናኝቷል! አቃፊ፦ My Drive / ${folderInfo.name} (${files.length} የዳታቤዝ ቅጂዎች)`
            : `Connected to Google Drive! Dedicated folder: My Drive / ${folderInfo.name} (${files.length} snapshot(s) found).`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Google Drive connection failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnectDrive = async () => {
    await disconnectGoogleDrive();
    setAccessToken(null);
    setFolder(null);
    setSnapshots([]);
    setStatusBanner({
      kind: 'info',
      text:
        lang === 'am'
          ? 'ከ Google Drive ክፍለ-ጊዜ ወጥተዋል።'
          : 'Disconnected Google Drive session.',
    });
  };

  const buildCurrentFullWorkspaceSnapshot = async (): Promise<ValidatedWorkspaceSnapshot> => {
    const res = await apiFetch('/api/v1/database/snapshot');
    return buildWorkspaceStateSnapshot(res.snapshot, workspaceContext);
  };

  const executeExportToDrive = async (
    fileName: string,
    existingFileId?: string
  ) => {
    if (!accessToken) {
      await handleConnectDrive();
      return;
    }
    setBusyAction('exporting');
    setStatusBanner(null);
    try {
      const activeFolder = folder || (await ensureEsmsDriveFolder(accessToken));
      setFolder(activeFolder);

      const fullWorkspaceSnapshot = await buildCurrentFullWorkspaceSnapshot();
      const uploaded = await uploadSnapshotToDrive({
        accessToken,
        folderId: activeFolder.id,
        fileName,
        snapshot: fullWorkspaceSnapshot,
        existingFileId,
      });

      const updatedList = await listDriveSnapshots(accessToken, activeFolder.id);
      setSnapshots(updatedList);
      setStatusBanner({
        kind: 'success',
        text:
          lang === 'am'
            ? `ሙሉው የስራ ቦታ (Workspace State) ወደ Google Drive (My Drive / ${DRIVE_FOLDER_NAME} / ${uploaded.name}) በተሳካ ሁኔታ ተቀምጧል!`
            : `Exported complete workspace state JSON to My Drive / ${DRIVE_FOLDER_NAME} / ${uploaded.name} (${fullWorkspaceSnapshot.counts.schools} school(s), ${fullWorkspaceSnapshot.counts.students} student(s))!`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to export workspace state snapshot to Google Drive.',
      });
    } finally {
      setBusyAction(null);
      setPendingConfirmation(null);
    }
  };

  const handleRequestExportMasterSnapshot = () => {
    const existingMaster = snapshots.find((f) => f.name === PRIMARY_MASTER_SNAPSHOT_FILENAME);
    if (existingMaster) {
      setPendingConfirmation({
        type: 'OVERWRITE_MASTER',
        existingFile: existingMaster,
      });
    } else {
      executeExportToDrive(PRIMARY_MASTER_SNAPSHOT_FILENAME);
    }
  };

  const handleExportNewTimestampedSnapshot = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    executeExportToDrive(`esms-workspace-snapshot-${stamp}.json`);
  };

  const handleRequestImportPreferredDriveSnapshot = () => {
    const preferred = findPreferredDriveSnapshotFile(snapshots);
    if (!preferred) {
      setStatusBanner({
        kind: 'info',
        text:
          lang === 'am'
            ? `በ My Drive / ${DRIVE_FOLDER_NAME} ውስጥ ምንም የ JSON ቅጂ አልተገኘም። መጀመሪያ ወደ Drive ይላኩ።`
            : `No JSON snapshots found in My Drive / ${DRIVE_FOLDER_NAME} yet. Export a snapshot first.`,
      });
      return;
    }
    setPendingConfirmation({
      type: 'RESTORE_FROM_DRIVE',
      file: preferred,
    });
  };

  const executeRestoreFromDrive = async (file: DriveSnapshotFile) => {
    if (!accessToken) return;
    setBusyAction(`restoring-${file.id}`);
    setStatusBanner(null);
    try {
      const rawSnapshotData = await downloadSnapshotFromDrive(accessToken, file.id);
      const validated = parseAndValidateWorkspaceSnapshot(rawSnapshotData);
      const restoreRes = await apiFetch('/api/v1/database/restore', {
        method: 'POST',
        body: JSON.stringify({ snapshot: validated }),
      });
      if (validated.workspaceContext && onWorkspaceContextRestored) {
        onWorkspaceContextRestored(validated.workspaceContext);
      }
      await onDatabaseRestored();
      setStatusBanner({
        kind: 'success',
        text:
          lang === 'am'
            ? `የስራ ቦታው (Workspace State) ከ Google Drive (My Drive / ${DRIVE_FOLDER_NAME} / ${file.name}) በተሳካ ሁኔታ ተመልሷል (${restoreRes.schoolsCount} ት/ቤቶች፣ ${restoreRes.studentsCount} ተማሪዎች)።`
            : `Imported workspace state from My Drive / ${DRIVE_FOLDER_NAME} / "${file.name}" (${restoreRes.schoolsCount} schools, ${restoreRes.studentsCount} students).`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to import/restore workspace state from Google Drive.',
      });
    } finally {
      setBusyAction(null);
      setPendingConfirmation(null);
    }
  };

  const executeDeleteFromDrive = async (file: DriveSnapshotFile) => {
    if (!accessToken || !folder) return;
    setBusyAction(`deleting-${file.id}`);
    setStatusBanner(null);
    try {
      await deleteSnapshotFromDrive(accessToken, file.id);
      const updatedList = await listDriveSnapshots(accessToken, folder.id);
      setSnapshots(updatedList);
      setStatusBanner({
        kind: 'info',
        text: `Deleted snapshot "${file.name}" from My Drive / ${DRIVE_FOLDER_NAME}.`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to delete snapshot from Google Drive.',
      });
    } finally {
      setBusyAction(null);
      setPendingConfirmation(null);
    }
  };

  // Local JSON Workspace State Export / Import (compatible with 'ESMS Database' folder files)
  const handleDownloadLocalSnapshot = async () => {
    setBusyAction('local-export');
    setStatusBanner(null);
    try {
      const fullWorkspaceSnapshot = await buildCurrentFullWorkspaceSnapshot();
      const jsonStr = JSON.stringify(fullWorkspaceSnapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = PRIMARY_MASTER_SNAPSHOT_FILENAME;
      link.click();
      URL.revokeObjectURL(url);
      setStatusBanner({
        kind: 'success',
        text:
          lang === 'am'
            ? `ሙሉው የስራ ቦታ JSON ቅጂ (${PRIMARY_MASTER_SNAPSHOT_FILENAME}) ወርዷል — በ Google Drive "${DRIVE_FOLDER_NAME}" አቃፊ ውስጥ ማስቀመጥ ይችላሉ።`
            : `Exported workspace state JSON (${PRIMARY_MASTER_SNAPSHOT_FILENAME} — ${fullWorkspaceSnapshot.counts.schools} school(s), ${fullWorkspaceSnapshot.counts.students} student(s)) ready for your "${DRIVE_FOLDER_NAME}" folder.`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to export workspace state JSON file.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLocalFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const validated = parseAndValidateWorkspaceSnapshot(text);
      setPendingConfirmation({
        type: 'RESTORE_LOCAL_FILE',
        fileName: file.name,
        snapshot: validated,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Invalid workspace state JSON file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const executeRestoreLocalSnapshot = async (
    fileName: string,
    snapshotData: ValidatedWorkspaceSnapshot
  ) => {
    setBusyAction('local-restore');
    setStatusBanner(null);
    try {
      const restoreRes = await apiFetch('/api/v1/database/restore', {
        method: 'POST',
        body: JSON.stringify({ snapshot: snapshotData }),
      });
      if (snapshotData.workspaceContext && onWorkspaceContextRestored) {
        onWorkspaceContextRestored(snapshotData.workspaceContext);
      }
      await onDatabaseRestored();
      setStatusBanner({
        kind: 'success',
        text:
          lang === 'am'
            ? `የስራ ቦታው (Workspace State) ከ "${fileName}" በተሳካ ሁኔታ ተመልሷል (${restoreRes.schoolsCount} ት/ቤቶች፣ ${restoreRes.studentsCount} ተማሪዎች)።`
            : `Imported workspace state from "${fileName}" (${restoreRes.schoolsCount} schools, ${restoreRes.studentsCount} students).`,
      });
    } catch (err: any) {
      setStatusBanner({
        kind: 'error',
        text: err.message || 'Failed to import workspace state JSON file.',
      });
    } finally {
      setBusyAction(null);
      setPendingConfirmation(null);
    }
  };

  return (
    <section
      data-testid="google-drive-database-panel"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-xs"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">
              {lang === 'am'
                ? 'Google Drive የስራ ቦታ ዳታቤዝ ክምችት እና መመለሻ (My Drive / ESMS Database)'
                : 'Workspace State & Google Drive Storage (My Drive / ESMS Database)'}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold border ${
                accessToken
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {accessToken ? `Connected: My Drive / ${DRIVE_FOLDER_NAME}` : `Target: My Drive / ${DRIVE_FOLDER_NAME}`}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {lang === 'am'
              ? 'ሙሉውን የስራ ቦታ ሁኔታ (Workspace State) እንደ JSON ፋይል ወደ Google Drive "ESMS Database" አቃፊ ይላኩ ወይም ከዚያ ያስገቡ።'
              : 'Export the current workspace state as a JSON file and import it from your dedicated "ESMS Database" folder in Google Drive for persistent storage.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!accessToken ? (
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={busyAction !== null}
              data-testid="connect-google-drive-btn"
              className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper flex items-center gap-2">
                <div className="gsi-material-button-icon w-4 h-4 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-4 h-4 block"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {busyAction === 'connecting'
                    ? 'Connecting Google Drive…'
                    : lang === 'am'
                      ? 'በ Google ይግቡ (ESMS Database ያገናኙ)'
                      : 'Sign in with Google (ESMS Database)'}
                </span>
              </div>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRequestExportMasterSnapshot}
                disabled={busyAction !== null}
                data-testid="export-master-drive-btn"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {busyAction === 'exporting'
                    ? 'Exporting…'
                    : lang === 'am'
                      ? 'ወደ ESMS Database ላክ'
                      : 'Export to ESMS Database (Drive)'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRequestImportPreferredDriveSnapshot}
                disabled={busyAction !== null || snapshots.length === 0}
                data-testid="import-master-drive-btn"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>
                  {lang === 'am'
                    ? 'ከ ESMS Database መልስ'
                    : 'Import from ESMS Database (Drive)'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportNewTimestampedSnapshot}
                disabled={busyAction !== null}
                data-testid="export-timestamped-drive-btn"
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>New Timestamped Snapshot</span>
              </button>

              <button
                type="button"
                onClick={() => loadFolderAndSnapshots(accessToken)}
                disabled={busyAction !== null}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnectDrive}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Disconnect
              </button>
            </>
          )}

          {/* Direct JSON Workspace State Export & Import buttons */}
          <button
            type="button"
            onClick={handleDownloadLocalSnapshot}
            disabled={busyAction !== null}
            data-testid="download-local-snapshot-btn"
            className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-slate-700" />
            <span>{lang === 'am' ? 'Workspace JSON አውርድ' : 'Export Workspace JSON'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleLocalFileSelected}
            data-testid="import-local-snapshot-input"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busyAction !== null}
            data-testid="import-local-snapshot-btn"
            className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <HardDriveUpload className="w-3.5 h-3.5 text-slate-700" />
            <span>{lang === 'am' ? 'Workspace JSON አስገባ' : 'Import Workspace JSON'}</span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          data-testid="drive-status-banner"
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
            statusBanner.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusBanner.kind === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.kind === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="underline text-xs font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Folder Metadata & Snapshot List */}
      {accessToken && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <FolderCheck className="w-4 h-4 text-blue-700" />
              <span>
                Target Google Drive Folder:{' '}
                <strong className="font-mono">My Drive / {DRIVE_FOLDER_NAME}</strong>
              </span>
              {folder?.id && (
                <span className="text-slate-500 font-mono">({folder.id})</span>
              )}
            </div>
            {folder?.webViewLink && (
              <a
                href={folder.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
              >
                <span>Open Folder in Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {snapshots.length === 0 ? (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-600">
              No workspace snapshots stored in <strong>My Drive / {DRIVE_FOLDER_NAME}</strong> yet.
              Click <strong>Export to ESMS Database (Drive)</strong> above to save your current
              workspace state.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium">
                    <th className="py-2 pr-3">Snapshot File Name</th>
                    <th className="py-2 px-3">Last Modified</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 pl-3 text-right">Workspace Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {snapshots.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">
                        {file.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPendingConfirmation({
                                type: 'RESTORE_FROM_DRIVE',
                                file,
                              })
                            }
                            disabled={busyAction !== null}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded font-semibold inline-flex items-center gap-1"
                          >
                            <DownloadCloud className="w-3.5 h-3.5" />
                            <span>Import / Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingConfirmation({
                                type: 'DELETE_FROM_DRIVE',
                                file,
                              })
                            }
                            disabled={busyAction !== null}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded font-semibold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mandatory Confirmation Modal before Overwriting, Restoring, or Deleting Drive Snapshots */}
      {pendingConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="drive-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900">
                  {pendingConfirmation.type === 'OVERWRITE_MASTER' &&
                    'Confirm Updating Master Workspace Snapshot on Google Drive'}
                  {pendingConfirmation.type === 'RESTORE_FROM_DRIVE' &&
                    'Confirm Importing Workspace State from Google Drive'}
                  {pendingConfirmation.type === 'DELETE_FROM_DRIVE' &&
                    'Confirm Deleting Snapshot from Google Drive'}
                  {pendingConfirmation.type === 'RESTORE_LOCAL_FILE' &&
                    'Confirm Importing Workspace State JSON File'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pendingConfirmation.type === 'OVERWRITE_MASTER' &&
                    `Are you sure you want to update "${pendingConfirmation.existingFile.name}" inside My Drive / ${DRIVE_FOLDER_NAME} with the current ESMS workspace state?`}
                  {pendingConfirmation.type === 'RESTORE_FROM_DRIVE' &&
                    `Are you sure you want to import and restore the ESMS workspace state from My Drive / ${DRIVE_FOLDER_NAME} / "${pendingConfirmation.file.name}"? Current active records will be replaced by the snapshot.`}
                  {pendingConfirmation.type === 'DELETE_FROM_DRIVE' &&
                    `Are you sure you want to permanently delete "${pendingConfirmation.file.name}" from My Drive / ${DRIVE_FOLDER_NAME}?`}
                  {pendingConfirmation.type === 'RESTORE_LOCAL_FILE' &&
                    `Are you sure you want to restore the ESMS workspace state from "${pendingConfirmation.fileName}" (${pendingConfirmation.snapshot.counts.schools} school(s), ${pendingConfirmation.snapshot.counts.students} student(s), ${pendingConfirmation.snapshot.counts.teachers} teacher(s))?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirmation(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-drive-action-btn"
                onClick={() => {
                  if (pendingConfirmation.type === 'OVERWRITE_MASTER') {
                    executeExportToDrive(
                      PRIMARY_MASTER_SNAPSHOT_FILENAME,
                      pendingConfirmation.existingFile.id
                    );
                  } else if (pendingConfirmation.type === 'RESTORE_FROM_DRIVE') {
                    executeRestoreFromDrive(pendingConfirmation.file);
                  } else if (pendingConfirmation.type === 'DELETE_FROM_DRIVE') {
                    executeDeleteFromDrive(pendingConfirmation.file);
                  } else if (pendingConfirmation.type === 'RESTORE_LOCAL_FILE') {
                    executeRestoreLocalSnapshot(
                      pendingConfirmation.fileName,
                      pendingConfirmation.snapshot
                    );
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
