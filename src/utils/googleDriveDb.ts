import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export const DRIVE_FOLDER_NAME = 'ESMS Database';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const PRIMARY_MASTER_SNAPSHOT_FILENAME = 'esms-master-database.json';

export interface DriveSnapshotFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface WorkspaceStateContext {
  activeSchoolId: number;
  activeTab: string;
  lang: 'en' | 'am';
  calendarMode: 'ETHIOPIAN' | 'GREGORIAN' | 'BOTH';
  offlineQueue?: any[];
}

export interface ValidatedWorkspaceSnapshot {
  schemaVersion: string;
  appName: string;
  driveFolderName: string;
  exportedAt: string;
  exportedBy?: string;
  workspaceContext?: WorkspaceStateContext;
  counts: {
    schools: number;
    students: number;
    teachers: number;
    portalAccounts: number;
  };
  tables: Record<string, any[]>;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

// In-memory cache for Google Drive OAuth access token (never stored in localStorage/sessionStorage)
let isSigningInToDrive = false;
let cachedDriveAccessToken: string | null = null;

export function getCachedDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function setCachedDriveAccessToken(token: string | null): void {
  cachedDriveAccessToken = token;
}

/**
 * Initializes the Firebase Auth state listener and clears the in-memory Drive token when signed out.
 */
export function initDriveAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedDriveAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedDriveAccessToken);
      } else if (!isSigningInToDrive) {
        cachedDriveAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedDriveAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
}

export async function disconnectGoogleDrive(): Promise<void> {
  cachedDriveAccessToken = null;
}

export async function requestGoogleDriveAccessToken(): Promise<string> {
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

  // 1. Prefer Google Identity Services (GIS) Token Client if VITE_GOOGLE_CLIENT_ID is available
  if (clientId && window.google?.accounts?.oauth2?.initTokenClient) {
    return new Promise<string>((resolve, reject) => {
      try {
        isSigningInToDrive = true;
        const client = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (tokenResponse) => {
            isSigningInToDrive = false;
            if (tokenResponse.access_token) {
              setCachedDriveAccessToken(tokenResponse.access_token);
              resolve(tokenResponse.access_token);
            } else {
              reject(new Error(tokenResponse.error || 'Google Drive authorization cancelled.'));
            }
          },
        });
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        isSigningInToDrive = false;
        reject(err);
      }
    });
  }

  // 2. Firebase GoogleAuthProvider popup with drive.file scope
  try {
    isSigningInToDrive = true;
    const credResult = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(credResult);
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error('Could not obtain Google Drive OAuth access token from Google sign-in.');
    }
    setCachedDriveAccessToken(accessToken);
    return accessToken;
  } finally {
    isSigningInToDrive = false;
  }
}

/**
 * Pure helper: builds the Google Drive API query for the dedicated 'ESMS Database' folder.
 */
export function buildEsmsDriveFolderQuery(folderName: string = DRIVE_FOLDER_NAME): string {
  const escaped = folderName.replace(/'/g, "\\'");
  return `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
}

/**
 * Pure helper: builds the Google Drive API query for JSON workspace snapshots inside 'ESMS Database'.
 */
export function buildEsmsDriveSnapshotFilesQuery(folderId: string): string {
  const escapedId = folderId.replace(/'/g, "\\'");
  return `'${escapedId}' in parents and mimeType = 'application/json' and trashed = false`;
}

/**
 * Pure helper: selects the preferred snapshot file from the 'ESMS Database' folder
 * (prioritizing 'esms-master-database.json', or falling back to the latest snapshot).
 */
export function findPreferredDriveSnapshotFile(
  files: DriveSnapshotFile[]
): DriveSnapshotFile | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const master = files.find((f) => f.name === PRIMARY_MASTER_SNAPSHOT_FILENAME);
  return master || files[0];
}

/**
 * Pure helper: enriches a database snapshot with the current client workspace state context
 * so the exported JSON file represents the complete workspace state.
 */
export function buildWorkspaceStateSnapshot(
  rawDatabaseSnapshot: any,
  workspaceContext?: WorkspaceStateContext
): ValidatedWorkspaceSnapshot {
  const base = rawDatabaseSnapshot?.snapshot || rawDatabaseSnapshot || {};
  const tables = base.tables || {};
  const schools = Array.isArray(tables.schools) ? tables.schools : [];
  const students = Array.isArray(tables.students) ? tables.students : [];
  const teachers = Array.isArray(tables.teachers) ? tables.teachers : [];
  const portalAccounts = Array.isArray(tables.portalAccounts) ? tables.portalAccounts : [];

  return {
    schemaVersion: base.schemaVersion || '1.0',
    appName: base.appName || 'Ethiopian School Management System (ESMS)',
    driveFolderName: DRIVE_FOLDER_NAME,
    exportedAt: base.exportedAt || new Date().toISOString(),
    exportedBy: base.exportedBy || 'ESMS Workspace Admin',
    ...(workspaceContext ? { workspaceContext } : base.workspaceContext ? { workspaceContext: base.workspaceContext } : {}),
    counts: {
      ...(base.counts || {}),
      schools: schools.length,
      students: students.length,
      teachers: teachers.length,
      portalAccounts: portalAccounts.length,
    },
    tables,
  };
}

/**
 * Pure helper: validates and normalizes an imported JSON workspace state snapshot.
 */
export function parseAndValidateWorkspaceSnapshot(input: unknown): ValidatedWorkspaceSnapshot {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  const payload = (parsed as any)?.snapshot || parsed;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid JSON: Workspace snapshot must be a JSON object.');
  }

  const tables = (payload as any).tables;
  if (!tables || typeof tables !== 'object' || !Array.isArray(tables.schools) || tables.schools.length === 0) {
    throw new Error(
      'Selected JSON file is not a valid ESMS workspace snapshot (missing non-empty tables.schools).'
    );
  }

  return buildWorkspaceStateSnapshot(payload, (payload as any).workspaceContext);
}

async function driveFetch(accessToken: string, url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    setCachedDriveAccessToken(null);
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Google Drive session expired or unauthorized (HTTP ${response.status}). Please sign in with Google again. ${errText}`
    );
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Google Drive API request failed with HTTP ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Ensures the dedicated 'ESMS Database' folder exists in the user's My Drive.
 */
export async function ensureEsmsDriveFolder(accessToken: string): Promise<DriveFolderInfo> {
  const q = buildEsmsDriveFolderQuery(DRIVE_FOLDER_NAME);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&pageSize=5`;

  const searchRes = await driveFetch(accessToken, searchUrl);
  if (searchRes?.files && searchRes.files.length > 0) {
    return searchRes.files[0] as DriveFolderInfo;
  }

  // Create the dedicated 'ESMS Database' folder in My Drive
  const created = await driveFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  return created as DriveFolderInfo;
}

/**
 * Lists JSON database snapshots stored inside the 'ESMS Database' folder.
 */
export async function listDriveSnapshots(
  accessToken: string,
  folderId: string
): Promise<DriveSnapshotFile[]> {
  const q = buildEsmsDriveSnapshotFilesQuery(folderId);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,webViewLink)&pageSize=25`;

  const data = await driveFetch(accessToken, listUrl);
  return (data?.files || []) as DriveSnapshotFile[];
}

/**
 * Uploads or updates a full JSON workspace state snapshot inside 'ESMS Database' in My Drive.
 */
export async function uploadSnapshotToDrive(params: {
  accessToken: string;
  folderId: string;
  fileName: string;
  snapshot: any;
  existingFileId?: string;
}): Promise<DriveSnapshotFile> {
  const metadata: Record<string, any> = {
    name: params.fileName,
    mimeType: 'application/json',
    description: `ESMS Persistent Workspace State Snapshot (${DRIVE_FOLDER_NAME})`,
  };
  if (!params.existingFileId) {
    metadata.parents = [params.folderId];
  }

  const boundary = 'esms_drive_snapshot_boundary_' + Date.now();
  const jsonContent = JSON.stringify(params.snapshot, null, 2);

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const uploadUrl = params.existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${params.existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink';

  const method = params.existingFileId ? 'PATCH' : 'POST';

  const result = await driveFetch(params.accessToken, uploadUrl, {
    method,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  return result as DriveSnapshotFile;
}

/**
 * Downloads a JSON workspace state snapshot file from Google Drive.
 */
export async function downloadSnapshotFromDrive(
  accessToken: string,
  fileId: string
): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  return driveFetch(accessToken, url);
}

/**
 * Deletes a snapshot file from Google Drive.
 */
export async function deleteSnapshotFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  await driveFetch(accessToken, url, { method: 'DELETE' });
}
