import { useEffect, useReducer, useRef, useState } from "react"
import { supabase } from "./supabaseClient"

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

function getStorageKey(userId?: string) {
  return `${STORAGE_KEY}:${userId ?? "local"}`
}

function hasStoredData(userId?: string) {
  try {
    return window.localStorage.getItem(getStorageKey(userId)) !== null
  } catch {
    return false
  }
}

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

function normalizeStudyData(value: unknown, fallback: StudyData): StudyData {
  if (value === null || typeof value !== "object") return fallback
  const parsed = value as Partial<StudyData>
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
    notes: Array.isArray(parsed.notes) ? parsed.notes : fallback.notes,
    plan: Array.isArray(parsed.plan) ? parsed.plan : fallback.plan,
    logs: Array.isArray(parsed.logs) ? parsed.logs : fallback.logs,
    timer: parsed.timer ? { ...fallback.timer, ...parsed.timer } : fallback.timer,
  }
}

function getCloudSignature(data: StudyData) {
  const timer = data.timer.isRunning
    ? { ...data.timer, remainingSeconds: 0 }
    : data.timer
  return JSON.stringify({ ...data, timer })
}

function loadStudyData(userId?: string): StudyData {
  const initial = createInitialData()
  try {
    const key = getStorageKey(userId)
    let saved = window.localStorage.getItem(key)
    if (!saved && !userId) {
      saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) window.localStorage.setItem(key, saved)
    }
    if (!saved) return initial
    return normalizeStudyData(JSON.parse(saved), initial)
  } catch {
    return initial
  }
}

type Action =
  | { type: "hydrate"; data: StudyData }
  | { type: "task/add"; task: StudyTask }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "note/save"; note: StudyNote }
  | { type: "note/delete"; id: string }
  | { type: "plan/add"; item: PlannedSession }
  | { type: "plan/delete"; id: string }
  | { type: "timer/configure"; subject: string; topic: string; durationMinutes: number; now: number }
  | { type: "timer/start"; now: number }
  | { type: "timer/pause"; now: number }
  | { type: "timer/tick"; now: number }
  | { type: "timer/reset"; now: number }

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
    case "hydrate":
      return action.data
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
      const logs = data.timer.isRunning
        ? addLog(data, action.now, Math.min(action.now, data.timer.endsAt ?? action.now))
        : data.logs
      return {
        ...data,
        logs,
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
    case "timer/reset": {
      const logs = data.timer.isRunning
        ? addLog(data, action.now, Math.min(action.now, data.timer.endsAt ?? action.now))
        : data.logs
      return {
        ...data,
        logs,
        timer: {
          ...data.timer,
          remainingSeconds: data.timer.durationMinutes * 60,
          isRunning: false,
          endsAt: null,
          segmentStartedAt: null,
        },
      }
    }
    default:
      return data
  }
}

export function useStudyData(userId?: string) {
  const [data, dispatch] = useReducer(reducer, userId, loadStudyData)
  const [storageError, setStorageError] = useState(false)
  const [syncReadyUserId, setSyncReadyUserId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncRevision, setSyncRevision] = useState(0)
  const [cloudRetry, setCloudRetry] = useState(0)
  const [hadUserCache] = useState(() => userId ? hasStoredData(userId) : false)
  const dataRef = useRef(data)
  const lastCloudSignature = useRef("")

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let failedToSave = false
    try {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(data))
    } catch {
      failedToSave = true
    }
    const timeout = window.setTimeout(() => setStorageError(failedToSave), 0)
    return () => window.clearTimeout(timeout)
  }, [data, userId])

  useEffect(() => {
    if (!supabase || !userId) return

    let active = true
    void (async () => {
      const { data: row, error } = await supabase
        .from("study_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle()

      if (!active) return
      if (error) {
        setSyncError(error.message)
        return
      }

      const nextData = row?.data
        ? normalizeStudyData(row.data, dataRef.current)
        : hadUserCache
          ? dataRef.current
          : loadStudyData()
      if (row?.data || !hadUserCache) {
        dataRef.current = nextData
        dispatch({ type: "hydrate", data: nextData })
      }

      const { error: saveError } = await supabase
        .from("study_data")
        .upsert({ user_id: userId, data: nextData }, { onConflict: "user_id" })

      if (!active) return
      if (saveError) {
        setSyncError(saveError.message)
        return
      }

      lastCloudSignature.current = getCloudSignature(nextData)
      setSyncReadyUserId(userId)
      setSyncError(null)
    })().catch((error: unknown) => {
      if (active) setSyncError(error instanceof Error ? error.message : "Cloud sync failed.")
    })

    return () => {
      active = false
    }
  }, [hadUserCache, userId, syncRevision])

  useEffect(() => {
    const client = supabase
    if (!client || !userId || syncReadyUserId !== userId) return
    const signature = getCloudSignature(data)
    if (signature === lastCloudSignature.current) return

    let active = true
    const timeout = window.setTimeout(() => {
      void (async () => {
        const { error } = await client
          .from("study_data")
          .upsert({ user_id: userId, data }, { onConflict: "user_id" })

        if (!active) return
        if (error) setSyncError(error.message)
        else {
          lastCloudSignature.current = signature
          setSyncError(null)
        }
      })()
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [data, userId, syncReadyUserId, cloudRetry])

  useEffect(() => {
    const client = supabase
    if (!client || !userId || syncReadyUserId !== userId) return

    const channel = client
      .channel(`study-data-${userId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "study_data",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const incoming = normalizeStudyData(
          (payload.new as { data?: unknown }).data,
          dataRef.current,
        )
        lastCloudSignature.current = getCloudSignature(incoming)
        if (JSON.stringify(incoming) !== JSON.stringify(dataRef.current)) {
          dataRef.current = incoming
          dispatch({ type: "hydrate", data: incoming })
        }
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncError(error?.message ?? "Realtime sync is unavailable.")
        }
      })

    return () => {
      void client.removeChannel(channel)
    }
  }, [userId, syncReadyUserId])

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
    configureTimer: (subject: string, topic: string, durationMinutes: number) => dispatch({ type: "timer/configure", subject, topic, durationMinutes, now: Date.now() }),
    startTimer: () => dispatch({ type: "timer/start", now: Date.now() }),
    pauseTimer: () => dispatch({ type: "timer/pause", now: Date.now() }),
    resetTimer: () => dispatch({ type: "timer/reset", now: Date.now() }),
  }

  const syncStatus = !supabase || !userId
    ? "local"
    : syncError
      ? "error"
      : syncReadyUserId === userId
        ? "synced"
        : "loading"

  return {
    data,
    actions,
    storageError,
    syncError,
    syncStatus,
    retrySync: () => {
      if (userId && syncReadyUserId === userId) setCloudRetry((retry) => retry + 1)
      else setSyncRevision((revision) => revision + 1)
    },
  }
}