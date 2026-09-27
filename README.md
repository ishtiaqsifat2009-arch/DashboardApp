# Studyspace

**Studyspace** is a local-first study organizer built with **React, TypeScript, Vite, and Tauri**.

It is designed to be a simple, distraction-free workspace for managing schoolwork and study sessions without requiring an account, server, or internet connection.

### Features

* **Overview** — See study time, completed tasks, streaks, and upcoming work at a glance.
* **Tasks** — Create, complete, edit, and delete tasks.
* **Focus Timer** — Run focused study sessions and keep a record of your study time.
* **Study Plan** — Organize upcoming study sessions.
* **Notes** — Create and edit notes alongside your tasks.
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

Data is automati
