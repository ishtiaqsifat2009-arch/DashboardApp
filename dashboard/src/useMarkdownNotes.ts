import { useEffect, useRef, useState } from "react"
import {
  deleteMarkdownNote,
  LEGACY_NOTES_BACKUP_KEY,
  loadMarkdownNotes,
  saveMarkdownNote,
  type MarkdownNote,
} from "./markdownNotes"
import type { StudyNote } from "./studyData"

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function useMarkdownNotes(legacyNotes: StudyNote[], onLegacyNotesHandled: () => void) {
  const [notes, setNotes] = useState<MarkdownNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onLegacyNotesHandledRef = useRef(onLegacyNotesHandled)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const result = await loadMarkdownNotes(legacyNotes)
        if (!isMounted) return

        if (result.legacyNotesHandled) {
          window.localStorage.setItem(LEGACY_NOTES_BACKUP_KEY, JSON.stringify(legacyNotes))
          onLegacyNotesHandledRef.current()
        }
        setNotes(result.notes)
        setError(null)
      } catch (loadError) {
        if (isMounted) setError(errorMessage(loadError))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()
    return () => { isMounted = false }
  }, [legacyNotes])

  async function save(note: MarkdownNote) {
    try {
      const savedNote = await saveMarkdownNote(note, notes)
      setNotes((current) => current.some((item) => item.id === savedNote.id)
        ? current.map((item) => item.id === savedNote.id ? savedNote : item)
        : [...current, savedNote])
      setError(null)
      return savedNote
    } catch (saveError) {
      setError(errorMessage(saveError))
      return null
    }
  }

  async function remove(note: MarkdownNote) {
    try {
      await deleteMarkdownNote(note, notes)
      setNotes((current) => current.filter((item) => item.id !== note.id))
      setError(null)
      return true
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      return false
    }
  }

  return { notes, isLoading, error, save, remove }
}