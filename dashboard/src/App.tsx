import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  createId,
  getLocalDate,
  useStudyData,
  type PlannedSession,
  type StudyNote,
  type StudyTask,
} from "./studyData"
import studySpaceIcon from "./assets/StudySpaceIcon.jpg"
import "./App.css"

type Page = "overview" | "tasks" | "timer" | "plan" | "notes"
type IconName = Page | "arrow" | "clock"

const navigation: { page: Page; label: string; icon: IconName }[] = [
  { page: "overview", label: "Overview", icon: "overview" },
  { page: "tasks", label: "My Tasks", icon: "tasks" },
  { page: "timer", label: "Focus Timer", icon: "clock" },
  { page: "plan", label: "Study Plan", icon: "plan" },
  { page: "notes", label: "Notes", icon: "notes" },
]

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    tasks: <><path d="m5 12 4 4L19 6" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>,
    plan: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    notes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
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

function confirmDelete(label: string) {
  return window.confirm(`Delete "${label}"? This cannot be undone.`)
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
          {onDelete && <button className="quiet-button danger-button" type="button" onClick={() => { if (confirmDelete(task.title)) onDelete(task.id) }} aria-label={`Delete ${task.title}`}>Delete</button>}
        </li>
      ))}
    </ul>
  )
}

function Overview({ data, actions, onNavigate }: {
  data: ReturnType<typeof useStudyData>["data"]
  actions: ReturnType<typeof useStudyData>["actions"]
  onNavigate: (page: Page) => void
}) {
  const currentTime = useCurrentTime()
  const today = getLocalDate()
  const todayTasks = data.tasks.filter((task) => task.dueDate === today)
  const completedCount = data.tasks.filter((task) => task.completed).length
  const nextPlanItem = data.plan.find((item) => new Date(item.startsAt).getTime() >= currentTime)
  const latestNote = [...data.notes].sort((left, right) => right.updatedAt - left.updatedAt)[0]
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
            <div className="course-details"><strong>{timer.subject || "Choose a subject"}</strong><span>{timer.isRunning ? "Session in progress" : `${timer.durationMinutes} minute session`}</span></div>
            <span className="course-percent">{formatTimer(timer.remainingSeconds)}</span>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Focus session progress" aria-valuenow={Math.round(timerProgress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${timerProgress}%` }} /></div>
          <div className="focus-footer">
            <button className="text-button" type="button" onClick={() => onNavigate("timer")}>Timer settings <Icon name="arrow" /></button>
            <button className="primary-button" type="button" disabled={timer.remainingSeconds === 0 && !timer.isRunning} onClick={() => timer.isRunning ? actions.pauseTimer() : actions.startTimer()}>
              {timer.isRunning ? "Pause session" : timer.remainingSeconds < timer.durationMinutes * 60 ? "Resume session" : "Start session"}
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
          <div className="panel-heading"><div><span className="section-kicker">YOUR NOTES</span><h2>{data.notes.length} saved {data.notes.length === 1 ? "note" : "notes"}</h2></div><span className="panel-icon"><Icon name="notes" /></span></div>
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

function TimerPage({ timer, onConfigure, onStart, onPause, onReset }: {
  timer: ReturnType<typeof useStudyData>["data"]["timer"]
  onConfigure: (subject: string, topic: string, durationMinutes: number) => void
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  const progress = Math.min(100, Math.max(0, ((timer.durationMinutes * 60 - timer.remainingSeconds) / (timer.durationMinutes * 60)) * 100))

  return (
    <>
      <PageHeading kicker="ONE THING AT A TIME" title="Focus timer" subtitle="Set a subject and give it your full attention." />
      <div className="timer-layout">
        <section className="panel timer-panel">
          <span className="section-kicker">{timer.isRunning ? "SESSION IN PROGRESS" : timer.remainingSeconds === 0 ? "SESSION COMPLETE" : "CURRENT SESSION"}</span>
          <div className="timer-display" role="timer" aria-label={`${Math.floor(timer.remainingSeconds / 60)} minutes and ${timer.remainingSeconds % 60} seconds remaining`}>{formatTimer(timer.remainingSeconds)}</div>
          <div className="timer-session-title">{timer.topic || "Focused study"}</div>
          <div className="timer-session-subject">{timer.subject || "Choose a subject"} <i /> {timer.durationMinutes} minute session</div>
          <div className="progress-track timer-progress" role="progressbar" aria-label="Focus timer progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <div className="timer-controls">
            <button className="primary-button timer-main-button" disabled={timer.remainingSeconds === 0 && !timer.isRunning} onClick={timer.isRunning ? onPause : onStart} type="button">{timer.isRunning ? "Pause" : timer.remainingSeconds < timer.durationMinutes * 60 ? "Resume" : "Start focus session"}</button>
            <button className="quiet-button" onClick={() => { if (!timer.isRunning || window.confirm("Reset this session? Elapsed study time will be kept.")) onReset() }} type="button">Reset</button>
          </div>
          <p className="timer-persistence"><span className="status-dot" /> Your timer is saved on this device and continues if you change sections.</p>
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
    </>
  )
}

function NotesPage({ notes, onSave, onDelete }: {
  notes: StudyNote[]
  onSave: (note: StudyNote) => void
  onDelete: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("General")
  const [content, setContent] = useState("")

  function resetForm() {
    setEditingId(null)
    setTitle("")
    setSubject("General")
    setContent("")
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanSubject = subject.trim()
    const cleanContent = content.trim()
    if (!cleanTitle || !cleanSubject || !cleanContent) return
    onSave({ id: editingId ?? createId(), title: cleanTitle, subject: cleanSubject, content: cleanContent, updatedAt: Date.now() })
    resetForm()
  }

  function editNote(note: StudyNote) {
    setEditingId(note.id)
    setTitle(note.title)
    setSubject(note.subject)
    setContent(note.content)
  }

  return (
    <>
      <PageHeading kicker="IDEAS WORTH KEEPING" title="Notes" subtitle="Capture the useful things you learn along the way." />
      <div className="management-layout notes-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><span className="section-kicker">{editingId ? "MAKE A CHANGE" : "SAVE AN IDEA"}</span><h2>{editingId ? "Edit note" : "New note"}</h2></div></div>
          <form className="data-form" onSubmit={submitNote}>
            <label className="field"><span>Title</span><input maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="A clear, memorable title" required value={title} /></label>
            <label className="field"><span>Subject</span><input maxLength={40} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Biology" required value={subject} /></label>
            <label className="field"><span>Your note</span><textarea maxLength={4000} onChange={(event) => setContent(event.target.value)} placeholder="Write down the key ideas..." required rows={7} value={content} /></label>
            <div className="form-actions"><button className="primary-button form-submit" type="submit">{editingId ? "Save changes" : "Save note"}</button>{editingId && <button className="quiet-button" onClick={resetForm} type="button">Cancel</button>}</div>
          </form>
        </section>
        <section className="panel list-panel">
          <div className="panel-heading"><div><span className="section-kicker">YOUR COLLECTION</span><h2>Saved notes <span className="inline-count">{notes.length}</span></h2></div></div>
          {notes.length === 0 ? <p className="empty-state">Your notes will live here. Start with something you want to remember.</p> : <div className="record-list">{[...notes].sort((left, right) => right.updatedAt - left.updatedAt).map((note) => <article className="record-card note-card" key={note.id}><div className="record-topline"><span className="record-subject">{note.subject}</span><time>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div><h3>{note.title}</h3><p>{note.content}</p><div className="record-actions"><button className="quiet-button" onClick={() => editNote(note)} type="button">Edit</button><button className="quiet-button danger-button" onClick={() => { if (confirmDelete(note.title)) onDelete(note.id) }} type="button">Delete</button></div></article>)}</div>}
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
          {sortedPlan.length === 0 ? <p className="empty-state">Your schedule is clear. Add a session to plan your next study block.</p> : <div className="record-list">{sortedPlan.map((item) => <article className="record-card plan-card" key={item.id}><div className="record-topline"><span className="record-subject">{item.subject}</span><time>{new Date(item.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</time></div><h3>{item.title}</h3><p>{new Date(item.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} <i /> {item.durationMinutes} min</p><div className="record-actions"><button className="quiet-button accent-button" onClick={() => onStart(item)} type="button">Start session</button><button className="quiet-button danger-button" onClick={() => { if (confirmDelete(item.title)) onDelete(item.id) }} type="button">Remove</button></div></article>)}</div>}
        </section>
      </div>
    </>
  )
}

function App() {
  const { data, actions, storageError } = useStudyData()
  const [activePage, setActivePage] = useState<Page>("overview")

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
        <div className="sidebar-bottom"><div className="streak-mark">S</div><div><strong>{data.tasks.length} tasks</strong><span>{data.notes.length} notes saved locally</span></div></div>
      </aside>

      <main className="main-content" id="overview">
        {storageError && <div className="storage-warning" role="alert">Browser storage is unavailable. This device cannot keep an offline copy of your data.</div>}
        {activePage === "overview" && <Overview data={data} actions={actions} onNavigate={setActivePage} />}
        {activePage === "tasks" && <TasksPage tasks={data.tasks} onAdd={actions.addTask} onToggle={actions.toggleTask} onDelete={actions.deleteTask} />}
        {activePage === "timer" && <TimerPage timer={data.timer} onConfigure={actions.configureTimer} onStart={actions.startTimer} onPause={actions.pauseTimer} onReset={actions.resetTimer} />}
        {activePage === "notes" && <NotesPage notes={data.notes} onSave={actions.saveNote} onDelete={actions.deleteNote} />}
        {activePage === "plan" && <StudyPlanPage plan={data.plan} onAdd={actions.addPlanItem} onDelete={actions.deletePlanItem} onStart={startPlannedSession} />}
      </main>
    </div>
  )
}

export default App

