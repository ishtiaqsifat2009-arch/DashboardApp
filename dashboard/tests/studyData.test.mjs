import assert from "node:assert/strict"
import test from "node:test"
import { reducer } from "../src/studyData.ts"

function createData() {
  return {
    tasks: [],
    notes: [],
    plan: [],
    logs: [],
    flashcardDecks: [],
    timer: {
      subject: "Biology",
      topic: "Cell structure",
      durationMinutes: 1,
      remainingSeconds: 60,
      isRunning: false,
      endsAt: null,
      segmentStartedAt: null,
    },
  }
}

test("canceling a running timer discards its uncommitted study time", () => {
  const started = reducer(createData(), { type: "timer/start", now: 1_000 })
  const canceled = reducer(started, { type: "timer/reset" })

  assert.equal(canceled.timer.isRunning, false)
  assert.equal(canceled.timer.remainingSeconds, 60)
  assert.equal(canceled.timer.segmentStartedAt, null)
  assert.deepEqual(canceled.logs, [])
})

test("canceling after a pause keeps saved work and discards only the active segment", () => {
  const started = reducer(createData(), { type: "timer/start", now: 1_000 })
  const paused = reducer(started, { type: "timer/pause", now: 6_000 })
  const resumed = reducer(paused, { type: "timer/start", now: 20_000 })
  const canceled = reducer(resumed, { type: "timer/reset" })

  assert.equal(canceled.logs.length, 1)
  assert.equal(canceled.logs[0].durationSeconds, 5)
  assert.equal(canceled.timer.remainingSeconds, 60)
})

test("a timer completes at its persisted deadline and logs the segment once", () => {
  const started = reducer(createData(), { type: "timer/start", now: 1_000 })
  const completed = reducer(started, { type: "timer/tick", now: 61_000 })
  const tickedAgain = reducer(completed, { type: "timer/tick", now: 62_000 })

  assert.equal(completed.timer.isRunning, false)
  assert.equal(completed.timer.remainingSeconds, 0)
  assert.equal(completed.timer.endsAt, null)
  assert.equal(completed.logs.length, 1)
  assert.equal(completed.logs[0].durationSeconds, 60)
  assert.equal(tickedAgain.logs.length, 1)
})

test("deleting a completed session removes its persisted study-time record", () => {
  const data = createData()
  data.logs = [{ id: "session-1", subject: "Biology", topic: "Cells", startedAt: 1_000, durationSeconds: 60 }]

  const updated = reducer(data, { type: "log/delete", id: "session-1" })

  assert.deepEqual(updated.logs, [])
})

test("pause and resume preserve separately completed study segments", () => {
  const started = reducer(createData(), { type: "timer/start", now: 1_000 })
  const paused = reducer(started, { type: "timer/pause", now: 6_000 })
  const resumed = reducer(paused, { type: "timer/start", now: 20_000 })
  const completed = reducer(resumed, { type: "timer/tick", now: 75_000 })

  assert.equal(completed.logs.length, 2)
  assert.deepEqual(completed.logs.map((log) => log.durationSeconds), [5, 55])
  assert.equal(completed.timer.remainingSeconds, 0)
})