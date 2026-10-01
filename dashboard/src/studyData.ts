import { useEffect, useReducer, useRef, useState } from "react"
import { localStudyStorage } from "./storage.ts"

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

export type Flashcard = {
  id: string
  question: string
  answer: string
}

export type FlashcardDeck = {
  id: string
  name: string
  cards: Flashcard[]
  createdAt: number
}

export type StudyData = {
  tasks: StudyTask[]
  notes: StudyNote[]
  plan: PlannedSession[]
  logs: StudyLog[]
  timer: FocusTimer
  flashcardDecks: FlashcardDeck[]
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
    flashcardDecks: [],
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

export type StudyDataAction =
  | { type: "task/add"; task: StudyTask }
  | { type: "task/toggle"; id: string }
  | { type: "task/delete"; id: string }
  | { type: "note/legacyClear" }
  | { type: "plan/add"; item: PlannedSession }
  | { type: "plan/delete"; id: string }
  | { type: "log/delete"; id: string }
  | { type: "deck/add"; deck: FlashcardDeck }
  | { type: "deck/delete"; id: string }
  | { type: "deck/rename"; id: string; name: string }
  | { type: "deck/addCard"; deckId: string; card: Flashcard }
  | { type: "deck/deleteCard"; deckId: string; cardId: string }
  | { type: "deck/editCard"; deckId: string; card: Flashcard }
  | { type: "timer/configure"; subject: string; topic: string; durationMinutes: number; now: number }
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

export function reducer(data: StudyData, action: StudyDataAction): StudyData {
  switch (action.type) {
    case "task/add":
      return { ...data, tasks: [action.task, ...data.tasks] }
    case "task/toggle":
      return { ...data, tasks: data.tasks.map((task) => task.id === action.id ? { ...task, completed: !task.completed } : task) }
    case "task/delete":
      return { ...data, tasks: data.tasks.filter((task) => task.id !== action.id) }
    case "note/legacyClear":
      return data.notes.length === 0 ? data : { ...data, notes: [] }
    case "plan/add":
      return { ...data, plan: [...data.plan, action.item].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }
    case "plan/delete":
      return { ...data, plan: data.plan.filter((item) => item.id !== action.id) }
    case "log/delete":
      return { ...data, logs: data.logs.filter((log) => log.id !== action.id) }
    case "deck/add":
      return { ...data, flashcardDecks: [...data.flashcardDecks, action.deck] }
    case "deck/delete":
      return { ...data, flashcardDecks: data.flashcardDecks.filter((deck) => deck.id !== action.id) }
    case "deck/rename":
      return { ...data, flashcardDecks: data.flashcardDecks.map((deck) => deck.id === action.id ? { ...deck, name: action.name } : deck) }
    case "deck/addCard":
      return { ...data, flashcardDecks: data.flashcardDecks.map((deck) => deck.id === action.deckId ? { ...deck, cards: [...deck.cards, action.card] } : deck) }
    case "deck/deleteCard":
      return { ...data, flashcardDecks: data.flashcardDecks.map((deck) => deck.id === action.deckId ? { ...deck, cards: deck.cards.filter((card) => card.id !== action.cardId) } : deck) }
    case "deck/editCard":
      return { ...data, flashcardDecks: data.flashcardDecks.map((deck) => deck.id === action.deckId ? { ...deck, cards: deck.cards.map((card) => card.id === action.card.id ? action.card : card) } : deck) }
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
    }
    default:
      return data
  }
}

export function useStudyData() {
  const [initialLoad] = useState(() => localStudyStorage.load(createInitialData()))
  const [data, dispatch] = useReducer(reducer, initialLoad.data)
  const [storageError, setStorageError] = useState(initialLoad.storageError)
  const lastSavedData = useRef(initialLoad.data)

  useEffect(() => {
    if (data === lastSavedData.current) return

    let failedToSave = false
    try {
      localStudyStorage.save(data)
      lastSavedData.current = data
    } catch {
      failedToSave = true
    }
    const timeout = window.setTimeout(() => setStorageError(failedToSave), 0)
    return () => window.clearTimeout(timeout)
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
    clearLegacyNotes: () => dispatch({ type: "note/legacyClear" }),
    addPlanItem: (item: Omit<PlannedSession, "id">) => dispatch({ type: "plan/add", item: { ...item, id: createId() } }),
    deletePlanItem: (id: string) => dispatch({ type: "plan/delete", id }),
    deleteLog: (id: string) => dispatch({ type: "log/delete", id }),
    addDeck: (name: string) => {
      const id = createId()
      dispatch({ type: "deck/add", deck: { id, name, cards: [], createdAt: Date.now() } })
      return id
    },
    deleteDeck: (id: string) => dispatch({ type: "deck/delete", id }),
    renameDeck: (id: string, name: string) => dispatch({ type: "deck/rename", id, name }),
    addCardToDeck: (deckId: string, question: string, answer: string) => dispatch({ type: "deck/addCard", deckId, card: { id: createId(), question, answer } }),
    deleteCardFromDeck: (deckId: string, cardId: string) => dispatch({ type: "deck/deleteCard", deckId, cardId }),
    editCardInDeck: (deckId: string, card: Flashcard) => dispatch({ type: "deck/editCard", deckId, card }),
    configureTimer: (subject: string, topic: string, durationMinutes: number) => dispatch({ type: "timer/configure", subject, topic, durationMinutes, now: Date.now() }),
    startTimer: () => dispatch({ type: "timer/start", now: Date.now() }),
    pauseTimer: () => dispatch({ type: "timer/pause", now: Date.now() }),
    resetTimer: () => dispatch({ type: "timer/reset" }),
  }

  return { data, actions, storageError }
}