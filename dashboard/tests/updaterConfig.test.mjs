import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const tauriConfig = JSON.parse(readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"))

test("desktop releases generate updater artifacts and point at the GitHub update feed", () => {
  assert.equal(tauriConfig.bundle.createUpdaterArtifacts, true)
  assert.ok(Array.isArray(tauriConfig.plugins?.updater?.endpoints))
  assert.ok(tauriConfig.plugins?.updater?.endpoints.some((entry) => entry.includes("github.com") && entry.includes("releases") && entry.includes("download")))
})
