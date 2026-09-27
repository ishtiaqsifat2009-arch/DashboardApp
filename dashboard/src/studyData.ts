import { useEffect, useReducer } from "react"

export type StudyTask = {
  id: string
  title: string
  subject: string
  dueDate: string
  completed: boolean
  createdAt: number
}

export type StudyNote = {
  id: string
  title: string
  subject: string
  content: string
  updatedAt: number
}

export type PlannedSession = {
  id: string
  title: string
  subject: string
  startsAt: string
  durationMinutes: number
}

export type FocusTimer = {
  subject: string
  topic: string
  durationMinutes: number
  remainingSeconds: number
  isRunning: boolean
  endsAt: number | null
  segmentStartedAt: number | null
}

export type StudyLog = {
  id: string
  subject: string
  topic: string
  startedAt: number
  durationSeconds: number
}

export type StudyData = {
  tasks: StudyTask[]
  notes: StudyNote[]
  plan: PlannedSession[]
  logs: StudyLog[]
  timer: FocusTimer
}

const STORAGE_KEY = "studyspace:data:v1"

export function getLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createInitialData(): StudyData {
  const today = getLocalDate()
  return {
    tasks: [
      { id: createId(), title: "Review cell structure notes", subject: "Biology", dueDate: today, completed: true, createdAt: Date.now() },
      { id: createId(), title: "Finish practice problems", subject: "Calculus", dueDate: today, completed: false, createdAt: Date.now() },
      { id: createId(), title: "Read chapter 8", subject: "Modern history", dueDate: today, completed: false, createdAt: Date.now() },
    ],
    notes: [],
    plan: [],
    logs: [],
    timer: {
      subject: "Biology",
      topic: "Cell structure & function",
      durationMinutes: 25,
      remainingSeconds: 25 * 60,
      isRunning: false,
      endsAt: null,
      segmentStartedAt: null,
    },
  }
}

function loadStudyData(): StudyData {
  const initial = createInitialData()
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return initial
    const parsed: Partial<StudyData> = JSON.parse(saved)
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : initial.tasks,
      notes: Array.isArray(parsed.notes) ? parsed.notes : initial.notes,
      plan: Array.isArray(parsed.plan) ? parsed.plan : initial.plan,
      logs: Array.isArray(parsed.logs) ? parsed.logs : initial.logs,
      timer: parsed.timer ? { ...initial.timer, ...parsed.timer } : initial.timer,
    }
  } catch {
    return initial
  }
}

type Action =
  | { type: "task/add"; task: StudyTask }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "note/save"; note: StudyNote }
  | { type: "note/delete"; id: string }
  | { type: "plan/add"; item: PlannedSession }
  | { type: "plan/delete"; id: string }
  | { type: "timer/configure"; subject: string; topic: string; durationMinutes: number }
  | { type: "timer/start"; now: number }
  | { type: "timer/pause"; now: number }
  | { type: "timer/tick"; now: number }
  | { type: "timer/reset" }

function addLog(data: StudyData, now: number, endAt: number) {
  const timer = data.timer
  if (timer.segmentStartedAt === null) return data.logs
  const durationSeconds = Math.max(0, Math.floor((endAt - timer.segmentStartedAt) / 1000))
  if (durationSeconds === 0) return data.logs
  return [...data.logs, {
    id: createId(),
    subject: timer.subject,
    topic: timer.topic,
    startedAt: timer.segmentStartedAt,
    durationSeconds: Math.min(durationSeconds, Math.ceil((now - timer.segmentStartedAt) / 1000)),
  }]
}

function reducer(data: StudyData, action: Action): StudyData {
  switch (action.type) {
    case "task/add":
      return { ...data, tasks: [action.task, ...data.tasks] }
    case "task/toggle":
      return { ...data, tasks: data.tasks.map((task) => task.id === action.id ? { ...task, completed: !task.completed } : task) }
    case "task/delete":
      return { ...data, tasks: data.tasks.filter((task) => task.id !== action.id) }
    case "note/save": {
      const exists = data.notes.some((note) => note.id === action.note.id)
      return { ...data, notes: exists ? data.notes.map((note) => note.id === action.note.id ? action.note : note) : [action.note, ...data.notes] }
    }
    case "note/delete":
      return { ...data, notes: data.notes.filter((note) => note.id !== action.id) }
    case "plan/add":
      return { ...data, plan: [...data.plan, action.item].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }
    case "plan/delete":
      return { ...data, plan: data.plan.filter((item) => item.id !== action.id) }
    case "timer/configure": {
      const durationMinutes = Math.min(120, Math.max(1, action.durationMinutes))
      return {
        ...data,
        timer: {
          subject: action.subject,
          topic: action.topic,
          durationMinutes,
          remainingSeconds: durationMinutes * 60,
          isRunning: false,
          endsAt: null,
          segmentStartedAt: null,
        },
      }
    }
    case "timer/start":
      if (data.timer.remainingSeconds <= 0 || data.timer.isRunning) return data
      return {
        ...data,
        timer: {
          ...data.timer,
          isRunning: true,
          endsAt: action.now + data.timer.remainingSeconds * 1000,
          segmentStartedAt: action.now,
        },
      }
    case "timer/pause": {
      if (!data.timer.isRunning || data.timer.endsAt === null) return data
      const remainingSeconds = Math.max(0, Math.ceil((data.timer.endsAt - action.now) / 1000))
      const endAt = Math.min(action.now, data.timer.endsAt)
      const nextTimer = {
        ...data.timer,
        remainingSeconds,
        isRunning: false,
        endsAt: null,
        segmentStartedAt: null,
      }
      const nextData = { ...data, timer: nextTimer }
      return { ...nextData, logs: addLog(data, action.now, endAt) }
    }
    case "timer/tick": {
      if (!data.timer.isRunning || data.timer.endsAt === null) return data
      if (action.now < data.timer.endsAt) {
        const remainingSeconds = Math.ceil((data.timer.endsAt - action.now) / 1000)
        return remainingSeconds === data.timer.remainingSeconds ? data : { ...data, timer: { ...data.timer, remainingSeconds } }
      }
      const logs = addLog(data, action.now, data.timer.endsAt)
      return {
        ...data,
        logs,
        timer: { ...data.timer, remainingSeconds: 0, isRunning: false, endsAt: null, segmentStartedAt: null },
      }
    }
    case "timer/reset":
      return {
        ...data,
        timer: {
          ...data.timer,
          remainingSeconds: data.timer.durationMinutes * 60,
          isRunning: false,
          endsAt: null,
          segmentStartedAt: null,
        },
      }
    default:
      return data
  }
}

export function useStudyData() {
  const [data, dispatch] = useReducer(reducer, undefined, loadStudyData)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!data.timer.isRunning) return
    const tick = () => dispatch({ type: "timer/tick", now: Date.now() })
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [data.timer.isRunning, data.timer.endsAt])

  const actions = {
    addTask: (task: Omit<StudyTask, "id" | "createdAt" | "completed">) => dispatch({ type: "task/add", task: { ...task, id: createId(), createdAt: Date.now(), completed: false } }),
    toggleTask: (id: string) => dispatch({ type: "task/toggle", id }),
    deleteTask: (id: string) => dispatch({ type: "task/delete", id }),
    saveNote: (note: StudyNote) => dispatch({ type: "note/save", note }),
    deleteNote: (id: string) => dispatch({ type: "note/delete", id }),
    addPlanItem: (item: Omit<PlannedSession, "id">) => dispatch({ type: "plan/add", item: { ...item, id: createId() } }),
    deletePlanItem: (id: string) => dispatch({ type: "plan/delete", id }),
    configureTimer: (subject: string, topic: string, durationMinutes: number) => dispatch({ type: "timer/configure", subject, topic, durationMinutes }),
    startTimer: () => dispatch({ type: "timer/start", now: Date.now() }),
    pauseTimer: () => dispatch({ type: "timer/pause", now: Date.now() }),
    resetTimer: () => dispatch({ type: "timer/reset" }),
  }

  return { data, actions }
}