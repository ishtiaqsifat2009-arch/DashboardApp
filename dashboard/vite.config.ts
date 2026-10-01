import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const projectRoot = process.cwd()
const tauriConfig = JSON.parse(readFileSync(resolve(projectRoot, 'src-tauri/tauri.conf.json'), 'utf8')) as { version: string }
function resolveRevision() {
  const buildRevision = process.env.STUDYSPACE_GIT_SHA
  if (buildRevision) return buildRevision.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const revision = resolveRevision()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __STUDYSPACE_VERSION__: JSON.stringify(tauriConfig.version),
    __STUDYSPACE_REVISION__: JSON.stringify(revision),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
