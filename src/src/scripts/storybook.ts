import { _electron as electron, type Page } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()
const EXE_PATH = join(PROJECT_ROOT, 'release-builds', 'win-unpacked', 'ShortCut Studio.exe')
const OUT_DIR = join(PROJECT_ROOT, 'storybook')
const SHOTS_DIR = join(OUT_DIR, 'screenshots')

interface Route {
  hash: string
  label: string
  slug: string
}

const ROUTES: Route[] = [
  { hash: '#/dashboard',     label: 'Dashboard',     slug: 'dashboard' },
  { hash: '#/folders',       label: 'Folders',       slug: 'folders' },
  { hash: '#/topics',        label: 'Topics',        slug: 'topics' },
  { hash: '#/insights',      label: 'Insights',      slug: 'insights' },
  { hash: '#/topic-map',     label: 'Topic Map',     slug: 'topic-map' },
  { hash: '#/community',     label: 'Community',     slug: 'community' },
  { hash: '#/filters',       label: 'Filters',       slug: 'filters' },
  { hash: '#/privacy',       label: 'Privacy',       slug: 'privacy' },
  { hash: '#/llm',           label: 'LLMs',          slug: 'llm' },
  { hash: '#/settings',      label: 'Settings',      slug: 'settings' }
]

async function captureRoute(page: Page, route: Route): Promise<void> {
  await page.evaluate((h) => { window.location.hash = h }, route.hash)
  // Let React render + animations / count-ups settle
  await page.waitForLoadState('networkidle').catch(() => { /* ignore */ })
  await page.waitForTimeout(900)
  await page.screenshot({
    path: join(SHOTS_DIR, `${route.slug}.png`),
    fullPage: true
  })
}

function buildMarkdown(): string {
  const date = new Date().toISOString().slice(0, 10)
  const lines: string[] = [
    '# ShortCut Studio — UX Storybook',
    '',
    `Generated ${date} from the packaged build at \`release-builds/win-unpacked/ShortCut Studio.exe\`.`,
    'Each section is one page of the app.',
    '',
    '## How to use this for AI feedback',
    '',
    'Paste the section for one page into Claude / GPT / Gemini with this prompt:',
    '',
    '> You are a senior product designer. Review the screenshot below from',
    '> ShortCut Studio (an Electron desktop app for researchers). Give me 3-5',
    '> concrete improvements: layout, visual hierarchy, copy, affordance gaps,',
    '> or anything that looks broken. Be specific — name elements, suggest',
    '> pixel-level or wording changes. Skip generic praise.',
    '',
    '---',
    ''
  ]
  for (const r of ROUTES) {
    lines.push(`## ${r.label}`, '', `![${r.label}](screenshots/${r.slug}.png)`, '')
  }
  return lines.join('\n')
}

async function main(): Promise<void> {
  await mkdir(SHOTS_DIR, { recursive: true })

  // Strip ELECTRON_RUN_AS_NODE — if it leaks in from the parent shell it makes
  // Electron behave as a plain Node binary and our launch will hang.
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  console.log(`[storybook] launching ${EXE_PATH}`)
  const app = await electron.launch({
    executablePath: EXE_PATH,
    env: env as Record<string, string>,
    timeout: 30_000
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  // First-paint settle (sidebar, header, hero count-ups)
  await page.waitForTimeout(1500)

  for (const route of ROUTES) {
    console.log(`[storybook] capturing ${route.label}  (${route.hash})`)
    await captureRoute(page, route)
  }

  await writeFile(join(OUT_DIR, 'STORYBOOK.md'), buildMarkdown(), 'utf8')
  console.log(`[storybook] wrote ${join(OUT_DIR, 'STORYBOOK.md')}`)

  await app.close()
  console.log('[storybook] done')
}

main().catch((err) => {
  console.error('[storybook] failed:', err)
  process.exit(1)
})
