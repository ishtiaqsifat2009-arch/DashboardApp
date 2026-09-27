# Studyspace

A local-first study workspace built with React, TypeScript, and Vite. Tasks, notes, study-plan sessions, timer settings and progress, and study history are stored on this device in browser `localStorage`. The app makes no network requests and works offline after it has loaded once.

## Run locally

```sh
npm install
npm run dev
```

No accounts, environment variables, backend, or internet connection are required to use the app. Browser profiles keep separate local data. Changes are saved automatically and restored on refresh. The app migrates data from the previous `studyspace:data:v1` key, or a single unambiguous cache from the former account-key format, to `studyspace:data:v1:local`. If multiple former account caches exist, they are left untouched rather than merged into one local profile.

## Validate

```sh
npm run lint
npm run build
```

## Desktop app

The desktop shell uses Tauri v2 and the same React/Vite frontend. On macOS, install Xcode Command Line Tools, Node.js, and the Rust stable toolchain first.

```sh
npm run tauri dev
npm run tauri build
```

The desktop app continues using the localStorage adapter through the WebView's persistent app origin. No account, network connection, backend, or SQLite database is used.

On Apple Silicon, the production build creates:

- `src-tauri/target/release/bundle/macos/Studyspace.app`
- `src-tauri/target/release/bundle/dmg/Studyspace_0.1.0_aarch64.dmg`

## Desktop downloads

Pushing to `main` builds Windows and macOS installers. Download the `Studyspace-Windows-Installers` and `Studyspace-macOS-Installer` artifacts from that GitHub Actions run. Pushing a version tag such as `v0.1.0` builds both platforms and attaches the `.exe`, `.msi`, and `.dmg` files to one GitHub Release. The installers are currently unsigned, so Windows SmartScreen or macOS Gatekeeper may show their standard warnings.

## Data model and desktop path

The React UI uses the study-data hook; `studyData.ts` owns the typed entities and reducer logic; `storage.ts` implements the `StudyDataStorage` boundary. The current adapter stores one serialized `StudyData` document in localStorage and contains the legacy-key migrations and storage-error handling. The entities (`StudyTask`, `StudyNote`, `PlannedSession`, `StudyLog`, and `FocusTimer`) already have stable IDs and SQLite-friendly primitive fields. When adding SQLite, replace the adapter with a SQLite implementation and handle its asynchronous startup/save calls inside the study-data layer, without changing UI workflows.

SQLite is not included yet. It does not require Supabase or a custom server.
