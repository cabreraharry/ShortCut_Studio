# ShortCut Studio

Unified client-side UI for the SCL document-processing ecosystem. Windows-first Electron desktop app for researchers / academics: scan eBook libraries, configure LLM providers, manage topics + super-categories, monitor progress against the peer network, and route private content to a separate DB.

> Repo on disk: `ShortCut_Studio/`. Product display name: **ShortCut Studio**. (The pre-rewrite codebase was named `ElectronAdmin2`; some historical handoff docs under [`docs/claude-handoff/`](docs/claude-handoff/) still mention it in past tense.)

## Where the code lives

All active code is under [`src/src/`](src/src/). Treat that as the project root.

## Quick start

```sh
cd src/src
npm install              # also rebuilds better-sqlite3 for Electron via postinstall
npm run dev              # electron-vite dev server (HMR for renderer)
npm run typecheck        # both node + web TS projects
npm run build            # electron-vite build → out/
npm run build:win        # full Windows NSIS installer → release-builds/
npm run storybook        # Playwright-driven page screenshots → storybook/
```

If `better-sqlite3` errors with *"compiled against a different Node.js version"* on first run, do `npx electron-rebuild` from `src/src/`.

## Stack

Electron 33 · Vite 5 · React 18 · TypeScript · Tailwind v3 · shadcn/ui · React Query · Zustand · better-sqlite3

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — the canonical project guide for both human collaborators and Claude Code sessions: architecture, IPC model, DB schema, conventions, gotchas.
- [`docs/claude-handoff/`](docs/claude-handoff/) — narrative session-handoff material (decisions, features built, pending work, how-to-continue).
- [`_Docu/`](_Docu/) — owner-supplied design references (PDFs, screenshots).

## License

MIT. See [`src/src/package.json`](src/src/package.json).
