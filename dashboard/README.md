# Studyspace

A local-first study workspace built with React, TypeScript, Vite, and Tauri. Tasks, flashcard decks, study-plan sessions, timer state, and focus history are stored locally. Desktop notes are Markdown files in Tauri's app-local data directory; browser development uses a localStorage-backed Markdown fallback.

## Run locally

```sh
npm ci
npm run dev
```

No accounts, environment variables, backend, or internet connection are required to use the app. Browser profiles keep separate local data. Changes are saved automatically and restored on refresh. The app migrates data from the previous `studyspace:data:v1` key, or a single unambiguous cache from the former account-key format, to `studyspace:data:v1:local`. If multiple former account caches exist, they are left untouched rather than merged into one local profile.

## Validate

```sh
npm run lint
npm run build
npm test
```

## Desktop app

The desktop shell uses Tauri v2 and the same React/Vite frontend. On macOS, install Xcode Command Line Tools, Node.js, and the Rust stable toolchain first.

```sh
npm run tauri dev
npm run tauri build
```

The desktop app uses Tauri filesystem commands for Markdown notes and localStorage for other study data. Notes are stored under `AppLocalDataDir/notes`, typically `~/Library/Application Support/com.dashboardapp.studyspace/notes` on macOS and `%LOCALAPPDATA%\com.dashboardapp.studyspace\notes` on Windows. No account, network connection, backend, cloud sync, or SQLite database is used.

On Apple Silicon, the production build creates:

```text
src-tauri/target/release/bundle/macos/Studyspace.app
src-tauri/target/release/bundle/dmg/Studyspace_0.1.2_aarch64.dmg
```

## Desktop downloads

Pushing to `main` builds Windows and macOS installers. Download the `Studyspace-Windows-Installers` and `Studyspace-macOS-Installer` artifacts from that GitHub Actions run. Pushing a version tag such as `v0.1.2` builds both platforms and attaches the `.exe`, `.msi`, and `.dmg` files to one GitHub Release. The installers are currently unsigned, so Windows SmartScreen or macOS Gatekeeper may show their standard warnings.

## Data model and desktop path

The React UI uses the study-data hook; `studyData.ts` owns shared task, timer, plan, flashcard, and history reducer logic. `storage.ts` persists that document in localStorage. `markdownNotes.ts` and `useMarkdownNotes.ts` load and save Markdown files through Tauri, with a localStorage fallback for browser development. Old note objects are imported into files and backed up under `studyspace:legacy-notes-backup:v1` before the active legacy field is cleared.

SQLite is not included yet. It does not require Supabase or a custom server.
