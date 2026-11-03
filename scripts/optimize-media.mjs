// Encodes a photo or short video for the places deck into src/assets/places, and prints
// the markup for its slot in index.html. Location and camera data are left out of the output.
//   npm run media -- ~/Desktop/IMG_1234.heic japan-temple
//   npm run media -- ~/Desktop/IMG_0457.mov japan-river     (videos need ffmpeg: brew install ffmpeg)

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'

const OUT_DIR = resolve(import.meta.dirname, '../src/assets/places')
const URL_DIR = '/src/assets/places'
const LONG_EDGES = [1600, 1200, 800, 480]
const POSTER_LONG_EDGE = 1200
const VIDEO_LONG_EDGE = 1120 // the largest card on a 2x screen
const VIDEO_CRFS = [26, 30, 34, 38] // tried in order, until the file fits
const VIDEO_MAX_BYTES = 2 * 1024 * 1024
const CARD_SIZES = 'min(420px, 100vw - 64px)'

const [source, name] = process.argv.slice(2)
if (!source || !name) {
  console.error('usage: npm run media -- <file> <name>')
  process.exit(1)
}

// sharp can't read iPhone HEIC files, but macOS can.
function readable(file, dir) {
  if (!/\.hei[cf]$/i.test(file)) return file
  const jpeg = join(dir, 'source.jpg')
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', file, '--out', jpeg], { stdio: 'ignore' })
  return jpeg
}

async function encodePhoto(file) {
  const { data, info } = await sharp(file).rotate().toBuffer({ resolveWithObject: true })
  const longest = Math.max(info.width, info.height)
  // Never scaled up: a small source gets its own size as the largest version.
  const edges = [...new Set([Math.min(longest, LONG_EDGES[0]), ...LONG_EDGES.filter((edge) => edge < longest)])]
  const versions = []
  for (const edge of edges) {
    const image = sharp(data).resize({ width: edge, height: edge, fit: 'inside' })
    const { width } = await image.clone().avif({ quality: 55, effort: 6 }).toFile(join(OUT_DIR, `${name}-${edge}.avif`))
    await image.webp({ quality: 82, effort: 6 }).toFile(join(OUT_DIR, `${name}-${edge}.webp`))
    versions.push({ edge, width })
  }
  const srcset = (type) => versions.map(({ edge, width }) => `${URL_DIR}/${name}-${edge}.${type} ${width}w`).reverse().join(', ')
  console.log(`<picture><source type="image/avif" srcset="${srcset('avif')}" sizes="${CARD_SIZES}"><img src="${URL_DIR}/${name}-${edges[0]}.webp" srcset="${srcset('webp')}" sizes="${CARD_SIZES}" loading="lazy" alt=""></picture>`)
}

async function encodeVideo(file, dir) {
  const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, ...args], { stdio: 'inherit' })
  const frame = join(dir, 'poster.png')
  ffmpeg('-frames:v', '1', frame)
  await sharp(frame)
    .resize({ width: POSTER_LONG_EDGE, height: POSTER_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(join(OUT_DIR, `${name}-poster.webp`))

  const edge = VIDEO_LONG_EDGE
  const scale = `scale='if(gt(iw,ih),min(${edge},iw),-2)':'if(gt(iw,ih),-2,min(${edge},ih))'`
  const output = join(OUT_DIR, `${name}.mp4`)
  let bytes
  for (const crf of VIDEO_CRFS) {
    ffmpeg('-an', '-map_metadata', '-1', '-vf', scale, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output)
    bytes = statSync(output).size
    if (bytes <= VIDEO_MAX_BYTES) break
  }
  const size = `${(bytes / 1024 / 1024).toFixed(2)}MB`
  if (bytes > VIDEO_MAX_BYTES) console.error(`${name}.mp4 is still ${size} at the lowest quality, so trim the clip.`)
  else console.error(`${name}.mp4 is ${size}`)
  console.log(`<video src="${URL_DIR}/${name}.mp4" poster="${URL_DIR}/${name}-poster.webp" preload="none" muted loop playsinline aria-label=""></video>`)
}

const dir = mkdtempSync(join(tmpdir(), 'media-'))
try {
  if (/\.(mov|mp4|m4v|webm)$/i.test(extname(source))) await encodeVideo(source, dir)
  else await encodePhoto(readable(source, dir))
} finally {
  rmSync(dir, { recursive: true, force: true })
}
