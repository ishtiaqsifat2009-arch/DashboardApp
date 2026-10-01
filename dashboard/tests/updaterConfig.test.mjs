import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const tauriConfig = JSON.parse(readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"))

test("desktop releases disable updater signing when auto-update is not configured", () => {
  assert.equal(tauriConfig.plugins?.updater?.active, false)
  assert.equal(tauriConfig.bundle.createUpdaterArtifacts, false)
  assert.ok(!tauriConfig.plugins?.updater?.endpoints || tauriConfig.plugins.updater.endpoints.length === 0)
})
