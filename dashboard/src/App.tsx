import { check } from "@tauri-apps/plugin-updater"
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import remarkGfm from "remark-gfm"
import { useConfirmation } from "./confirmContext"
import type { MarkdownNote } from "./markdownNotes"
import { useMarkdownNotes } from "./useMarkdownNotes"
import {
  createId,
  getLocalDate,
  useStudyData,
  type Flashcard,
  type FlashcardDeck,
  type StudyLog,
  type PlannedSession,
  type StudyTask,
} from "./studyData"
import studySpaceIcon from "./assets/StudySpaceIcon.jpg"
import "./App.css"

const ReactMarkdown = lazy(() => import("react-markdown"))

type Page = "overview" | "tasks" | "timer" | "plan" | "notes" | "flashcards"
type IconName = Page | "arrow" | "clock"

const navigation: { page: Page; label: string; icon: IconName }[] = [
  { page: "overview", label: "Overview", icon: "overview" },
  { page: "tasks", label: "My Tasks", icon: "tasks" },
  { page: "timer", label: "Focus Timer", icon: "clock" },
  { page: "plan", label: "Study Plan", icon: "plan" },
  { page: "notes", label: "Notes", icon: "notes" },
  { page: "flashcards", label: "Flashcards", icon: "flashcards" },
]

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    tasks: <><path d="m5 12 4 4L19 6" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>,
    plan: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    notes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    flashcards: <><rect x="4" y="5" width="14" height="15" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v11M8 10h6M8 14h6" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainder = totalSeconds % 60
  if (hours === 0) return `${minutes}m ${remainder}s`
  return `${hours}h ${minutes}m`
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0")
  const remainder = (seconds % 60).toString().padStart(2, "0")
  return `${minutes}:${remainder}`
}

function formatDate(dateString: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`)
  return date.toLocaleDateString(undefined, options)
}

function confirmAction(confirm: ReturnType<typeof useConfirmation>, title: string, message: string, action: () => void, confirmLabel = "Delete") {
  void confirm({ title, message, confirmLabel }).then((accepted) => {
    if (accepted) action()
  })
}

function createDefaultPlanTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(1)

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return currentTime
}

function weeklyActivity(logs: { startedAt: number; durationSeconds: number }[], timer: ReturnType<typeof useStudyData>["data"]["timer"], currentTime: number) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    return { date, seconds: 0 }
  })

  for (const log of logs) {
    const dateKey = getLocalDate(new Date(log.startedAt))
    const day = days.find((item) => getLocalDate(item.date) === dateKey)
    if (day) day.seconds += log.durationSeconds
  }

  if (timer.isRunning && timer.segmentStartedAt !== null) {
    const dateKey = getLocalDate(new Date(timer.segmentStartedAt))
    const day = days.find((item) => getLocalDate(item.date) === dateKey)
    if (day) day.seconds += Math.max(0, Math.floor((currentTime - timer.segmentStartedAt) / 1000))
  }

  const maximum = Math.max(...days.map((day) => day.seconds))
  return days.map((day, index) => ({
    key: getLocalDate(day.date),
    label: day.date.toLocaleDateString(undefined, { weekday: "narrow" }),
    seconds: day.seconds,
    amount: maximum === 0 ? 0 : Math.max(5, (day.seconds / maximum) * 100),
    isToday: index === 6,
  }))
}

function PageHeading({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow"><span className="status-dot" /> {kicker}</div>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </header>
  )
}

function TaskRows({ tasks, onToggle, onDelete, emptyText }: {
  tasks: StudyTask[]
  onToggle: (id: string) => void
  onDelete?: (id: string) => void
  emptyText: string
}) {
  const confirm = useConfirmation()
  if (tasks.length === 0) return <p className="empty-state">{emptyText}</p>

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li className={`task-item${task.completed ? " is-done" : ""}`} key={task.id}>
          <button
            className="task-check"
            type="button"
            onClick={() => onToggle(task.id)}
            aria-label={`${task.completed ? "Mark incomplete" : "Complete"}: ${task.title}`}
            aria-pressed={task.completed}
          >
            {task.completed && <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-6" /></svg>}
          </button>
          <span className="task-copy">
            <strong>{task.title}</strong>
            <span>{task.subject} <i /> Due {formatDate(task.dueDate, { month: "short", day: "numeric", year: "numeric" })}</span>
          </span>
          {onDelete && <button className="quiet-button danger-button" type="button" onClick={() => confirmAction(confirm, "Delete this task?", `“${task.title}” will be removed from your tasks.`, () => onDelete(task.id))} aria-label={`Delete ${task.title}`}>Delete</button>}
        </li>
      ))}
    </ul>
  )
}

function Overview({ data, notes, actions, onNavigate }: {
  data: ReturnType<typeof useStudyData>["data"]
  notes: MarkdownNote[]
  actions: ReturnType<typeof useStudyData>["actions"]
  onNavigate: (page: Page) => void
}) {
  const currentTime = useCurrentTime()
  const today = getLocalDate()
  const todayTasks = data.tasks.filter((task) => task.dueDate === today)
  const completedCount = data.tasks.filter((task) => task.completed).length
  const nextPlanItem = data.plan.find((item) => new Date(item.startsAt).getTime() >= currentTime)
  const latestNote = [...notes].sort((left, right) => right.updatedAt - left.updatedAt)[0]
  const activity = weeklyActivity(data.logs, data.timer, currentTime)
  const studySeconds = activity.reduce((total, day) => total + day.seconds, 0)
  const timer = data.timer
  const timerProgress = Math.min(100, Math.max(0, ((timer.durationMinutes * 60 - timer.remainingSeconds) / (timer.durationMinutes * 60)) * 100))

  return (
    <>
      <PageHeading
        kicker="YOUR STUDY SPACE"
        title="Good evening"
        subtitle="A little progress today goes a long way."
        action={<div className="date-chip"><Icon name="plan" /><span>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div>}
      />

      <section className="stats-grid" aria-label="Study summary">
        <article className="stat-card"><span className="stat-label">STUDY TIME THIS WEEK</span><div className="stat-value">{formatDuration(studySeconds)}</div><span className="stat-note">From your focus sessions</span></article>
        <article className="stat-card"><span className="stat-label">TASKS COMPLETED</span><div className="stat-value">{completedCount}<span> / {data.tasks.length}</span></div><span className="stat-note">Across all your subjects</span></article>
        <article className="stat-card"><span className="stat-label">UPCOMING SESSIONS</span><div className="stat-value">{data.plan.filter((item) => new Date(item.startsAt).getTime() >= currentTime).length}</div><span className="stat-note">On your study plan</span></article>
      </section>

      <section className="dashboard-grid" aria-label="Study dashboard">
        <article className="panel focus-panel">
          <div className="panel-heading">
            <div><span className="section-kicker">YOUR FOCUS SESSION</span><h2>{timer.topic || "Focused study"}</h2></div>
            <span className="panel-icon"><Icon name="clock" /></span>
          </div>
          <div className="course-row">
            <div className="course-symbol">{timer.subject.slice(0, 1).toUpperCase() || "S"}</div>
            <div className="course-details"><strong>{timer.subject || "Choose a subject"}</strong><span>{timer.isRunning ? "Session in progress" : timer.remainingSeconds === 0 ? "Session complete" : `${timer.durationMinutes} minute session`}</span></div>
            <span className="course-percent">{timer.remainingSeconds === 0 ? "Done" : formatTimer(timer.remainingSeconds)}</span>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Focus session progress" aria-valuenow={Math.round(timerProgress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${timerProgress}%` }} /></div>
          <div className="focus-footer">
            <button className="text-button" type="button" onClick={() => onNavigate("timer")}>Timer settings <Icon name="arrow" /></button>
            <button className="primary-button" type="button" onClick={() => {
              if (timer.isRunning) actions.pauseTimer()
              else {
                if (timer.remainingSeconds === 0) actions.resetTimer()
                actions.startTimer()
              }
            }}>
              {timer.isRunning ? "Pause session" : timer.remainingSeconds === 0 ? "Start next session" : timer.remainingSeconds < timer.durationMinutes * 60 ? "Resume session" : "Start session"}
              <Icon name="arrow" />
            </button>
          </div>
        </article>

        <article className="panel tasks-panel">
          <div className="panel-heading"><div><span className="section-kicker">STAY ON TRACK</span><h2>Today's tasks</h2></div><span className="task-count">{todayTasks.filter((task) => task.completed).length}/{todayTasks.length}</span></div>
          <TaskRows tasks={todayTasks} onToggle={actions.toggleTask} emptyText="Nothing due today. Add a task to get started." />
          <button className="text-button" type="button" onClick={() => onNavigate("tasks")}>Manage all tasks <Icon name="arrow" /></button>
        </article>

        <article className="panel activity-panel">
          <div className="panel-heading"><div><span className="section-kicker">BUILT FROM YOUR SESSIONS</span><h2>This week's focus</h2></div><span className="activity-total">{formatDuration(studySeconds)}</span></div>
          <div className="chart" role="img" aria-label="Study activity by day this week">
            {activity.map((day) => <div className={`chart-column${day.isToday ? " is-today" : ""}`} key={day.key}><div className="chart-bar-wrap"><span className="chart-bar" style={{ height: `${day.amount}%` }} /></div><span className="chart-day">{day.label}</span></div>)}
          </div>
          {studySeconds === 0 && <p className="chart-empty">Completed focus time will appear here.</p>}
        </article>

        <article className="panel reminder-panel">
          <div className="reminder-topline"><span className="section-kicker">UP NEXT</span>{nextPlanItem && <span className="reminder-tag">{formatDate(nextPlanItem.startsAt)}</span>}</div>
          {nextPlanItem ? <><h2>{nextPlanItem.title}</h2><p>{nextPlanItem.subject} · {new Date(nextPlanItem.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {nextPlanItem.durationMinutes} min</p><button className="text-button" type="button" onClick={() => onNavigate("plan")}>Open study plan <Icon name="arrow" /></button></> : <><h2>Your plan starts here</h2><p>Add a session to organize what's coming up.</p><button className="text-button" type="button" onClick={() => onNavigate("plan")}>Plan a study session <Icon name="arrow" /></button></>}
        </article>

        <article className="panel note-summary">
          <div className="panel-heading"><div><span className="section-kicker">YOUR NOTES</span><h2>{notes.length} saved {notes.length === 1 ? "note" : "notes"}</h2></div><span className="panel-icon"><Icon name="notes" /></span></div>
          <p className="note-preview">{latestNote ? latestNote.title : "Keep the ideas you want to remember in one place."}</p>
          <button className="text-button" type="button" onClick={() => onNavigate("notes")}>{latestNote ? "Open notes" : "Write your first note"} <Icon name="arrow" /></button>
        </article>
      </section>
    </>
  )
}

function TasksPage({ tasks, onAdd, onToggle, onDelete }: {
  tasks: StudyTask[]
  onAdd: (task: Omit<StudyTask, "id" | "createdAt" | "completed">) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("Physics")
  const [dueDate, setDueDate] = useState(getLocalDate())
  const filteredTasks = tasks.filter((task) => filter === "all" || (filter === "completed" ? task.completed : !task.completed))
  const completedCount = tasks.filter((task) => task.completed).length

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanSubject = subject.trim()
    if (!cleanTitle || !cleanSubject) return
    onAdd({ title: cleanTitle, subject: cleanSubject, dueDate })
    setTitle("")
  }

  return (
    <>
      <PageHeading kicker="KEEP IT MOVING" title="My tasks" subtitle={`${completedCount} of ${tasks.length} tasks completed.`} />
      <div className="management-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><span className="section-kicker">MAKE A PLAN</span><h2>Add a task</h2></div></div>
          <form className="data-form" onSubmit={submitTask}>
            <label className="field"><span>Task name</span><input autoFocus={false} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Review Newton's laws" required value={title} /></label>
            <label className="field"><span>Subject or category</span><input list="study-subjects" maxLength={40} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Physics" required value={subject} /><datalist id="study-subjects"><option value="Physics" /><option value="Biology" /><option value="Calculus" /><option value="Chemistry" /><option value="Modern history" /></datalist></label>
            <label className="field"><span>Due date</span><input onChange={(event) => setDueDate(event.target.value)} required type="date" value={dueDate} /></label>
            <button className="primary-button form-submit" type="submit">Add task <Icon name="arrow" /></button>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="panel-heading list-heading"><div><span className="section-kicker">YOUR WORKLOAD</span><h2>All tasks <span className="inline-count">{tasks.length}</span></h2></div><div className="filter-tabs" aria-label="Filter tasks">{(["all", "active", "completed"] as const).map((value) => <button className={filter === value ? "is-selected" : ""} key={value} onClick={() => setFilter(value)} type="button">{value === "all" ? "All" : value === "active" ? "To do" : "Done"}</button>)}</div></div>
          <TaskRows tasks={filteredTasks} onToggle={onToggle} onDelete={onDelete} emptyText={filter === "all" ? "No tasks yet. Add your first one." : `No ${filter === "active" ? "open" : "completed"} tasks.`} />
        </section>
      </div>
    </>
  )
}

function TimerPage({ timer, logs, onConfigure, onStart, onPause, onReset, onDeleteLog }: {
  timer: ReturnType<typeof useStudyData>["data"]["timer"]
  logs: StudyLog[]
  onConfigure: (subject: string, topic: string, durationMinutes: number) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onDeleteLog: (id: string) => void
}) {
  const confirm = useConfirmation()
  const progress = Math.min(100, Math.max(0, ((timer.durationMinutes * 60 - timer.remainingSeconds) / (timer.durationMinutes * 60)) * 100))
  const completed = timer.remainingSeconds === 0
  const hasProgress = timer.remainingSeconds < timer.durationMinutes * 60

  function startOrRestart() {
    if (completed) onReset()
    onStart()
  }

  return (
    <>
      <PageHeading kicker="ONE THING AT A TIME" title="Focus timer" subtitle="Set a subject and give it your full attention." />
      <div className="timer-layout">
        <section className="panel timer-panel">
          <span className="section-kicker">{timer.isRunning ? "SESSION IN PROGRESS" : completed ? "SESSION COMPLETE" : "CURRENT SESSION"}</span>
          <div className={`timer-display${completed ? " is-complete" : ""}`} role="timer" aria-label={completed ? "Focus session complete" : `${Math.floor(timer.remainingSeconds / 60)} minutes and ${timer.remainingSeconds % 60} seconds remaining`}>{completed ? "Done" : formatTimer(timer.remainingSeconds)}</div>
          <div className="timer-session-title">{completed ? "A focused block, finished." : timer.topic || "Focused study"}</div>
          <div className="timer-session-subject">{timer.subject || "Choose a subject"} <i /> {timer.durationMinutes} minute session</div>
          <div className="progress-track timer-progress" role="progressbar" aria-label="Focus timer progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <div className="timer-controls">
            <button className="primary-button timer-main-button" onClick={timer.isRunning ? onPause : startOrRestart} type="button">{timer.isRunning ? "Pause" : completed ? "Start next session" : hasProgress ? "Resume" : "Start focus session"}</button>
            <button className="quiet-button" onClick={() => {
              if (hasProgress && !completed) confirmAction(confirm, "Cancel this focus session?", "The active segment will be discarded. Previously saved focus time will remain in your history.", onReset, "Cancel session")
              else onReset()
            }} type="button">{completed ? "Reset timer" : hasProgress ? "Cancel session" : "Reset"}</button>
          </div>
          <p className="timer-persistence"><span className="status-dot" /> {completed ? "This session is complete and saved in your history." : "Your timer is saved on this device and continues if you change sections."}</p>
        </section>
        <section className="panel form-panel timer-settings">
          <div className="panel-heading"><div><span className="section-kicker">SESSION DETAILS</span><h2>What are you working on?</h2></div></div>
          <div className="data-form">
            <label className="field"><span>Subject</span><input disabled={timer.isRunning} list="timer-subjects" maxLength={40} onChange={(event) => onConfigure(event.target.value, timer.topic, timer.durationMinutes)} value={timer.subject} /><datalist id="timer-subjects"><option value="Physics" /><option value="Biology" /><option value="Calculus" /><option value="Chemistry" /><option value="Modern history" /></datalist></label>
            <label className="field"><span>Session focus</span><input disabled={timer.isRunning} maxLength={80} onChange={(event) => onConfigure(timer.subject, event.target.value, timer.durationMinutes)} placeholder="e.g. Chapter 4 review" value={timer.topic} /></label>
            <label className="field"><span>Duration in minutes</span><input disabled={timer.isRunning} max={120} min={1} onChange={(event) => onConfigure(timer.subject, timer.topic, Number(event.target.value) || 1)} type="number" value={timer.durationMinutes} /></label>
          </div>
        </section>
      </div>
      <section className="panel session-history">
        <div className="panel-heading"><div><span className="section-kicker">YOUR FOCUS HISTORY</span><h2>Completed sessions <span className="inline-count">{logs.length}</span></h2></div></div>
        {logs.length === 0 ? <p className="empty-state">Completed focus sessions will appear here.</p> : <div className="record-list">{[...logs].sort((left, right) => right.startedAt - left.startedAt).map((log) => <article className="session-row" key={log.id}><div className="session-row-copy"><strong>{log.topic || "Focused study"}</strong><span>{log.subject} <i /> {new Date(log.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div><span className="session-duration">{formatDuration(log.durationSeconds)}</span><button className="quiet-button danger-button" onClick={() => confirmAction(confirm, "Delete this focus session?", `${formatDuration(log.durationSeconds)} will be removed from your study-time history.`, () => onDeleteLog(log.id))} type="button">Delete</button></article>)}</div>}
      </section>
    </>
  )
}

function NotesPage({ notes, isLoading, error, onSave, onDelete }: {
  notes: MarkdownNote[]
  isLoading: boolean
  error: string | null
  onSave: (note: MarkdownNote) => Promise<MarkdownNote | null>
  onDelete: (note: MarkdownNote) => Promise<boolean>
}) {
  const confirm = useConfirmation()
  const initialized = useRef(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("General")
  const [content, setContent] = useState("")
  const [search, setSearch] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null
  const filteredNotes = [...notes]
    .filter((note) => `${note.title} ${note.subject} ${note.content}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => right.updatedAt - left.updatedAt)

  useEffect(() => {
    if (isLoading || initialized.current) return
    initialized.current = true
    if (notes[0]) loadNote(notes[0])
  }, [isLoading, notes])

  function clearEditor() {
    setSelectedId(null)
    setTitle("")
    setSubject("General")
    setContent("")
    setIsDirty(false)
    setPreview(false)
  }

  function loadNote(note: MarkdownNote) {
    setSelectedId(note.id)
    setTitle(note.title)
    setSubject(note.subject)
    setContent(note.content)
    setIsDirty(false)
    setPreview(false)
  }

  function createNote() {
    void (async () => {
      if (isDirty && !await confirm({ title: "Discard unsaved changes?", message: "Your edits to this note have not been saved.", confirmLabel: "Discard changes" })) return
      clearEditor()
    })()
  }

  function selectNote(note: MarkdownNote) {
    void (async () => {
      if (isDirty && !await confirm({ title: "Discard unsaved changes?", message: "Your edits to this note have not been saved.", confirmLabel: "Discard changes" })) return
      loadNote(note)
    })()
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanSubject = subject.trim() || "General"
    if (!cleanTitle) return
    const saved = await onSave({
      id: selectedId ?? createId(),
      title: cleanTitle,
      subject: cleanSubject,
      content,
      createdAt: selectedNote?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      fileName: selectedNote?.fileName ?? "",
    })
    if (saved) loadNote(saved)
  }

  function deleteSelectedNote() {
    if (!selectedNote) return
    void (async () => {
      const confirmed = await confirm({ title: "Delete this Markdown note?", message: `“${selectedNote.title}” will be removed from your StudySpace notes folder.` })
      if (confirmed && await onDelete(selectedNote)) clearEditor()
    })()
  }

  return (
    <>
      <PageHeading kicker="IDEAS WORTH KEEPING" title="Notes" subtitle="Write in Markdown and keep your notes on this device." action={<button className="primary-button" disabled={isLoading} onClick={createNote} type="button">New note</button>} />
      <div className="management-layout notes-layout">
        <section className="panel notes-library">
          <div className="panel-heading"><div><span className="section-kicker">YOUR FILES</span><h2>Notes <span className="inline-count">{notes.length}</span></h2></div></div>
          <label className="field notes-search"><span>Search notes</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Title, subject, or text" type="search" value={search} /></label>
          {isLoading ? <p className="empty-state">Loading your Markdown notes...</p> : notes.length === 0 ? <p className="empty-state">No notes yet. Create a note to start your local Markdown library.</p> : filteredNotes.length === 0 ? <p className="empty-state">No notes match that search.</p> : <div className="note-library-list">{filteredNotes.map((note) => <button aria-current={selectedId === note.id ? "true" : undefined} className={`note-list-item${selectedId === note.id ? " is-selected" : ""}`} key={note.id} onClick={() => selectNote(note)} type="button"><span className="note-list-meta"><span>{note.subject}</span><span>.md</span></span><strong>{note.title}</strong><span className="note-list-excerpt">{note.content || "No content yet"}</span><time>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></button>)}</div>}
        </section>
        <section className="panel note-editor-panel">
          <div className="panel-heading"><div><span className="section-kicker">{selectedNote ? "MARKDOWN FILE" : "NEW NOTE"}</span><h2>{selectedNote ? selectedNote.title : "Write a note"}</h2></div>{selectedNote && <button className="quiet-button danger-button" onClick={deleteSelectedNote} type="button">Delete note</button>}</div>
          {error && <p className="storage-warning" role="alert">Could not save your notes: {error}</p>}
          {isLoading ? <p className="empty-state">Opening your notes folder...</p> : selectedNote || selectedId === null ? <form className="data-form" onSubmit={submitNote}>
            <label className="field"><span>Title</span><input maxLength={100} onChange={(event) => { setTitle(event.target.value); setIsDirty(true) }} placeholder="A clear, memorable title" required value={title} /></label>
            <label className="field"><span>Subject</span><input maxLength={40} onChange={(event) => { setSubject(event.target.value); setIsDirty(true) }} placeholder="e.g. Biology" value={subject} /></label>
            <div className="note-mode-row"><div className="filter-tabs" aria-label="Note view"><button aria-pressed={!preview} className={!preview ? "is-selected" : ""} onClick={() => setPreview(false)} type="button">Write</button><button aria-pressed={preview} className={preview ? "is-selected" : ""} onClick={() => setPreview(true)} type="button">Preview</button></div><span className="note-file-name">{selectedNote?.fileName ?? "New Markdown note"}</span></div>
            {preview ? <div className="markdown-preview">{content ? <Suspense fallback={<p className="empty-state">Rendering preview...</p>}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></Suspense> : <p className="empty-state">Your Markdown preview will appear here.</p>}</div> : <label className="field"><span>Markdown</span><textarea className="note-content-input" maxLength={20000} onChange={(event) => { setContent(event.target.value); setIsDirty(true) }} placeholder={"# Topic\n\nWrite Markdown here...\n\n- [ ] Review this later"} rows={16} value={content} /></label>}
            <div className="note-save-row"><span>{selectedNote ? `Modified ${new Date(selectedNote.updatedAt).toLocaleString()}` : "Markdown is saved locally when you save this note."}</span><div className="form-actions"><button className="primary-button form-submit" type="submit">{selectedNote ? "Save changes" : "Save note"}</button>{selectedNote && isDirty && <button className="quiet-button" onClick={() => loadNote(selectedNote)} type="button">Discard changes</button>}</div></div>
          </form> : <p className="empty-state">Choose a note to edit, or create a new one.</p>}
        </section>
      </div>
    </>
  )
}

function shuffledCardIds(cards: Flashcard[]) {
  const cardIds = cards.map((card) => card.id)
  for (let index = cardIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[cardIds[index], cardIds[swapIndex]] = [cardIds[swapIndex], cardIds[index]]
  }
  return cardIds
}

function FlashcardsPage({ decks, onAddDeck, onDeleteDeck, onRenameDeck, onAddCard, onEditCard, onDeleteCard }: {
  decks: FlashcardDeck[]
  onAddDeck: (name: string) => string
  onDeleteDeck: (id: string) => void
  onRenameDeck: (id: string, name: string) => void
  onAddCard: (deckId: string, question: string, answer: string) => void
  onEditCard: (deckId: string, card: Flashcard) => void
  onDeleteCard: (deckId: string, cardId: string) => void
}) {
  const confirm = useConfirmation()
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() => decks[0]?.id ?? null)
  const [newDeckName, setNewDeckName] = useState("")
  const [deckName, setDeckName] = useState(() => decks[0]?.name ?? "")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [orderMode, setOrderMode] = useState<"original" | "shuffled">("original")
  const [studyOrder, setStudyOrder] = useState<string[]>([])
  const [studyIndex, setStudyIndex] = useState(0)
  const [isStudying, setIsStudying] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null
  const orderedCards = studyOrder.map((id) => selectedDeck?.cards.find((card) => card.id === id)).filter((card): card is Flashcard => card !== undefined)
  const currentCard = orderedCards[studyIndex]

  function selectDeck(deck: FlashcardDeck) {
    setSelectedDeckId(deck.id)
    setDeckName(deck.name)
    setEditingCardId(null)
    setQuestion("")
    setAnswer("")
    setIsStudying(false)
    setIsFinished(false)
  }

  function submitDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = newDeckName.trim()
    if (!cleanName) return
    const id = onAddDeck(cleanName)
    setSelectedDeckId(id)
    setDeckName(cleanName)
    setNewDeckName("")
    setEditingCardId(null)
    setQuestion("")
    setAnswer("")
    setIsStudying(false)
  }

  function renameSelectedDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = deckName.trim()
    if (selectedDeck && cleanName) onRenameDeck(selectedDeck.id, cleanName)
  }

  function resetCardForm() {
    setEditingCardId(null)
    setQuestion("")
    setAnswer("")
  }

  function editCard(card: Flashcard) {
    setEditingCardId(card.id)
    setQuestion(card.question)
    setAnswer(card.answer)
  }

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDeck) return
    const cleanQuestion = question.trim()
    const cleanAnswer = answer.trim()
    if (!cleanQuestion || !cleanAnswer) return
    if (editingCardId) onEditCard(selectedDeck.id, { id: editingCardId, question: cleanQuestion, answer: cleanAnswer })
    else onAddCard(selectedDeck.id, cleanQuestion, cleanAnswer)
    resetCardForm()
  }

  function beginStudy(cardIds = orderMode === "shuffled" ? shuffledCardIds(selectedDeck?.cards ?? []) : (selectedDeck?.cards ?? []).map((card) => card.id)) {
    setStudyOrder(cardIds)
    setStudyIndex(0)
    setShowAnswer(false)
    setIsFinished(false)
    setIsStudying(true)
  }

  function advanceStudy() {
    if (studyIndex >= orderedCards.length - 1) {
      setIsFinished(true)
      return
    }
    setStudyIndex((index) => index + 1)
    setShowAnswer(false)
  }

  return (
    <>
      <PageHeading kicker="RECALL WHAT YOU LEARN" title="Flashcards" subtitle="Build a deck, then work through it one prompt at a time." />
      <div className="management-layout flashcards-layout">
        <section className="panel deck-library">
          <div className="panel-heading"><div><span className="section-kicker">YOUR DECKS</span><h2>Study sets <span className="inline-count">{decks.length}</span></h2></div></div>
          <form className="deck-create-form" onSubmit={submitDeck}><label className="field"><span>New deck name</span><input maxLength={80} onChange={(event) => setNewDeckName(event.target.value)} placeholder="e.g. Biology exam" required value={newDeckName} /></label><button className="primary-button" type="submit">Create deck</button></form>
          {decks.length === 0 ? <p className="empty-state">Your decks will appear here. Create one to get started.</p> : <div className="deck-list">{decks.map((deck) => <div className={`deck-list-row${selectedDeckId === deck.id ? " is-selected" : ""}`} key={deck.id}><button aria-current={selectedDeckId === deck.id ? "true" : undefined} className="deck-select" onClick={() => selectDeck(deck)} type="button"><strong>{deck.name}</strong><span>{deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}</span></button><button aria-label={`Delete ${deck.name}`} className="quiet-button danger-button" onClick={() => confirmAction(confirm, "Delete this flashcard deck?", `“${deck.name}” and its ${deck.cards.length} ${deck.cards.length === 1 ? "card" : "cards"} will be removed.`, () => { onDeleteDeck(deck.id); if (selectedDeckId === deck.id) { setSelectedDeckId(null); setDeckName(""); setIsStudying(false); setIsFinished(false) } })} type="button">Delete</button></div>)}</div>}
        </section>
        <section className="panel deck-detail">
          {!selectedDeck ? <><div className="panel-heading"><div><span className="section-kicker">READY WHEN YOU ARE</span><h2>Choose a deck</h2></div></div><p className="empty-state">Select a study set or create a new deck to add your first card.</p></> : <>
            <div className="panel-heading deck-detail-heading"><div><span className="section-kicker">{isStudying ? "STUDY MODE" : "DECK CONTENTS"}</span><h2>{selectedDeck.name}</h2></div><span className="inline-count">{selectedDeck.cards.length}</span></div>
            {!isStudying && <>
              <form className="deck-rename-form" onSubmit={renameSelectedDeck}><label className="field"><span>Deck name</span><input maxLength={80} onChange={(event) => setDeckName(event.target.value)} required value={deckName} /></label><button className="quiet-button" type="submit">Rename</button></form>
              <div className="study-start-row"><label className="field"><span>Card order</span><select onChange={(event) => setOrderMode(event.target.value as "original" | "shuffled")} value={orderMode}><option value="original">Original order</option><option value="shuffled">Shuffled</option></select></label><button className="primary-button" disabled={selectedDeck.cards.length === 0} onClick={() => beginStudy()} type="button">Study deck</button></div>
              <form className="data-form card-editor-form" onSubmit={submitCard}><div className="panel-heading"><div><span className="section-kicker">{editingCardId ? "EDIT CARD" : "ADD TO THIS DECK"}</span><h3>{editingCardId ? "Update flashcard" : "New flashcard"}</h3></div></div><label className="field"><span>Front / question</span><textarea maxLength={1000} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you want to remember?" required rows={3} value={question} /></label><label className="field"><span>Back / answer</span><textarea maxLength={2000} onChange={(event) => setAnswer(event.target.value)} placeholder="Write the answer or explanation..." required rows={3} value={answer} /></label><div className="form-actions"><button className="primary-button" type="submit">{editingCardId ? "Save card" : "Add card"}</button>{editingCardId && <button className="quiet-button" onClick={resetCardForm} type="button">Cancel edit</button>}</div></form>
              {selectedDeck.cards.length === 0 ? <p className="empty-state">This deck is empty. Add a question and answer above.</p> : <div className="flashcard-list">{selectedDeck.cards.map((card, index) => <article className="flashcard-row" key={card.id}><span className="flashcard-number">{index + 1}</span><div className="flashcard-copy"><strong>{card.question}</strong><span>{card.answer}</span></div><div className="flashcard-actions"><button className="quiet-button" onClick={() => editCard(card)} type="button">Edit</button><button className="quiet-button danger-button" onClick={() => confirmAction(confirm, "Delete this flashcard?", `“${card.question}” will be removed from this deck.`, () => onDeleteCard(selectedDeck.id, card.id))} type="button">Delete</button></div></article>)}</div>}
            </>}
            {isStudying && (isFinished ? <div className="study-complete"><span className="section-kicker">DECK COMPLETE</span><h3>That’s the set.</h3><p>You reviewed {orderedCards.length} {orderedCards.length === 1 ? "card" : "cards"}.</p><div className="form-actions"><button className="primary-button" onClick={() => beginStudy(studyOrder)} type="button">Review again</button><button className="quiet-button" onClick={() => setIsStudying(false)} type="button">Back to deck</button></div></div> : currentCard ? <div className="study-session"><div className="study-progress-line"><span>{studyIndex + 1} / {orderedCards.length}</span><button className="quiet-button" onClick={() => setIsStudying(false)} type="button">Exit study</button></div><button aria-label={showAnswer ? "Show question" : "Reveal answer"} aria-pressed={showAnswer} className={`study-flashcard${showAnswer ? " is-revealed" : ""}`} onClick={() => setShowAnswer((revealed) => !revealed)} type="button"><span className="section-kicker">{showAnswer ? "ANSWER" : "QUESTION"}</span><span className="study-card-copy">{showAnswer ? currentCard.answer : currentCard.question}</span><span className="study-card-hint">{showAnswer ? "Show question" : "Reveal answer"}</span></button><div className="study-navigation"><button className="quiet-button" disabled={studyIndex === 0} onClick={() => { setStudyIndex((index) => Math.max(0, index - 1)); setShowAnswer(false) }} type="button">Previous</button><button className="primary-button" onClick={advanceStudy} type="button">{studyIndex === orderedCards.length - 1 ? "Finish deck" : "Next card"}</button></div></div> : <p className="empty-state">No cards remain in this study order. Start again to refresh the deck.</p>)}
          </>}
        </section>
      </div>
    </>
  )
}

function StudyPlanPage({ plan, onAdd, onDelete, onStart }: {
  plan: PlannedSession[]
  onAdd: (item: Omit<PlannedSession, "id">) => void
  onDelete: (id: string) => void
  onStart: (item: PlannedSession) => void
}) {
  const confirm = useConfirmation()
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("Physics")
  const [startsAt, setStartsAt] = useState(createDefaultPlanTime)
  const [durationMinutes, setDurationMinutes] = useState(45)

  function submitPlanItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanSubject = subject.trim()
    if (!cleanTitle || !cleanSubject) return
    onAdd({ title: cleanTitle, subject: cleanSubject, startsAt, durationMinutes })
    setTitle("")
  }

  const sortedPlan = [...plan].sort((left, right) => left.startsAt.localeCompare(right.startsAt))

  return (
    <>
      <PageHeading kicker="MAKE ROOM TO LEARN" title="Study plan" subtitle="Put a subject, a date, and a little time on the calendar." />
      <div className="management-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><span className="section-kicker">LOOKING AHEAD</span><h2>Plan a session</h2></div></div>
          <form className="data-form" onSubmit={submitPlanItem}>
            <label className="field"><span>Session or task</span><input maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Physics problem set" required value={title} /></label>
            <label className="field"><span>Subject</span><input maxLength={40} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Physics" required value={subject} /></label>
            <label className="field"><span>Date and time</span><input onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></label>
            <label className="field"><span>Planned duration</span><div className="input-suffix"><input max={180} min={5} onChange={(event) => setDurationMinutes(Math.min(180, Math.max(5, Number(event.target.value) || 5)))} type="number" value={durationMinutes} /><span>minutes</span></div></label>
            <button className="primary-button form-submit" type="submit">Add to study plan <Icon name="arrow" /></button>
          </form>
        </section>
        <section className="panel list-panel">
          <div className="panel-heading"><div><span className="section-kicker">UPCOMING</span><h2>Planned sessions <span className="inline-count">{plan.length}</span></h2></div></div>
          {sortedPlan.length === 0 ? <p className="empty-state">Your schedule is clear. Add a session to plan your next study block.</p> : <div className="record-list">{sortedPlan.map((item) => <article className="record-card plan-card" key={item.id}><div className="record-topline"><span className="record-subject">{item.subject}</span><time>{new Date(item.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</time></div><h3>{item.title}</h3><p>{new Date(item.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} <i /> {item.durationMinutes} min</p><div className="record-actions"><button className="quiet-button accent-button" onClick={() => onStart(item)} type="button">Start session</button><button className="quiet-button danger-button" onClick={() => confirmAction(confirm, "Remove this planned session?", `“${item.title}” will be removed from your study plan.`, () => onDelete(item.id))} type="button">Remove</button></div></article>)}</div>}
        </section>
      </div>
    </>
  )
}

function App() {
  const { data, actions, storageError } = useStudyData()
  const [activePage, setActivePage] = useState<Page>("overview")
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const markdownNotes = useMarkdownNotes(data.notes, actions.clearLegacyNotes)

  useEffect(() => {
    const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown }
    if (!tauriWindow.__TAURI_INTERNALS__) return

    let cancelled = false
    void (async () => {
      try {
        const result = await check()
        if (cancelled) return
        if (!result) {
          setUpdateMessage("Update check unavailable.")
          return
        }
        if (result.available) {
          setUpdateMessage(`Update available: ${result.version}`)
          await result.downloadAndInstall()
          setUpdateMessage("Update installed; relaunch to continue.")
          return
        }
        setUpdateMessage("App is up to date.")
      } catch {
        if (!cancelled) {
          setUpdateMessage("Update check unavailable.")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function startPlannedSession(item: PlannedSession) {
    actions.configureTimer(item.subject, item.title, item.durationMinutes)
    actions.startTimer()
    setActivePage("timer")
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setActivePage("overview") }} aria-label="Studyspace home">
          <img className="brand-mark" src={studySpaceIcon} alt="" /><span>studyspace</span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => <button className={`nav-item${activePage === item.page ? " is-active" : ""}`} key={item.page} onClick={() => setActivePage(item.page)} type="button" aria-current={activePage === item.page ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><div className="streak-mark">S</div><div><strong>{data.tasks.length} tasks</strong><span>{markdownNotes.notes.length} notes saved locally</span><small className="app-build-info">v{__STUDYSPACE_VERSION__} · {__STUDYSPACE_REVISION__}</small>{updateMessage && <small className="app-build-info">{updateMessage}</small>}</div></div>
      </aside>

      <main className="main-content" id="overview">
        {storageError && <div className="storage-warning" role="alert">Browser storage is unavailable. This device cannot keep an offline copy of your data.</div>}
        {activePage === "overview" && <Overview data={data} notes={markdownNotes.notes} actions={actions} onNavigate={setActivePage} />}
        {activePage === "tasks" && <TasksPage tasks={data.tasks} onAdd={actions.addTask} onToggle={actions.toggleTask} onDelete={actions.deleteTask} />}
        {activePage === "timer" && <TimerPage timer={data.timer} logs={data.logs} onConfigure={actions.configureTimer} onStart={actions.startTimer} onPause={actions.pauseTimer} onReset={actions.resetTimer} onDeleteLog={actions.deleteLog} />}
        {activePage === "notes" && <NotesPage notes={markdownNotes.notes} isLoading={markdownNotes.isLoading} error={markdownNotes.error} onSave={markdownNotes.save} onDelete={markdownNotes.remove} />}
        {activePage === "flashcards" && <FlashcardsPage decks={data.flashcardDecks} onAddDeck={actions.addDeck} onDeleteDeck={actions.deleteDeck} onRenameDeck={actions.renameDeck} onAddCard={actions.addCardToDeck} onEditCard={actions.editCardInDeck} onDeleteCard={actions.deleteCardFromDeck} />}
        {activePage === "plan" && <StudyPlanPage plan={data.plan} onAdd={actions.addPlanItem} onDelete={actions.deletePlanItem} onStart={startPlannedSession} />}
      </main>
    </div>
  )
}

export default App

