import { useState, type ReactNode } from "react"
import "./App.css"

type IconName = "overview" | "tasks" | "plan" | "notes" | "clock" | "arrow"

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    tasks: <><path d="m5 12 4 4L19 6" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
    plan: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    notes: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const navigation = [
  { label: "Overview", icon: "overview" as const },
  { label: "My tasks", icon: "tasks" as const },
  { label: "Study plan", icon: "plan" as const },
  { label: "Notes", icon: "notes" as const },
]

const initialTasks = [
  { id: 1, title: "Review cell structure notes", detail: "Biology · 25 min", done: true },
  { id: 2, title: "Finish practice problems", detail: "Calculus · 40 min", done: false },
  { id: 3, title: "Read chapter 8", detail: "Modern history · 30 min", done: false },
]

const week = [
  { day: "M", amount: 42 },
  { day: "T", amount: 68 },
  { day: "W", amount: 53 },
  { day: "T", amount: 86 },
  { day: "F", amount: 61 },
  { day: "S", amount: 34 },
  { day: "S", amount: 18 },
]

function App() {
  const [activePage, setActivePage] = useState("Overview")
  const [tasks, setTasks] = useState(initialTasks)
  const [sessionRunning, setSessionRunning] = useState(false)
  const completedTasks = tasks.filter((task) => task.done).length

  function toggleTask(id: number) {
    setTasks((currentTasks) => currentTasks.map((task) => task.id === id ? { ...task, done: !task.done } : task))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Studyspace home">
          <span className="brand-mark">S</span>
          <span>studyspace</span>
        </a>

        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item${activePage === item.label ? " is-active" : ""}`}
              key={item.label}
              onClick={() => setActivePage(item.label)}
              type="button"
              aria-current={activePage === item.label ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-mark">✳</div>
          <div>
            <strong>6 day streak</strong>
            <span>You're building a rhythm</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="page-header">
          <div>
            <div className="eyebrow"><span className="status-dot" /> YOUR STUDY SPACE</div>
            <h1>Good evening</h1>
            <p className="page-subtitle">A little progress today goes a long way.</p>
          </div>
          <div className="date-chip"><Icon name="plan" /><span>Saturday, September 26</span></div>
        </header>

        <section className="stats-grid" aria-label="Study summary">
          <article className="stat-card">
            <span className="stat-label">STUDY TIME</span>
            <div className="stat-value">2<span>h</span> 40<span>m</span></div>
            <span className="stat-note">+ 35 min from yesterday</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">TASKS COMPLETED</span>
            <div className="stat-value">{completedTasks}<span> / {tasks.length}</span></div>
            <span className="stat-note">Keep your momentum going</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">CURRENT STREAK</span>
            <div className="stat-value">06<span> days</span></div>
            <span className="stat-note">Your best is 12 days</span>
          </article>
        </section>

        <section className="dashboard-grid" aria-label="Study dashboard">
          <article className="panel focus-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">YOUR NEXT SESSION</span>
                <h2>Pick up where you left off</h2>
              </div>
              <span className="panel-icon"><Icon name="clock" /></span>
            </div>
            <div className="course-row">
              <div className="course-symbol">B</div>
              <div className="course-details">
                <strong>Cell structure &amp; function</strong>
                <span>Biology <i /> Chapter 04</span>
              </div>
              <span className="course-percent">68%</span>
            </div>
            <div className="progress-track" role="progressbar" aria-label="Biology chapter progress" aria-valuenow={68} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: "68%" }} />
            </div>
            <div className="focus-footer">
              <span><Icon name="clock" /> 24 min left</span>
              <button className="primary-button" type="button" onClick={() => setSessionRunning(!sessionRunning)}>
                {sessionRunning ? "Pause session" : "Start focus session"}
                <Icon name="arrow" />
              </button>
            </div>
            {sessionRunning && <p className="session-status" role="status"><span className="status-dot" /> Focus session in progress</p>}
          </article>

          <article className="panel tasks-panel" id="tasks">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">STAY ON TRACK</span>
                <h2>Today's tasks</h2>
              </div>
              <span className="task-count">{completedTasks}/{tasks.length}</span>
            </div>
            <ul className="task-list">
              {tasks.map((task) => (
                <li className={`task-item${task.done ? " is-done" : ""}`} key={task.id}>
                  <button
                    className="task-check"
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    aria-label={`${task.done ? "Mark incomplete" : "Complete"}: ${task.title}`}
                    aria-pressed={task.done}
                  >
                    {task.done && <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-6" /></svg>}
                  </button>
                  <span className="task-copy"><strong>{task.title}</strong><span>{task.detail}</span></span>
                </li>
              ))}
            </ul>
            <button className="text-button" type="button" onClick={() => setActivePage("My tasks")}>View all tasks <Icon name="arrow" /></button>
          </article>

          <article className="panel activity-panel" id="activity">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">NICE AND STEADY</span>
                <h2>This week's focus</h2>
              </div>
              <span className="activity-total">12.4 <span>hrs</span></span>
            </div>
            <div className="chart" role="img" aria-label="Study activity by day this week">
              {week.map((item, index) => (
                <div className={`chart-column${index === 5 ? " is-today" : ""}`} key={`${item.day}-${index}`}>
                  <div className="chart-bar-wrap"><span className="chart-bar" style={{ height: `${item.amount}%` }} /></div>
                  <span className="chart-day">{item.day}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel reminder-panel">
            <div className="reminder-topline"><span className="section-kicker">UP NEXT</span><span className="reminder-tag">IN 40 MIN</span></div>
            <h2>Calculus review</h2>
            <p>Practice integration techniques</p>
            <div className="reminder-bottom"><span className="reminder-subject">MATH <i /> STUDY PLAN</span><Icon name="arrow" /></div>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App

