// The Somethings website card. The page scrolls slowly down and back, and the mood face in the
// logo's O swaps every 300ms like a sticker slapped on: a random tilt, popping past full size.
// Noah's mentor card further down plays his video. With reduced motion, the CSS keeps the top
// of the page and the happy face.

import { loopWhileVisible, playWhileVisible } from './screen-loop.js'

const MOODS = ['happy', 'love', 'excited', 'surprised', 'pleased', 'awkward', 'confused', 'tired', 'sad', 'angry']
const SLOT = 300 // each face, in ms
const POP = 180
const POP_FROM = 0.85
const TILT = 8 // degrees either way
const ROUNDS = 6 // tilts are drawn for this many rounds of faces, so the repeat isn't noticeable
const EASE_STICKER = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

// In the page's 1440 wide design points.
const SCROLL_TO = 1380 // as far as the card can show before running past the end of the page
const HOLD_TOP = 1500
const SCROLL_DOWN = 9000
const HOLD_BOTTOM = 1000
const SCROLL_UP = 1200

const SLOTS = MOODS.length * ROUNDS
const MOOD_CYCLE = SLOT * SLOTS
const SCROLL_CYCLE = HOLD_TOP + SCROLL_DOWN + HOLD_BOTTOM + SCROLL_UP

// Each face shows only in its own slots, so two never tangle.
function moodFrames(index, tilts) {
  const at = (ms) => ms / MOOD_CYCLE
  const frames = [{ opacity: 0, transform: 'none', offset: 0 }]
  for (let slot = index; slot < SLOTS; slot += MOODS.length) {
    const start = SLOT * slot
    const tilt = `rotate(${tilts[slot]}deg)`
    frames.push(
      { opacity: 0, transform: `${tilt} scale(${POP_FROM})`, offset: at(start) },
      { opacity: 1, transform: `${tilt} scale(${POP_FROM})`, offset: at(start), easing: EASE_STICKER },
      { opacity: 1, transform: `${tilt} scale(1)`, offset: at(start + POP) },
      { opacity: 1, transform: `${tilt} scale(1)`, offset: at(start + SLOT) },
      { opacity: 0, transform: `${tilt} scale(1)`, offset: at(start + SLOT) },
    )
  }
  frames.push({ opacity: 0, transform: 'none', offset: 1 })
  return frames
}

function scrollFrames() {
  const at = (ms) => ms / SCROLL_CYCLE
  const down = `translateY(-${SCROLL_TO}em)`
  return [
    { transform: 'none', offset: 0 },
    { transform: 'none', offset: at(HOLD_TOP), easing: 'ease-in-out' },
    { transform: down, offset: at(HOLD_TOP + SCROLL_DOWN) },
    { transform: down, offset: at(HOLD_TOP + SCROLL_DOWN + HOLD_BOTTOM), easing: 'ease-out' },
    { transform: 'none', offset: 1 },
  ]
}

export function initWebsiteLoop() {
  const card = document.querySelector('.somethings-web-card')
  if (!card) return
  const tilts = Array.from({ length: SLOTS }, () => +(Math.random() * 2 * TILT - TILT).toFixed(1))
  const tracks = [
    [card.querySelector('.website-scroll'), scrollFrames(), SCROLL_CYCLE],
    ...MOODS.map((mood, index) => [card.querySelector(`.website-mood-${mood}`), moodFrames(index, tilts), MOOD_CYCLE]),
  ]
  loopWhileVisible(card, MOOD_CYCLE, tracks)
  playWhileVisible(card, card.querySelector('.website-mentor-video'))
}
