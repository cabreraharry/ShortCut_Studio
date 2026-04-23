# 03 — Key decisions

Every meaningful product / architectural / scope decision made during the session, with the reason that drove it. When you're unsure how to handle an edge case, start here — one of these decisions probably constrains the answer.

## Product decisions

### End-user profile: researchers / academics / knowledge workers
**Why:** Owner's doc frames SCL as a tool for experts who scan their eBook libraries. Researchers are tech-comfortable but not developers — they can handle an API key but want a polished UX.
**Implications:** Dark mode default. Dense information OK on the Dashboard (they want numbers). Friendly-but-not-hand-holdy copy. Onboarding modal for LLM keys rather than assuming they know how.

### Keep Public/Private mode as a visible toggle
**Why:** Owner's doc didn't mention it, but SCL_Demo's dual-DB design is load-bearing (user may want to scan company-confidential files separately from public library). User explicitly chose to keep it as a first-class concept.
**Implications:** Every feature that reads scan data respects the current mode. The toggle lives in the Header so it's always reachable. Switching invalidates React Query cache so views refresh.

### Privacy-first positioning
**Why:** Owner's doc stresses that experts shouldn't share their expertise with commercial LLMs that may redistribute it.
**Implications:** LLM page has a prominent warning callout. Onboarding copy explicitly says "use remote LLMs only for busy-work." Ollama (local) is marketed as the privacy-preserving default.

### Full replacement, not orchestration
**Why:** User decided ElectronAdmin2 + SCL_Demo GUI should merge into one app. Running two programs is the current pain. Feature-consolidation > keeping-both-apps.
**Implications:** SCL_Demo's PySide6 GUI is archived; its scanner + watchdog + topic-gen .exes become headless workers the Electron app spawns.

## Tech-stack decisions

### Electron + React + Vite + TypeScript + Tailwind + shadcn/ui
**Why:** Modern standard. Excellent component library (shadcn), fast dev loop (Vite HMR), strong types (TS), design tokens (Tailwind CSS vars), no jQuery. The explicit user pick.
**Implications:** No Bootstrap, no jQuery, no vanilla-JS DOM manipulation. React Query for async state, Zustand for local state (no Redux).

### better-sqlite3, not node-sqlite3
**Why:** Synchronous API is simpler for main-process DB access; faster for small queries. `postinstall` runs `electron-builder install-app-deps` which rebuilds the native binding for Electron's Node ABI.
**Implications:** DB queries are blocking — fine, main process is idle most of the time. If a query ever becomes slow, move it to a worker_thread. Never import `better-sqlite3` in the renderer.

### `.invoke` based IPC, not `.send/.on`
**Why:** Promise-based, type-safe round-trip. The old ElectronAdmin2 used `.send` + `.on` pairs which required manually matching channel names.
**Implications:** Every IPC handler returns a value (or `void`). Channel names live in `src/shared/ipc-channels.ts` as constants — never hardcode strings. `window.electronAPI` is typed via `src/shared/api.ts`'s `ElectronAPI` interface.

### Keep SCL_Demo's Python workers, add FastAPI wrapper
**Why:** Rewriting scanner + watchdog + Gemini processor in Node would be months of work and reinvent tested code. Alternative: stdout-parse their output (fragile). Compromise: add a small FastAPI wrapper module (`SCL_Demo/tools/worker_api.py`) that each worker imports + runs in a thread, exposing `/health` + `/status` for the Electron supervisor to poll.
**Implications:** Workers stay in Python. Rebuilding a worker `.exe` requires running SCL_Demo's PowerShell build scripts. Workers that haven't adopted the wrapper yet still run under the supervisor, they just don't respond to health pings (no problem for v1).

### NSIS installer via electron-builder (not electron-packager)
**Why:** Installer gives users a proper install/uninstall experience; electron-packager only produces a portable folder. `electron-builder` also handles code signing (when a cert arrives) + auto-update feed (when activated).
**Implications:** The `package-win` skill now wraps `npm run build:win`. Auto-updater wired but feed URL is a placeholder — activate in v1.5.

## Scope decisions

### In-place rewrite of `ElectronAdmin2/`, not a new folder
**Why:** The user pushed back when Claude defaulted to creating `ShortCut Studio/`. The existing folder already had `icon.ico`, `db_files/`, `exe/`, `release-builds/`, and all project-scoped Claude Code skills + settings pointed at it. Standing up a parallel project meant churn with no real benefit — the old code was getting deleted anyway.
**Implications:** Folder rename to a final product name is deferred; internal `package.json` name is `scl-admin`. **Saved as a feedback memory** at `C:/Users/harrycabrera/.claude/projects/D--Client-Side-Project/memory/feedback_inplace_rewrites.md` — future sessions should default to in-place rewrites when existing scaffolding is reusable.

### ExecEngine integration: mock client + swap point for v1
**Why:** ExecEngine's HTTP consumer layer is documented but NOT implemented — only internal TCP QUEUE works (ports 44998/44999). Waiting for the owner to finish that layer before the client ships would block everything. The workaround: feature code depends on the `IExecEngineClient` interface; v1 ships `MockExecEngineClient` (deterministic synthetic data with a sine-wave + linear trend so the Progress Glass feels alive); v2 swaps in the real CP-protocol implementation.
**Implications:** No `if (v1)` branches in feature code. When ExecEngine's FastAPI lands, writing `real.ts` should be the only main-process change (plus swapping the factory in `execengine/client.ts::getExecEngine()`).

### Progress Glass in v1, flagship feature
**Why:** Owner's doc described it in most detail — it's the retention hook. Deferring it means deferring the one prototype the owner will most want to critique. Peer data is stubbed via the mock, local data is real. The Glass can ship functional immediately.
**Implications:** SVG component in `src/renderer/features/dashboard/ProgressGlass.tsx`. Two stacked `<rect>` fills clipped by a beaker silhouette. CSS transitions on `y` and `height`. Time-range bar drives summary numbers.

### IPFS UI-ready but backend-stubbed for v1
**Why:** IPFS integration depends on ExecEngine's real implementation. But the UI itself is part of the product pitch — owner wants users to see the allocation controls from day one.
**Implications:** Community page fully interactive: GB slider, drive picker (stubbed), share toggle. All values go through `IExecEngineClient` mock.

### Full topic CRUD deferred to v2
**Why:** Review-and-approve covers 90% of the editing workflow (rename/merge/reject implicit in approval). Pure-manual topic creation is edge-case for researchers.
**Implications:** `TopicsApprove` handler currently stubs. Super-category management is fully functional (CRUD on `SuperCategories` table + `TopicSuperCategoryMap`). Real Gemini-backed generation + approval flow lands when `gemini_processor.exe` adopts the FastAPI wrapper.

### 3 ASCII mockups in the plan, not more
**Why:** Plan file scannability. The top 3 signature screens (Shell, Progress Glass, Info Section) cover the layout vocabulary everything else inherits.
**Implications:** Plan has visual anchors for the owner's Round-1 feedback. Real implementations in `components/layout/` and `features/dashboard/` deliberately mirror the ASCII sketches.

### Content classification in v1.5, not v1
**Why:** Content-based classification (this PDF is a paper / receipt / book) is high-value for researchers but needs a classifier (LLM-backed or rules-based) and a UI for handling misclassification. Scope ballooning territory.
**Implications:** v1 ships folder + file-type filters only. v1.5 adds a `Files.DocCategory` column and an LLM-call classifier.

### Custom rules engine in v2
**Why:** Power-user feature. Unknown demand until real users are using v1.
**Implications:** Don't design for it yet. FileTypeFilters table is the most expressive knob v1 has.

## Service-management decision

### Auto-managed services, visible-when-it-matters
**Why:** End users are researchers, not developers — they don't know what "port 18877" is. Having services start / restart / crash silently means users hit mysterious errors. Middle ground: auto-spawn + auto-restart in the background, with a Diagnostics panel tucked in Settings for when something's broken.
**Implications:** `src/main/workers/supervisor.ts` spawns all long-running workers at app boot. Auto-restart with exponential backoff (max 5 attempts). Diagnostics panel is hidden by default; user clicks "Show" when something's wrong. Log tail + Restart button let them fix it inside the app — no alt-tabbing to external `.exe` tools.

### LocalHostTools (StartFile/TopicExplorer/TopicStat) left as-is for v1
**Why:** They work. Folding their Python source into SCL_Demo and rebuilding is a larger change than necessary.
**Implications:** `resources/exe/` bundles them via electron-builder's `extraResources`. Main-process code calls them via HTTP when needed (e.g., file-open from Topics uses StartFile on 18866).

## Owner-facing decisions (explicitly deferred)

| Decision | Who decides | When |
|---|---|---|
| Info Section messages (15-25) | Owner | Before first user release |
| Affiliate eShop links | Owner | Before launch |
| Subscription flow + payment provider | Owner | v1.5+ |
| Brand identity (logo, colors, wordmark) | Owner | Before installer is public |
| Code signing certificate purchase | Owner | Before auto-update activates |
| ExecEngine CP protocol finalization | Owner | When FastAPI layer ships |

Placeholder values / blank buttons mark where owner input is still needed. Never make these decisions autonomously — flag them for the user / owner.
