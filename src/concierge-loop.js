// The Titan Concierge card. On the left phone a finger swipes the front perk card off to the
// left, the stack steps forward, and the pagination pill slides to the next dot. On the right
// phone a text from the concierge drops in and lifts away, on its own loop. With reduced motion,
// the CSS shows the stack as it rests and the text in place.

import { loopWhileVisible } from './screen-loop.js'

// Each step, in ms.
const HOLD = 1600
const CURSOR_IN = 150
const PRESS = 120
const DRAG = 300
const FLICK = 450 // the card off the edge, and the stack stepping forward
const FADE_IN = 300 // the swiped card coming back in at the back
const CURSOR_OUT = 150
const STEP = HOLD + PRESS + DRAG + FLICK
const CARDS = 3
const CYCLE = STEP * CARDS

const NOTIF_IN = 500
const NOTIF_HOLD = 3000
const NOTIF_OUT = 400
const NOTIF_WAIT = 2500
const NOTIF_CYCLE = NOTIF_IN + NOTIF_HOLD + NOTIF_OUT + NOTIF_WAIT

const EASE_STACK = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

// Card states, from the front card's box, in the screen's 1x points (ems here).
const SLOTS = [
  { transform: 'none', zIndex: 3 },
  { transform: 'translate(26em, -0.57em) scale(0.91925)', zIndex: 2 },
  { transform: 'translate(47.5em, 0em) scale(0.84783)', zIndex: 1 },
]
const DRAGGED = 'translate(-120em, 0em) rotate(-4deg)'
const GONE = 'translate(-444em, 0em) rotate(-10deg)' // its left edge at x = -420
const FINGER = {
  from: { x: 250, y: 380 },
  to: { x: 130, y: 380 },
  pressed: 0.85,
  color: 'rgba(255, 255, 255, 0.7)',
  pressedColor: 'rgba(225, 225, 225, 0.8)',
}
const DOT = { active: { width: '12em', backgroundColor: '#f8f8f8' }, inactive: { width: '3em', backgroundColor: '#606165' } }
const NOTIF_HIDDEN = { transform: 'translateY(-130em)', opacity: 0 } // at y = -70
const NOTIF_SHOWN = { transform: 'none', opacity: 1 }

// Keyframes from [time, state, easing] stops, which must start at 0 and end at the cycle's end.
function frames(stops, cycle = CYCLE) {
  return stops.map(([time, state, easing]) => ({ ...state, offset: time / cycle, ...(easing && { easing }) }))
}

function cardFrames(card) {
  const stops = []
  for (let step = 0; step < CARDS; step++) {
    const start = STEP * step
    const pressed = start + HOLD
    const dragged = pressed + PRESS + DRAG
    const end = start + STEP
    const slot = (card - step + CARDS) % CARDS
    const opaque = { opacity: 1 }
    if (slot === 0) {
      stops.push(
        [start, { ...SLOTS[0], ...opaque }],
        [pressed + PRESS, { ...SLOTS[0], ...opaque }, 'ease-out'],
        [dragged, { transform: DRAGGED, zIndex: 3, ...opaque }, 'ease-in'],
        [end, { transform: GONE, zIndex: 3, ...opaque }],
      )
    } else if (slot === 1) {
      stops.push(
        [start, { ...SLOTS[1], ...opaque }],
        [dragged, { ...SLOTS[1], ...opaque }, EASE_STACK],
        [end, { ...SLOTS[0], ...opaque }],
      )
    } else {
      // Just swiped away, so it comes back in at the back.
      stops.push(
        [start, { ...SLOTS[2], opacity: 0 }, 'ease-out'],
        [start + FADE_IN, { ...SLOTS[2], ...opaque }],
        [dragged, { ...SLOTS[2], ...opaque }, EASE_STACK],
        [end, { ...SLOTS[1], ...opaque }],
      )
    }
  }
  return frames(stops)
}

function fingerFrames() {
  const { from, to } = FINGER
  const state = ({ x, y }, { pressed = false, hidden = false } = {}) => ({
    transform: `translate(${x}em, ${y}em) scale(${pressed ? FINGER.pressed : 1})`,
    backgroundColor: pressed ? FINGER.pressedColor : FINGER.color,
    opacity: hidden ? 0 : 1,
  })
  const stops = [[0, state(from, { hidden: true })]]
  for (let step = 0; step < CARDS; step++) {
    const pressed = STEP * step + HOLD
    const released = pressed + PRESS + DRAG
    stops.push(
      [pressed - CURSOR_IN - 120, state(from, { hidden: true }), 'ease-out'],
      [pressed - 120, state(from)],
      [pressed, state(from), 'ease-out'],
      [pressed + PRESS, state(from, { pressed: true }), 'ease-in-out'],
      [released, state(to, { pressed: true }), 'ease-out'],
      [released + CURSOR_OUT, state(to, { hidden: true })],
    )
  }
  stops.push([CYCLE, state(from, { hidden: true })])
  return frames(stops)
}

// The pill moves to the next dot as the stack steps forward. The fourth dot is never active.
function dotFrames(dot) {
  const stops = [[0, dot === 0 ? DOT.active : DOT.inactive]]
  const moves = (step) => STEP * step + HOLD + PRESS + DRAG
  for (let step = 0; step < CARDS; step++) {
    const from = step
    const to = (step + 1) % CARDS
    if (dot !== from && dot !== to) continue
    const [before, after] = dot === from ? [DOT.active, DOT.inactive] : [DOT.inactive, DOT.active]
    stops.push([moves(step), before, EASE_STACK], [moves(step) + FLICK, after])
  }
  stops.push([CYCLE, dot === 0 ? DOT.active : DOT.inactive])
  return frames(stops)
}

function notifFrames() {
  return frames(
    [
      [0, NOTIF_HIDDEN, EASE_STACK],
      [NOTIF_IN, NOTIF_SHOWN],
      [NOTIF_IN + NOTIF_HOLD, NOTIF_SHOWN, 'ease-in'],
      [NOTIF_IN + NOTIF_HOLD + NOTIF_OUT, NOTIF_HIDDEN],
      [NOTIF_CYCLE, NOTIF_HIDDEN],
    ],
    NOTIF_CYCLE,
  )
}

export function initConciergeLoop() {
  const card = document.querySelector('.concierge-card')
  if (!card) return
  const perks = [1, 2, 3].map((n) => card.querySelector(`.concierge-perk-${n}`))
  const dots = [...card.querySelectorAll('.concierge-dot')].slice(0, CARDS)
  const tracks = [
    ...perks.map((perk, index) => [perk, cardFrames(index)]),
    ...dots.map((dot, index) => [dot, dotFrames(index)]),
    [card.querySelector('.concierge-cursor'), fingerFrames()],
    [card.querySelector('.concierge-notif'), notifFrames(), NOTIF_CYCLE],
  ]
  // The loop opens with the last card fading back in, so it starts just after that.
  loopWhileVisible(card, CYCLE, tracks, FADE_IN)
}
