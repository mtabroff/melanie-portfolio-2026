// The Allara card: a calm run through the portal's getting-started checklist. A finger taps the
// first Mark Done, then the second, each with a soft ripple, and the box checks as the screen
// crossfades. Just after the last box checks, the step's stepper dot fills in with a check, with
// a small pop and one quiet ring, and the finished step holds a moment. Then the checklist moves
// like an accordion: the step closes into its checked row as the steps below slide up to follow,
// and after a beat the next step opens, the last two sliding back down to make room. The motion
// is built from strips of the before and after screens, in the checklist column only. With
// reduced motion, the CSS holds on the next step, already open, its check filled.

import { loopWhileVisible } from './screen-loop.js'

// Each step, in ms.
const HOLD_START = 1500
const GLIDE_IN = 600
const GLIDE_DOWN = 400
const PRESS = 120
const RELEASE = 120
const RIPPLE = 450
const TAP_FADE = 300 // the screen after each tap
const HOLD_TASK1 = 600
const FILL_DELAY = 200 // after the last box checks
const POP = 350 // the check filling in, with its pop
const POP_PEAK = 140 // when the pop is at its largest
const PULSE = 600
const HOLD_COMPLETE = 800 // the finished step, before it closes
const COLLAPSE = 350
const PAUSE = 120
const EXPAND = 450
const DRIFT = 600 // the finger moving off as the next step opens
const HOLD_NEXT = 2500
const BACK_FADE = 500

// In the 525 wide export's points, which are ems here.
const SPOTS = {
  below: { x: 430, y: 400 }, // off the bottom of the frame
  first: { x: 334, y: 178 },
  second: { x: 334, y: 208 },
  away: { x: 380, y: 270 },
}
const RIPPLE_OPACITY = 0.12
const RING_FROM = 0.4 // its opacity as it starts
const RING_TO = 1.8
const POP_SCALE = 1.15
// Step 2's stepper dot: where the before screen has it empty, and the after screen filled.
const DOT = { x: 109.5, empty: 123, filled: 117.33, radius: 3.6 }
const FINGER = {
  pressed: 0.85,
  color: 'rgba(255, 255, 255, 0.7)',
  pressedColor: 'rgba(225, 225, 225, 0.8)',
}

const EASE_COLLAPSE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const EASE_EXPAND = 'cubic-bezier(0.22, 1, 0.36, 1)'

// The checklist's strips, measured from the two screens: each runs from the middle of the gap
// above a step's card to the middle of the gap below it. Step 1 doesn't change, so it's left out,
// and steps 4 and 5 are the same in both, so they're one strip. y and height in export points.
const SCREEN = { width: 525, height: 358.33 }
const COLUMN = { x: 100, width: 273 } // from the sidebar's edge to the right panel's
const STRIPS = {
  step2Header: { from: 'before', y: 101.17, height: 33.33 }, // as tall as its closed row
  step2Content: { from: 'before', y: 134.5, height: 99.17 },
  step3Row: { from: 'before', y: 233.67, height: 33.17 },
  lastSteps: { from: 'before', y: 266.83, height: 91.5 },
  step2Row: { from: 'after', y: 101.17, height: 33.33 },
  step3Header: { from: 'after', y: 134.5, height: 33.17 }, // as tall as its closed row
  step3Content: { from: 'after', y: 167.67, height: 99.17 },
}
const SHIFT = 99.17 // how far the steps below move as step 2 closes, and again as step 3 opens

const firstPress = HOLD_START
const task1 = firstPress + PRESS // each tap changes the screen as the finger releases
const task1Shown = task1 + TAP_FADE
const secondPress = task1Shown + HOLD_TASK1
const task2 = secondPress + PRESS
const task2Shown = task2 + TAP_FADE
const fill = task2Shown + FILL_DELAY
const next = fill + POP + HOLD_COMPLETE
const collapsed = next + COLLAPSE
const expand = collapsed + PAUSE
const nextShown = expand + EXPAND
const back = nextShown + HOLD_NEXT
const CYCLE = back + BACK_FADE
const at = (ms) => ms / CYCLE

const toFrames = (stops) => stops.map(([time, state, easing]) => ({ ...state, offset: at(time), ...(easing && { easing }) }))

// A screen fades in over the one before, and drops out once the next one covers it.
function screenFrames(fadeIn, shown, gone) {
  return toFrames([
    [0, { opacity: 0 }],
    [fadeIn, { opacity: 0 }, 'ease-in-out'],
    [shown, { opacity: 1 }],
    [gone, { opacity: 1 }],
    [gone, { opacity: 0 }],
    [CYCLE, { opacity: 0 }],
  ])
}

// The next screen takes over from the strips once they've all landed.
function nextFrames() {
  return toFrames([
    [0, { opacity: 0 }],
    [nextShown, { opacity: 0 }],
    [nextShown, { opacity: 1 }],
    [back, { opacity: 1 }, 'ease-in-out'],
    [CYCLE, { opacity: 0 }],
  ])
}

// Each strip holds its first state until its move starts, and its last state after.
function hold(start, end, from, to, easing) {
  return toFrames([
    [0, from],
    [start, from, easing],
    [end, to],
    [CYCLE, to],
  ])
}

// A strip is the whole screen, clipped to its slice, so it draws exactly where the screen does.
function slice({ y, height }) {
  const right = SCREEN.width - COLUMN.x - COLUMN.width
  return { clipPath: `inset(${y}em ${right}em ${SCREEN.height - y - height}em ${COLUMN.x}em)` }
}
const open = (strip) => slice(strip)
const shut = (strip) => slice({ y: strip.y, height: 0 }) // closed up to its top edge
const up = { transform: `translateY(-${SHIFT}em)` }
const down = { transform: 'translateY(0em)' }

function accordionTracks(strips, accordion) {
  return [
    // Only there for the move, over a white column so the old screen doesn't show through.
    [
      accordion,
      toFrames([
        [0, { visibility: 'hidden' }],
        [next, { visibility: 'hidden' }],
        [next, { visibility: 'visible' }],
        [nextShown, { visibility: 'visible' }],
        [nextShown, { visibility: 'hidden' }],
        [CYCLE, { visibility: 'hidden' }],
      ]),
    ],
    // 1. Step 2's content clips shut, fading as it goes, under its checked row fading in. The
    // steps below slide up with its bottom edge.
    [
      strips.step2Content,
      hold(next, collapsed, { ...open(STRIPS.step2Content), opacity: 1 }, { ...shut(STRIPS.step2Content), opacity: 0 }, EASE_COLLAPSE),
    ],
    [strips.step2Row, hold(next, collapsed, { opacity: 0 }, { opacity: 1 }, EASE_COLLAPSE)],
    [strips.step3Row, hold(next, collapsed, down, up, EASE_COLLAPSE)],
    // 3. Step 3 opens from its row: its header fades in over the row, and its content reveals
    // top to bottom, fading in, as the last two steps slide back down with its bottom edge.
    [strips.step3Header, hold(expand, nextShown, { opacity: 0 }, { opacity: 1 }, EASE_EXPAND)],
    [
      strips.step3Content,
      hold(expand, nextShown, { ...shut(STRIPS.step3Content), opacity: 0 }, { ...open(STRIPS.step3Content), opacity: 1 }, EASE_EXPAND),
    ],
    [
      strips.lastSteps,
      toFrames([
        [0, down],
        [next, down, EASE_COLLAPSE],
        [collapsed, up],
        [expand, up, EASE_EXPAND],
        [nextShown, down],
        [CYCLE, down],
      ]),
    ],
  ]
}

// The strips, each a slice of the before or after screen.
function buildAccordion(page, screens) {
  const accordion = document.createElement('div')
  accordion.className = 'allara-accordion'
  const white = document.createElement('div')
  white.className = 'allara-white'
  accordion.append(white)
  const strips = {}
  // Later strips stack on top: the after rows over the before ones they replace.
  for (const [name, strip] of Object.entries(STRIPS)) {
    const element = document.createElement('div')
    element.className = 'allara-strip'
    element.style.clipPath = slice(strip).clipPath
    accordion.append(element)
    strips[name] = element
    // The empty dot goes under the check, so it can't show as the check rides up.
    if (name === 'step2Header') {
      const cover = document.createElement('div')
      cover.className = 'allara-dot-cover'
      Object.assign(cover.style, {
        left: `${DOT.x - DOT.radius}em`,
        top: `${DOT.empty - DOT.radius}em`,
        width: `${DOT.radius * 2}em`,
        height: `${DOT.radius * 2}em`,
      })
      accordion.append(cover)
    }
  }
  // The check, over the strips: the after screen, clipped to its filled dot.
  const check = document.createElement('div')
  check.className = 'allara-strip allara-check'
  Object.assign(check.style, {
    clipPath: `circle(${DOT.radius}em at ${DOT.x}em ${DOT.filled}em)`,
    transformOrigin: `${DOT.x}em ${DOT.filled}em`,
  })
  page.querySelector('.allara-ring').before(accordion, check)

  // Filled once the screens have loaded, with whichever file each one picked. (Added later, so
  // the loop doesn't wait on images that have no file yet.)
  const images = Object.values(screens)
  Promise.all(images.map((image) => image.decode())).then(
    () => {
      const fillWith = (element, from) => {
        const image = document.createElement('img')
        image.className = 'allara-state'
        image.alt = ''
        image.src = screens[from].currentSrc
        element.append(image)
      }
      for (const [name, element] of Object.entries(strips)) fillWith(element, STRIPS[name].from)
      fillWith(check, 'after')
    },
    () => {},
  )
  return [...accordionTracks(strips, accordion), [check, checkFrames()]]
}

function rippleFrames() {
  const spot = ({ x, y }, scale, opacity) => ({ transform: `translate(${x}em, ${y}em) scale(${scale})`, opacity })
  const { first, second } = SPOTS
  return toFrames([
    [0, spot(first, 0, 0)],
    [firstPress, spot(first, 0, RIPPLE_OPACITY), 'ease-out'],
    [firstPress + RIPPLE, spot(first, 1, 0)],
    [firstPress + RIPPLE, spot(second, 0, 0)],
    [secondPress, spot(second, 0, RIPPLE_OPACITY), 'ease-out'],
    [secondPress + RIPPLE, spot(second, 1, 0)],
    [CYCLE, spot(second, 1, 0)],
  ])
}

// One quiet ring out from the check as it fills. It isn't rendered at any other time.
function ringFrames() {
  const off = { opacity: 0, transform: 'none', visibility: 'hidden' }
  return toFrames([
    [0, off],
    [fill, off],
    [fill, { opacity: RING_FROM, transform: 'none', visibility: 'visible' }, 'ease-out'],
    [fill + PULSE, { opacity: 0, transform: `scale(${RING_TO})`, visibility: 'visible' }],
    [fill + PULSE, off],
    [CYCLE, off],
  ])
}

// The filled check, fading and popping in over the empty dot, then riding up with the row as
// the step closes, to where the next screen has it.
function checkFrames() {
  const lowered = DOT.empty - DOT.filled
  const check = (y, scale, opacity, visibility = 'visible') => ({
    transform: `translateY(${y}em) scale(${scale})`,
    opacity,
    visibility,
  })
  return toFrames([
    [0, check(lowered, 1, 0, 'hidden')],
    [fill, check(lowered, 1, 0, 'hidden')],
    [fill, check(lowered, 1, 0), 'ease-out'],
    [fill + POP_PEAK, check(lowered, POP_SCALE, 0.8), 'ease-in-out'],
    [fill + POP, check(lowered, 1, 1)],
    [next, check(lowered, 1, 1), EASE_COLLAPSE],
    [collapsed, check(0, 1, 1)],
    [nextShown, check(0, 1, 1)],
    [nextShown, check(0, 1, 1, 'hidden')], // the next screen has it from here
    [CYCLE, check(0, 1, 1, 'hidden')],
  ])
}

function fingerFrames() {
  const { below, first, second, away } = SPOTS
  const state = ({ x, y }, { pressed = false, hidden = false } = {}) => ({
    transform: `translate(${x}em, ${y}em) scale(${pressed ? FINGER.pressed : 1})`,
    backgroundColor: pressed ? FINGER.pressedColor : FINGER.color,
    opacity: hidden ? 0 : 1,
  })
  return toFrames([
    [0, state(below)],
    [firstPress - GLIDE_IN, state(below), 'ease-in-out'],
    [firstPress, state(first), 'ease-out'],
    [firstPress + PRESS, state(first, { pressed: true }), 'ease-out'],
    [firstPress + PRESS + RELEASE, state(first)],
    [secondPress - GLIDE_DOWN, state(first), 'ease-in-out'],
    [secondPress, state(second), 'ease-out'],
    [secondPress + PRESS, state(second, { pressed: true }), 'ease-out'],
    [secondPress + PRESS + RELEASE, state(second)],
    [next, state(second), 'ease-in-out'],
    [next + DRIFT, state(away, { hidden: true })],
    [CYCLE, state(below, { hidden: true })],
  ])
}

export function initAllaraLoop() {
  const card = document.querySelector('.allara-card')
  if (!card) return
  const page = card.querySelector('.allara-page')
  const layer = (name) => page.querySelector(`.allara-${name}`)
  const tracks = [
    [layer('task1'), screenFrames(task1, task1Shown, task2Shown)],
    [layer('task2'), screenFrames(task2, task2Shown, nextShown)],
    [layer('next'), nextFrames()],
    ...buildAccordion(page, { before: layer('task2'), after: layer('next') }),
    [layer('ripple'), rippleFrames()],
    [layer('ring'), ringFrames()],
    [layer('cursor'), fingerFrames()],
  ]
  loopWhileVisible(page, CYCLE, tracks)
}
