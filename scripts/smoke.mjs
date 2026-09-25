/**
 * Checks the bundle Tauri ships, not the source Vite serves.
 *
 * The desktop app has no server: `tauri.conf.json` points `frontendDist` at
 * `.output/public`, and the web view reads those files straight off disk. So the
 * artefact is verified the same way — every asset an entry page references has to
 * exist at the path it names.
 *
 * One page is enough: both windows load it, and the panel is what the front end
 * renders when it sees the panel window's label.
 *
 * Run with: node scripts/smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '.output/public'

/** Entry pages that must exist as real files, with what proves each one rendered. */
const PAGES = [{ path: 'index.html', marker: 'id="__nuxt"' }]

let failed = false

function fail(message) {
  console.error(`smoke: FAIL ${message}`)
  failed = true
}

if (!existsSync(ROOT)) {
  fail(`${ROOT} is missing — run \`pnpm build\` first`)
  process.exit(1)
}

for (const { path, marker } of PAGES) {
  const file = join(ROOT, path)
  if (!existsSync(file)) {
    fail(`${path} was not generated`)
    continue
  }

  const html = readFileSync(file, 'utf8')
  if (!html.includes(marker)) {
    fail(`${path} does not look like the app (no ${marker})`)
    continue
  }

  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m => m[1])
  const missing = refs.filter(ref => !existsSync(join(ROOT, ref)))
  if (missing.length) {
    fail(`${path} references files that are not in the bundle: ${missing.join(', ')}`)
    continue
  }

  console.log(`smoke: ok   ${path} (${refs.length} assets)`)
}

process.exit(failed ? 1 : 0)
