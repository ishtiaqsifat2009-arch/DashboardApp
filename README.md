# StudySpace

StudySpace is a local-first study organizer for managing coursework, focus sessions, flashcards, and notes without accounts or cloud services.

## Features

- **Dashboard:** See weekly focus time, completed tasks, upcoming study plans, and recent notes.
- **Tasks:** Create, complete, and delete tasks organized by subject and due date.
- **Focus timer:** Start, pause, resume, reset, cancel, and complete a timed study session.
- **Study sessions:** Plan sessions and start them directly in the focus timer.
- **Session history:** Review completed focus segments and delete records; study-time totals derive from the remaining history.
- **Flashcards:** Create and edit decks/cards, reveal answers, navigate through a deck, and review in original or shuffled order.
- **Markdown notes:** Browse, search, create, rename, edit, preview, and delete Markdown notes.
- **Local-first storage:** Data remains on the device. The app has no accounts, remote API, or cloud synchronization.
- **Desktop app:** Tauri builds the shared React application for Windows and macOS. Other Tauri desktop targets are configured but are not built by CI.

## Tech Stack

- React 19, TypeScript 6, and Vite 8
- Tauri 2 and Rust
- localStorage for tasks, study plans, timer state, flashcard decks, and session history
- App-local Markdown files for desktop notes; localStorage-backed Markdown records in browser development
- `react-markdown`, `remark-gfm`, and `yaml` for Markdown preview and frontmatter
- Node's built-in test runner and Rust unit tests

There is no database server, authentication service, or cloud storage dependency.

## Getting Started

Install Node.js and npm. From the `dashboard` directory:

```sh
npm ci
npm run dev
```

The browser development version saves study data to that browser origin's localStorage. It does not require environment variables, a backend, or an internet connection after dependencies are installed.

## Development

Run these commands from `dashboard`:

```sh
npm run dev
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

To run the Tauri desktop shell during development:

```sh
npm run tauri dev
```

Desktop development requires Rust stable and the platform's Tauri prerequisites. macOS requires Xcode Command Line Tools. Windows requires the Microsoft C++ Build Tools and Tauri's WebView2 prerequisites.

## Building

Build the desktop application for the current host platform from `dashboard`:

```sh
npm run tauri build
```

GitHub Actions builds Windows NSIS/MSI installers and macOS app/DMG packages from pushes to `main`; these are downloadable workflow artifacts. Pushing a version tag such as `v0.1.2` also attaches the Windows installers and macOS DMG to a GitHub Release. Current installers are unsigned.

## Project Structure

```text
dashboard/src/                 React UI, study state, persistence adapters, tests
dashboard/src-tauri/src/       Rust Tauri commands and desktop entry point
dashboard/src-tauri/icons/     Native platform app icons
.github/workflows/             Windows and macOS desktop build workflow
```

`studyData.ts` owns shared study state, reducer transitions, and timer lifecycle. `storage.ts` persists that shared document to localStorage and migrates legacy keys. `markdownNotes.ts` and `useMarkdownNotes.ts` parse and manage Markdown notes. Tauri commands in `src-tauri/src/lib.rs` confine desktop note files to the app-local notes directory.

## Notes

Desktop notes are individual `.md` files under Tauri's `AppLocalDataDir/notes`. For the current app identifier `com.dashboardapp.studyspace`, the usual locations are:

- macOS: `~/Library/Application Support/com.dashboardapp.studyspace/notes`
- Windows: `%LOCALAPPDATA%\com.dashboardapp.studyspace\notes`
- Linux: `$XDG_DATA_HOME/com.dashboardapp.studyspace/notes` (usually `~/.local/share/com.dashboardapp.studyspace/notes`)

Each file has YAML frontmatter for its stable ID, title, subject, creation time, and modified time, followed by normal Markdown content. Files without frontmatter are opened using the filename as the title. The editor supports direct Markdown entry and a GitHub-Flavored Markdown preview.

On first desktop launch after the Markdown upgrade, old note objects are imported into `.md` files. Before the active legacy notes field is cleared, a copy is retained in localStorage under `studyspace:legacy-notes-backup:v1`. Other StudySpace data is not cleared or migrated away. The browser version stores Markdown-file records in localStorage and does not write to the user's filesystem.

## Data & Persistence

Tasks, plans, timer state, flashcard decks, and focus-session history remain in the `studyspace:data:v1:local` localStorage document. Deleting a focus-history entry removes that record, so derived study-time totals update. Desktop Markdown notes use app-local files. All persistence is local to the device; there is no cloud synchronization.

## Cross-platform

The same React UI and study-data reducer run in the Tauri desktop app. Windows and macOS are the platforms built by the repository's CI workflow. Linux can use Tauri's configured desktop target but is not currently built by CI. Destructive confirmations are rendered by React rather than relying on platform WebView JavaScript dialogs.

## Contributing

1. Install dependencies with `npm ci` from `dashboard`.
2. Keep changes focused and preserve the local-first storage boundaries.
3. Run `npm test`, `npm run lint`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml --lib` before submitting.
4. For desktop changes, run `npm run tauri build` on the target platform or use the existing CI workflow.

## License

No license has been specified in this repository.
