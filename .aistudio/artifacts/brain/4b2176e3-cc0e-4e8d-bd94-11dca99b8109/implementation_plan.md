# Implementation Plan: Login Enhancements & Google Drive Database Snapshot Integration

## 1. Overview & Goals
Enhance the Ethiopian School Management System (ESMS) with:
1. **Login Page Top-Right Language Toggle (`en` / `am`)**: Add an interactive language switcher in the top-right header of `LoginPage` (`src/app/[locale]/(public)/login/page.tsx`) that updates the application-wide `locale` state (`'en'` | `'am'`), translates all UI strings immediately, and persists the selected language in `localStorage`.
2. **Login Form 'Remember Me' Persistence**: Update `LoginForm` (`src/components/forms/LoginForm.tsx`) so checking **Remember Me** below the password field saves the user's login identifier in `localStorage` (`esms_remembered_identifier_v1`) and automatically pre-fills it on subsequent visits.
3. **Google Drive Database Snapshot Export & Import**: Integrate Google Drive (`https://www.googleapis.com/auth/drive.file`) so administrators can connect their Google Drive account, automatically create/locate a dedicated **`ESMS Database`** folder in My Drive, export complete full-database JSON snapshots of all schools and records to Google Drive, list existing Drive snapshots, and import/restore snapshots back into the ESMS database (with an explicit confirmation dialog before overwriting or deleting any snapshot).
4. **End-to-End Reliability Verification**: Ensure every module across the Admin, Teacher, Finance, Librarian, and Student portals operates with zero broken actions, backed by SQLite persistence and Google Drive snapshot backup/restore.

---

## 2. Key User Flows & Features

### A. Login Page Language Toggle & Remember Me (`LoginPage` & `LoginForm`)
- **Top-Right Language Toggle Button**:
  - Placed in the top-right header row of `LoginPage` (`src/app/[locale]/(public)/login/page.tsx`).
  - Displays clear bilingual labels (`EN · English` / `አማ · አማርኛ`) and toggles `locale` between `'en'` and `'am'`.
  - Updates `LoginPage`'s internal `locale` state and invokes `onToggleLocale` in `App.tsx`, saving the choice to `localStorage` (`esms_preferred_locale_v1`).
- **Remember Me Checkbox (`LoginForm.tsx`)**:
  - Located directly below the password field.
  - On mount, reads `localStorage.getItem('esms_remembered_identifier_v1')` to populate the identifier input and checkbox state.
  - On login submission (and when toggling the checkbox), stores or clears the identifier in `localStorage`.

### B. Google Drive Database Snapshot Manager (`ESMS Database` Folder)
- **Google OAuth Provisioning (`drive.file`)**:
  - Uses Google OAuth (`https://www.googleapis.com/auth/drive.file`) to authorize access strictly to files and folders created by ESMS.
- **Dedicated `ESMS Database` Folder in My Drive**:
  - Automatically checks for an existing folder named `ESMS Database` (`mimeType = 'application/vnd.google-apps.folder'`) created by the app, or creates it if not present.
- **Manual Snapshot Export & Import**:
  - **Export Snapshot to Google Drive**: Exports the complete multi-school database state (`fullDatabaseExport` endpoint `/api/v1/database/snapshot`) as a timestamped JSON file (or updates the primary `esms-database-snapshot.json` inside `ESMS Database`).
  - **Import / Restore Snapshot from Google Drive**: Lists snapshots stored inside `ESMS Database` in My Drive and restores the selected snapshot into the server database via `POST /api/v1/database/restore`.
  - **Confirmation Dialogs**: Prompts the user with an explicit confirmation modal before overwriting an existing Google Drive snapshot, deleting a snapshot file on Drive, or restoring a snapshot into the active database.

---

## 3. Architecture & File Changes
- **`messages/en.json` & `messages/am.json`**: Ensure complete English and Amharic translation keys for the language toggle button, Remember Me control, and Google Drive database sync controls.
- **`src/app/[locale]/(public)/login/page.tsx`**: Add the interactive top-right language toggle button that updates `locale` state (`'en'` | `'am'`) and syncs with `App.tsx` and `localStorage`.
- **`src/components/forms/LoginForm.tsx`**: Wire the `Remember Me` checkbox below the password field to persist and load the user's login identifier via `localStorage`.
- **`src/db/repository.ts` & `server.ts`**: Add `exportFullDatabaseSnapshot()` and `restoreFullDatabaseSnapshot()` plus `/api/v1/database/snapshot` (`GET`) and `/api/v1/database/restore` (`POST`) endpoints so the entire SQLite database can be exported to and restored from Google Drive without any data loss.
- **`src/utils/googleDriveDb.ts`**: Client-side Google Drive REST API helper (`ensureEsmsFolder`, `listDriveSnapshots`, `exportSnapshotToDrive`, `downloadSnapshotFromDrive`, `deleteDriveSnapshot`) using the user's OAuth Bearer token.
- **`src/components/PortalsSyncAndSpecsTab.tsx` (`OfflineSyncAndAuditView`) & `src/components/OverviewAndSchoolsTab.tsx`**: Add the **Google Drive Database Snapshot Manager** card allowing one-click Connect Google Drive, Export Snapshot to `ESMS Database` folder, and Import/Restore Snapshot with confirmation modals.
