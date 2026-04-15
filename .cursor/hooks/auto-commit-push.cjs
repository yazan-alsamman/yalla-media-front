#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process')

function run(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function safeRun(command) {
  try {
    return run(command)
  } catch {
    return ''
  }
}

function hasTrackedChanges() {
  const tracked = safeRun('git diff --name-only')
  const staged = safeRun('git diff --cached --name-only')
  return tracked.length > 0 || staged.length > 0
}

function hasUntrackedChanges() {
  const untracked = safeRun('git ls-files --others --exclude-standard')
  return untracked.length > 0
}

function hasAnyChanges() {
  return hasTrackedChanges() || hasUntrackedChanges()
}

function touchesSensitiveFiles() {
  const files = safeRun('git status --porcelain')
  if (!files) return false
  return files
    .split('\n')
    .some((line) => /\.(env($|\.)|pem$|key$|p12$|pfx$|jks$|crt$|cer$|secrets?)/i.test(line))
}

function main() {
  const branch = safeRun('git rev-parse --abbrev-ref HEAD')
  if (!branch) return

  // Never auto-push protected branches.
  if (branch === 'main' || branch === 'master') {
    console.log('[auto-push-hook] Skipped: protected branch.')
    return
  }

  if (!hasAnyChanges()) {
    return
  }

  // Avoid accidental secret pushes.
  if (touchesSensitiveFiles()) {
    console.log('[auto-push-hook] Skipped: sensitive file detected.')
    return
  }

  // Basic quality gate before commit/push.
  run('npm run lint')
  run('npm run build')

  run('git add -A')
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const message = `chore(auto): sync dashboard edits (${now} UTC)`
  const committed = safeRun(`git commit -m "${message}"`)
  if (!committed) return

  run('git push -u origin HEAD')
  console.log(`[auto-push-hook] Pushed branch: ${branch}`)
}

try {
  main()
} catch (error) {
  // Fail open: the agent should still finish even if auto-push fails.
  const msg = error && error.message ? error.message : String(error)
  console.log(`[auto-push-hook] Failed safely: ${msg}`)
}
