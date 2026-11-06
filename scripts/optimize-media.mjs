// Encodes a photo or short video for the places deck into src/assets/places, and prints
// the markup for its slot in index.html. Location and camera data are left out of the output.
//   npm run media -- ~/Desktop/IMG_1234.heic japan-temple
//   npm run media -- ~/Desktop/IMG_0457.mov japan-river     (videos need ffmpeg: brew install ffmpeg)
// --screen <folder> is for a 3x phone screen export: it writes 3x, 2x and 1x versions at
// a higher quality, since screens are mostly text, into src/assets/<folder>.
//   npm run media -- src/assets/somethings/hub-1-chat.png hub-1-chat --screen somethings
// --widths sets the screen versions, for phones shown smaller than 1x, like the Titan trio.
//   npm run media -- src/assets/titan/titan-1-home.png titan-1-home --screen titan --widths 1179,786,548,365,183
// --height keeps only the top of a tall export, in 1x points, like a screen that's 852 tall.
// --folder puts a deck photo or video somewhere other than src/assets/places.
//   npm run media -- src/assets/travels/wyoming/03-wyoming-grand-prismatic.jpg 03-wyoming-grand-prismatic --folder travels/wyoming

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const screenAt = args.indexOf('--screen')
const screenFolder = screenAt === -1 ? null : args.splice(screenAt, 2)[1]
const widthsAt = args.indexOf('--widths')
const screenWidths = widthsAt === -1 ? null : args.splice(widthsAt, 2)[1].split(',').map(Number)
const heightAt = args.indexOf('--height')
const screenHeight = heightAt === -1 ? null : Number(args.splice(heightAt, 2)[1]) // in 1x points, from the top
const folderAt = args.indexOf('--folder')
const deckFolder = folderAt === -1 ? null : args.splice(folderAt, 2)[1]
const folder = screenFolder ?? deckFolder ?? 'places'
const OUT_DIR = resolve(import.meta.dirname, '../src/assets', folder)
const URL_DIR = `/src/assets/${folder}`
const LONG_EDGES = [1600, 1200, 800, 480]
const POSTER_LONG_EDGE = 1200
const VIDEO_LONG_EDGE = 1120 // the largest card on a 2x screen
const VIDEO_CRFS = [26, 30, 34, 38] // tried in order, until the file fits
const VIDEO_MAX_BYTES = 2 * 1024 * 1024
const CARD_SIZES = 'min(420px, 100vw - 64px)'
// The phone screen in a work card: 393px wide on desktop, and 68% of the card's width on phones.
const SCREEN_SIZES = '(max-width: 959px) min(380px, 67.8vw - 27px), 393px'

const [source, name] = args
if (!source || !name || (screenAt !== -1 && !screenFolder) || (folderAt !== -1 && !deckFolder)) {
  console.error('usage: npm run media -- <file> <name> [--screen <folder> | --folder <folder>]')
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

// Exact thirds of a 3x export, so each version lands on whole device pixels at 1x, 2x and 3x.
async function encodeScreen(file) {
  const { width, height } = await sharp(file).metadata()
  const versions = screenWidths ?? [3, 2, 1].map((density) => Math.round((width / 3) * density))
  const cropped = screenHeight
    ? await sharp(file).extract({ left: 0, top: 0, width, height: Math.min(height, screenHeight * 3) }).toBuffer()
    : file
  for (const size of versions) {
    const image = sharp(cropped).resize({ width: size, kernel: 'lanczos3' })
    await image.clone().avif({ quality: 72, chromaSubsampling: '4:4:4', effort: 6 }).toFile(join(OUT_DIR, `${name}-${size}.avif`))
    await image.webp({ quality: 90, smartSubsample: true, effort: 6 }).toFile(join(OUT_DIR, `${name}-${size}.webp`))
  }
  // The source itself is the PNG fallback, so a copy is only made when it lives somewhere else.
  const png = join(OUT_DIR, `${name}.png`)
  if (resolve(file) !== png) await sharp(file).png().toFile(png)
  const srcset = (type) => versions.map((size) => `${URL_DIR}/${name}-${size}.${type} ${size}w`).join(', ')
  console.log(`<picture><source type="image/avif" srcset="${srcset('avif')}" sizes="${SCREEN_SIZES}"><source type="image/webp" srcset="${srcset('webp')}" sizes="${SCREEN_SIZES}"><img src="${URL_DIR}/${name}.png" loading="lazy" alt=""></picture>`)
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
  // The poster is a lazy image beside the video, so it loads only when the deck needs it.
  console.log(`<video src="${URL_DIR}/${name}.mp4" preload="none" muted loop playsinline aria-label=""></video><img src="${URL_DIR}/${name}-poster.webp" loading="lazy" alt="">`)
}

const dir = mkdtempSync(join(tmpdir(), 'media-'))
try {
  if (/\.(mov|mp4|m4v|webm)$/i.test(extname(source))) await encodeVideo(source, dir)
  else if (screenFolder) await encodeScreen(readable(source, dir))
  else await encodePhoto(readable(source, dir))
} finally {
  rmSync(dir, { recursive: true, force: true })
}
