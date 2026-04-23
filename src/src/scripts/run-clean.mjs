#!/usr/bin/env node
// Strips ELECTRON_RUN_AS_NODE from the env before spawning the given command.
// Reason: if the system/user env has ELECTRON_RUN_AS_NODE=1 set (common on
// dev machines that have used Chromium tooling), the Electron binary boots
// into Node mode and never injects its API. `cross-env VAR=` only sets an
// empty string, which Electron still treats as truthy. Actually deleting the
// var is the only fix.

import { spawn } from 'node:child_process'

delete process.env.ELECTRON_RUN_AS_NODE

const [, , ...args] = process.argv
if (args.length === 0) {
  console.error('usage: run-clean.mjs <cmd> [args...]')
  process.exit(1)
}

const child = spawn(args[0], args.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env
})
child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
