import assert from "node:assert/strict"
import test from "node:test"
import { deleteMarkdownNote, loadMarkdownNotes, markdownFileName, parseMarkdownFile, saveMarkdownNote, serializeMarkdownNote } from "../src/markdownNotes.ts"

test("Markdown frontmatter preserves note metadata and body", () => {
  const note = {
    id: "note-123",
    title: "Cell Biology",
    subject: "Biology",
    content: "# Membranes\n\n- [x] Review transport",
    createdAt: 100,
    updatedAt: 200,
  }
  const fileName = markdownFileName(note.title, note.id)
  const loaded = parseMarkdownFile({
    fileName,
    contents: serializeMarkdownNote(note),
    createdAt: 100,
    modifiedAt: 200,
  })

  assert.deepEqual(loaded, { ...note, fileName })
})

test("plain Markdown files remain editable without frontmatter", () => {
  const note = parseMarkdownFile({
    fileName: "review-notes.md",
    contents: "## Study guide\n\nUse `ATP` in examples.",
    createdAt: 100,
    modifiedAt: 200,
  })

  assert.equal(note.title, "review notes")
  assert.equal(note.content, "## Study guide\n\nUse `ATP` in examples.")
  assert.equal(note.createdAt, 100)
  assert.equal(note.updatedAt, 200)
})

test("filenames remain unique for punctuation-only and non-Latin titles", () => {
  assert.equal(markdownFileName("!!!", "task id/one"), "note--task-id-one.md")
  assert.equal(markdownFileName("物質", "note-42"), "note--note-42.md")
})

test("browser fallback imports legacy notes, reopens edits, and deletes saved Markdown", async () => {
  const storage = new Map()
  const originalWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  }

  try {
    const legacyNotes = [{ id: "legacy-1", title: "Cell Review", subject: "Biology", content: "## Membrane", updatedAt: 200 }]
    const imported = await loadMarkdownNotes(legacyNotes)
    assert.equal(imported.legacyNotesHandled, true)
    assert.equal(imported.notes[0].content, "## Membrane")

    const edited = await saveMarkdownNote({ ...imported.notes[0], title: "Cell Membrane Review", content: "## Phospholipids" }, imported.notes)
    const reopened = await loadMarkdownNotes([])
    assert.equal(reopened.notes[0].title, "Cell Membrane Review")
    assert.equal(reopened.notes[0].content, "## Phospholipids")

    await deleteMarkdownNote(edited, reopened.notes)
    assert.deepEqual((await loadMarkdownNotes([])).notes, [])
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})