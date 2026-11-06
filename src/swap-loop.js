// Somethings Photo Swaps. A scribble covers the two stacked photos. A finger taps Reveal, the
// photos lift a touch, then the scribble bursts away as they fan out and a second scribble blooms
// behind them, and the button becomes New Swap. Then it settles back and repeats. With reduced
// motion, the CSS holds on the reveal.

import { loopWhileVisible } from './screen-loop.js'

// Each step, in ms.
const HOLD = 1400
const GLIDE = 600
const PRESS = 120
const RELEASE = 120
const LIFT = 200 // the anticipation before the reveal
const REVEAL = 550
const BUTTON_FADE = 200
const CURSOR_OUT = 200
const HOLD_REVEALED = 2500
const RESET = 500
const COVER_OUT = 350
const BACKDROP_DELAY = 150 // after the cover starts to go
const BACKDROP_IN = 450
const COVER_BACK = 400

const press = HOLD
const released = press + PRESS
const reveal = released + LIFT
const revealed = reveal + REVEAL
const reset = revealed + HOLD_REVEALED
const CYCLE = reset + RESET
const at = (ms) => ms / CYCLE

const EASE_REVEAL = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const LIFTED = 1.05
const BUTTON_PRESSED = 0.95

// Moves from each card's stacked center, in the screen's points.
const CARDS = {
  a: { stacked: { x: 0, y: 0, rotate: 10 }, fanned: { x: -69, y: 19, rotate: 16 } },
  b: { stacked: { x: 0, y: 0, rotate: -2 }, fanned: { x: 58, y: 26, rotate: -16 } },
}
const TAP = { x: 197, y: 668 }
const FINGER = {
  from: { x: 240, y: 900 }, // off the bottom of the screen
  away: { x: 205, y: 700 },
  pressed: 0.85,
  color: 'rgba(255, 255, 255, 0.7)',
  pressedColor: 'rgba(225, 225, 225, 0.8)',
}

const toFrames = (stops) => stops.map(([time, state, easing]) => ({ ...state, offset: at(time), ...(easing && { easing }) }))

function cardFrames({ stacked, fanned }) {
  const place = ({ x, y, rotate }, scale = 1) => ({ transform: `translate(${x}em, ${y}em) rotate(${rotate}deg) scale(${scale})` })
  return toFrames([
    [0, place(stacked)],
    [released, place(stacked), 'ease-out'],
    [reveal, place(stacked, LIFTED), EASE_REVEAL],
    [revealed, place(fanned)],
    [reset, place(fanned), 'ease-in-out'],
    [CYCLE, place(stacked)],
  ])
}

// The cover bursts away as the photos fan out, and fades back on top as they restack.
function coverFrames() {
  const shown = { opacity: 1, transform: 'none' }
  const burst = { opacity: 0, transform: 'scale(1.5) rotate(18deg)' }
  return toFrames([
    [0, shown],
    [reveal, shown, 'ease-out'],
    [reveal + COVER_OUT, burst],
    [CYCLE - COVER_BACK, { ...burst, transform: 'none' }, 'ease-in-out'],
    [CYCLE, shown],
  ])
}

// The backdrop blooms behind the photos a beat after the cover leaves.
function backdropFrames() {
  const hidden = { opacity: 0, transform: 'scale(0.85)' }
  const shown = { opacity: 1, transform: 'none' }
  const start = reveal + BACKDROP_DELAY
  return toFrames([
    [0, hidden],
    [start, hidden, 'ease-out'],
    [start + BACKDROP_IN, shown],
    [reset, shown, 'ease-in-out'],
    [CYCLE, { ...shown, opacity: 0 }],
  ])
}

function buttonFrames(isReveal) {
  const shown = isReveal ? 1 : 0
  return toFrames([
    [0, { opacity: shown, transform: 'none' }],
    ...(isReveal
      ? [
          [press, { opacity: 1, transform: 'none' }, 'ease-out'],
          [released, { opacity: 1, transform: `scale(${BUTTON_PRESSED})` }, 'ease-out'],
          [reveal, { opacity: 1, transform: 'none' }, 'ease-in-out'],
        ]
      : [[reveal, { opacity: 0, transform: 'none' }, 'ease-in-out']]),
    [reveal + BUTTON_FADE, { opacity: 1 - shown, transform: 'none' }],
    [reset, { opacity: 1 - shown, transform: 'none' }, 'ease-in-out'],
    [CYCLE, { opacity: shown, transform: 'none' }],
  ])
}

function fingerFrames() {
  const state = ({ x, y }, { pressed = false, hidden = false } = {}) => ({
    transform: `translate(${x}em, ${y}em) scale(${pressed ? FINGER.pressed : 1})`,
    backgroundColor: pressed ? FINGER.pressedColor : FINGER.color,
    opacity: hidden ? 0 : 1,
  })
  return toFrames([
    [0, state(FINGER.from)],
    [press - GLIDE, state(FINGER.from), 'ease-in-out'],
    [press, state(TAP), 'ease-out'],
    [released, state(TAP, { pressed: true }), 'ease-out'],
    [released + RELEASE, state(TAP), 'ease-in-out'],
    [released + RELEASE + CURSOR_OUT, state(FINGER.away, { hidden: true })],
    [CYCLE, state(FINGER.from, { hidden: true })],
  ])
}

export function initSwapLoop() {
  const card = document.querySelector('.swap-card-showcase')
  if (!card) return
  const screen = card.querySelector('.swap-screen')
  const q = (selector) => screen.querySelector(selector)
  const tracks = [
    [q('.swap-card-a'), cardFrames(CARDS.a)],
    [q('.swap-card-b'), cardFrames(CARDS.b)],
    [q('.swap-cover'), coverFrames()],
    [q('.swap-backdrop'), backdropFrames()],
    [q('.swap-btn-reveal'), buttonFrames(true)],
    [q('.swap-btn-new'), buttonFrames(false)],
    [q('.swap-cursor'), fingerFrames()],
  ]
  loopWhileVisible(screen, CYCLE, tracks)
}
