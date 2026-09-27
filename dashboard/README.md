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

## Data model and desktop path

The React UI uses the study-data hook; `studyData.ts` owns the typed entities and reducer logic; `storage.ts` implements the `StudyDataStorage` boundary. The current adapter stores one serialized `StudyData` document in localStorage and contains the legacy-key migrations and storage-error handling. The entities (`StudyTask`, `StudyNote`, `PlannedSession`, `StudyLog`, and `FocusTimer`) already have stable IDs and SQLite-friendly primitive fields. When adding Tauri and SQLite, replace the adapter with a SQLite implementation and handle its asynchronous startup/save calls inside the study-data layer, without changing UI workflows.

This project does not include Tauri or SQLite yet. It does not require Supabase or a custom server.
```
