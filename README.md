# Studyspace

**Studyspace** is a local-first study organizer built with **React, TypeScript, Vite, and Tauri**.

It is designed to be a simple, distraction-free workspace for managing schoolwork and study sessions without requiring an account, server, or internet connection.

### Features

* **Overview** — See study time, completed tasks, streaks, and upcoming work at a glance.
* **Tasks** — Create, complete, edit, and delete tasks.
* **Focus Timer** — Run focused study sessions and keep a record of your study time.
* **Study Plan** — Organize upcoming study sessions.
* **Flashcards** — Create and study decks in original or shuffled order.
* **Notes** — Search, edit, and organize notes with an optional sticky-note presentation.
* **Session history** — Cancel active timers or remove saved focus sessions and their study time.
* **Local-first storage** — Your data stays on your device.
* **Offline support** — No account or network connection is required.
* **Desktop app** — The same React application can run as a native desktop application through Tauri.

---

## Tech Stack

* **React** — UI
* **TypeScript** — Application logic and type safety
* **Vite** — Development and frontend build tooling
* **Tauri v2** — Desktop application shell
* **localStorage** — Current local persistence layer

There is currently **no backend, authentication, cloud database, or SQLite dependency**.

---

## Run Locally

From the `dashboard` directory:

```bash
npm install
npm run dev
```

The browser version works without:

* an account
* environment variables
* a backend
* an internet connection

Data is automatically saved to the browser's local storage and restored when the application is reopened.

Different browser profiles maintain separate local data.

### Data migration

Studyspace automatically migrates data from the previous:

```text
studyspace:data:v1
```

storage key, as well as a single unambiguous cache from the previous account-based format.

Migrated data is stored under:

```text
studyspace:data:v1:local
```

If multiple legacy account caches are detected, Studyspace leaves them untouched rather than potentially combining different users' data.

---

## Development Checks

Run the linter:

```bash
npm run lint
```

Build the production frontend:

```bash
npm run build
```

---

## Desktop Application

Studyspace can also be packaged as a desktop application using **Tauri v2**.

The desktop application uses the same React/Vite frontend rather than maintaining a separate UI.

### Requirements

For macOS development, install:

* Node.js
* Rust stable
* Xcode Command Line Tools

### Run the desktop app

```bash
npm run tauri dev
```

### Build the desktop app

```bash
npm run tauri build
```

On Apple Silicon, the production build currently generates:

```text
src-tauri/target/release/bundle/macos/Studyspace.app
src-tauri/target/release/bundle/dmg/Studyspace_0.1.0_aarch64.dmg
```

The desktop application continues to use the local storage adapter through Tauri's WebView. It does not require an account, server, network connection, or SQLite database.

---

## Downloads

GitHub Actions can build desktop installers for Windows and macOS.

Pushing to `main` creates platform-specific build artifacts that can be downloaded from the corresponding GitHub Actions workflow run.

Creating a version tag such as:

```bash
git tag v0.1.1
git push origin v0.1.1
```

builds the Windows and macOS installers and attaches them to a GitHub Release.

Current installers are unsigned, so Windows SmartScreen or macOS Gatekeeper may display their standard security warnings.

---

## Architecture

Studyspace uses a small separation between the application state and its persistence layer:

```text
React UI
   ↓
StudyData
   ↓
Storage Interface
   ↓
localStorage
```

### Application layer

`studyData.ts` contains the typed study entities, reducer logic, timer behavior, and UI-facing actions.

The main entities are:

* `StudyTask`
* `StudyNote`
* `PlannedSession`
* `StudyLog`
* `FocusTimer`

These entities use stable IDs and simple primitive fields, keeping the data model suitable for future database storage.

### Storage layer

`storage.ts` implements the `StudyDataStorage` interface.

The current adapter stores the complete `StudyData` document locally and handles:

* loading saved data
* saving changes
* storage failures
* legacy data migration

The React UI does not need to know how the data is persisted.

---

## Future Storage

The current storage layer is intentionally designed so that local persistence can eventually move from:

```text
localStorage
```

to:

```text
SQLite
```

without replacing the application's UI or study workflows.

The intended future architecture is:

```text
React + TypeScript
        ↓
     Tauri
        ↓
  StudyData layer
        ↓
  SQLite adapter
        ↓
    Local database
```

SQLite is **not currently implemented**.

There is also no planned requirement for Supabase or a custom server for the core application. Cloud synchronization could be added later as an optional feature if cross-device functionality becomes necessary.

---

## Project Status

Studyspace is currently a functional local-first study application with:

* task management
* notes
* study planning
* focus timing
* study history
* persistent local data
* browser support
* Tauri desktop support
* Windows/macOS build automation

The next major architectural step is replacing the localStorage adapter with a local SQLite database while keeping the existing React application and user workflows intact.
