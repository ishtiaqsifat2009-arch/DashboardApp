import { invoke, isTauri } from "@tauri-apps/api/core"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import type { StudyNote } from "./studyData"

export type MarkdownNote = {
  id: string
  title: string
  subject: string
  content: string
  createdAt: number
  updatedAt: number
  fileName: string
}

type MarkdownFile = {
  fileName: string
  contents: string
  createdAt: number | null
  modifiedAt: number | null
}

type PersistedMarkdownNote = Omit<MarkdownNote, "fileName">

const NOTES_KEY = "studyspace:markdown-notes:v1"
const MIGRATION_KEY = "studyspace:markdown-notes:migrated:v1"
export const LEGACY_NOTES_BACKUP_KEY = "studyspace:legacy-notes-backup:v1"

export function markdownFileName(title: string, id: string) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-")
  return `${slug || "note"}--${safeId || "new"}.md`
}

export function serializeMarkdownNote(note: PersistedMarkdownNote) {
  const frontmatter = stringifyYaml({
    id: note.id,
    title: note.title,
    subject: note.subject,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  })
  return `---\n${frontmatter.trimEnd()}\n---\n${note.content}`
}

export function parseMarkdownFile(file: MarkdownFile): MarkdownNote {
  const match = file.contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const parsedMetadata = match ? parseYaml(match[1]) : null
  const metadata = parsedMetadata && typeof parsedMetadata === "object" && !Array.isArray(parsedMetadata)
    ? parsedMetadata as Record<string, unknown>
    : {}
  const fileTitle = file.fileName.replace(/--[^/]+\.md$/, "").replace(/\.md$/, "").replace(/[-_]+/g, " ")
  const idFromName = file.fileName.match(/--([a-zA-Z0-9_-]+)\.md$/)?.[1]
  const now = Date.now()

  return {
    id: typeof metadata.id === "string" ? metadata.id : idFromName ?? file.fileName,
    title: typeof metadata.title === "string" && metadata.title.trim() ? metadata.title : fileTitle || "Untitled note",
    subject: typeof metadata.subject === "string" ? metadata.subject : "General",
    content: match ? file.contents.slice(match[0].length).replace(/^\n/, "") : file.contents,
    createdAt: typeof metadata.createdAt === "number" ? metadata.createdAt : file.createdAt ?? now,
    updatedAt: typeof metadata.updatedAt === "number" ? metadata.updatedAt : file.modifiedAt ?? now,
    fileName: file.fileName,
  }
}

function legacyNoteFile(note: StudyNote) {
  const createdAt = note.updatedAt
  return {
    fileName: markdownFileName(note.title, note.id),
    contents: serializeMarkdownNote({
      id: note.id,
      title: note.title,
      subject: note.subject,
      content: note.content,
      createdAt,
      updatedAt: note.updatedAt,
    }),
    createdAt,
    modifiedAt: note.updatedAt,
  }
}

function loadBrowserNotes(legacyNotes: StudyNote[]) {
  let notes: MarkdownNote[] = []
  const saved = window.localStorage.getItem(NOTES_KEY)
  if (saved) {
    const records = JSON.parse(saved) as MarkdownFile[]
    notes = records.map(parseMarkdownFile)
  }

  const migrationComplete = window.localStorage.getItem(MIGRATION_KEY) === "complete"
  if (!migrationComplete) {
    const byId = new Set(notes.map((note) => note.id))
    for (const note of legacyNotes) {
      if (!byId.has(note.id)) notes.push(parseMarkdownFile(legacyNoteFile(note)))
    }
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes.map((note) => ({
      fileName: note.fileName,
      contents: serializeMarkdownNote(note),
      createdAt: note.createdAt,
      modifiedAt: note.updatedAt,
    }))))
    window.localStorage.setItem(MIGRATION_KEY, "complete")
  }

  return { notes, legacyNotesHandled: legacyNotes.length > 0 }
}

export async function loadMarkdownNotes(legacyNotes: StudyNote[]) {
  if (!isTauri()) return loadBrowserNotes(legacyNotes)

  await invoke("import_legacy_markdown_notes", { notes: legacyNotes.map(legacyNoteFile) })
  const files = await invoke<MarkdownFile[]>("list_markdown_notes")
  return {
    notes: files.map(parseMarkdownFile),
    legacyNotesHandled: legacyNotes.length > 0,
  }
}

export async function saveMarkdownNote(note: MarkdownNote, existingNotes: MarkdownNote[]) {
  const updatedAt = Date.now()
  const fileName = markdownFileName(note.title, note.id)
  const savedNote = { ...note, fileName, updatedAt }
  const contents = serializeMarkdownNote(savedNote)
  const existing = existingNotes.find((item) => item.id === note.id)

  if (isTauri()) {
    await invoke("save_markdown_note", {
      oldFileName: existing?.fileName ?? null,
      fileName,
      contents,
    })
  } else {
    const nextNotes = existing
      ? existingNotes.map((item) => item.id === note.id ? savedNote : item)
      : [...existingNotes, savedNote]
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(nextNotes.map((item) => ({
      fileName: item.fileName,
      contents: serializeMarkdownNote(item),
      createdAt: item.createdAt,
      modifiedAt: item.updatedAt,
    }))))
  }

  return savedNote
}

export async function deleteMarkdownNote(note: MarkdownNote, existingNotes: MarkdownNote[]) {
  if (isTauri()) {
    await invoke("delete_markdown_note", { fileName: note.fileName })
  } else {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(existingNotes
      .filter((item) => item.id !== note.id)
      .map((item) => ({
        fileName: item.fileName,
        contents: serializeMarkdownNote(item),
        createdAt: item.createdAt,
        modifiedAt: item.updatedAt,
      }))))
  }
}