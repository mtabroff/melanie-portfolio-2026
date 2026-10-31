import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Gives each place its own page in the build, so a shared /places/japan link
// loads on any static host without a rewrite rule.
function placePages() {
  let outDir
  return {
    name: 'place-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const page = resolve(outDir, 'index.html')
      const html = readFileSync(page, 'utf8')
      for (const [, slug] of html.matchAll(/<main[^>]*data-place="([^"]+)"/g)) {
        const dir = resolve(outDir, 'places', slug)
        mkdirSync(dir, { recursive: true })
        copyFileSync(page, resolve(dir, 'index.html'))
      }
    },
  }
}

export default defineConfig({
  plugins: [placePages()],
})
