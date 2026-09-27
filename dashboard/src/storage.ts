import type { StudyData } from "./studyData"

const DATA_KEY = "studyspace:data:v1:local"
const LEGACY_DATA_KEY = "studyspace:data:v1"
const LEGACY_ACCOUNT_KEY_PREFIX = `${LEGACY_DATA_KEY}:`

export type StudyDataLoadResult = {
  data: StudyData
  storageError: boolean
}

export interface StudyDataStorage {
  load(fallback: StudyData): StudyDataLoadResult
  save(data: StudyData): void
  clear(): void
}

function readSingleLegacyAccountCache() {
  const accountCacheKeys = Object.keys(window.localStorage)
    .filter((key) => key.startsWith(LEGACY_ACCOUNT_KEY_PREFIX) && key !== DATA_KEY)

  return accountCacheKeys.length === 1
    ? window.localStorage.getItem(accountCacheKeys[0])
    : null
}

function normalizeStudyData(value: unknown, fallback: StudyData): StudyData | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null

  const parsed = value as Partial<StudyData>
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
    notes: Array.isArray(parsed.notes) ? parsed.notes : fallback.notes,
    plan: Array.isArray(parsed.plan) ? parsed.plan : fallback.plan,
    logs: Array.isArray(parsed.logs) ? parsed.logs : fallback.logs,
    timer: parsed.timer ? { ...fallback.timer, ...parsed.timer } : fallback.timer,
  }
}

function load(fallback: StudyData): StudyDataLoadResult {
  try {
    const saved = window.localStorage.getItem(DATA_KEY)
    if (saved) {
      const data = normalizeStudyData(JSON.parse(saved), fallback)
      return data ? { data, storageError: false } : { data: fallback, storageError: true }
    }

    const legacyData = readSingleLegacyAccountCache() ?? window.localStorage.getItem(LEGACY_DATA_KEY)
    if (!legacyData) return { data: fallback, storageError: false }

    const data = normalizeStudyData(JSON.parse(legacyData), fallback)
    if (!data) return { data: fallback, storageError: true }

    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify(data))
      return { data, storageError: false }
    } catch {
      return { data, storageError: true }
    }
  } catch {
    return { data: fallback, storageError: true }
  }
}

function save(data: StudyData) {
  window.localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

function clear() {
  window.localStorage.removeItem(DATA_KEY)
}

export const localStudyStorage: StudyDataStorage = { load, save, clear }
