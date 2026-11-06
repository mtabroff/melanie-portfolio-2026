// The Somethings phone screen. A finger taps the chat's arrow, which pushes in the hub feed.
// It drags the feed up and lets it scroll back, then taps the photo stack, which opens that
// photo moment, growing out of the stack. Then it crossfades back to the chat. With reduced
// motion, the CSS holds on the hub feed.

import { loopWhileVisible } from './screen-loop.js'

// Each step, in ms.
const HOLD_CHAT = 2000
const PRESS = 150
const RELEASE = 150
const GLIDE = 600 // the finger moving to its next spot
const PUSH = 450
const HOLD_FEED = 1000
const SCROLL_DOWN = 1800
const HOLD_SCROLLED = 800
const SCROLL_UP = 600
const EXPAND = 500
const HOLD_MOMENT = 3000
const CROSSFADE = 400
const PHOTO_FADE = 80

// Positions are in the screen's 1x points, which are ems here.
const SCREEN = { width: 393, height: 852 }
const SCROLL = 420
const PUSH_BACK = '-30%' // how far the chat moves left under the feed, as in a push navigation
const STACK = { x: 294, y: 371, width: 146, height: 200, radius: 16 } // the top photo, where the moment starts
// The card shows only the top 476 points of the screen, so the finger stays above that.
const FINGER = {
  start: { x: 220, y: 420 },
  arrow: { x: 357, y: 96 },
  swipe: { x: 200, y: 430 },
  stack: { x: 294, y: 400 },
  drag: 60, // how far it moves up as the feed scrolls
  pressed: 0.85,
  lifted: 0.4, // its opacity while the feed scrolls back on its own
  color: 'rgba(255, 255, 255, 0.7)',
  pressedColor: 'rgba(225, 225, 225, 0.8)',
}

const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)'
const EASE_EXPAND = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

// Each screen change starts as the finger releases.
const chatPress = HOLD_CHAT
const pushStart = chatPress + PRESS
const pushed = pushStart + PUSH
const scrollStart = pushed + HOLD_FEED
const scrolled = scrollStart + SCROLL_DOWN
const scrollBack = scrolled + HOLD_SCROLLED
const atTop = scrollBack + SCROLL_UP
const stackPress = atTop + GLIDE
const expandStart = stackPress + PRESS
const expanded = expandStart + EXPAND
const fadeStart = expanded + HOLD_MOMENT
const CYCLE = fadeStart + CROSSFADE
const at = (ms) => ms / CYCLE

// The whole moment screen, scaled down to the stack's width and clipped to its height.
function stackShape() {
  const scale = STACK.width / SCREEN.width
  const x = STACK.x - SCREEN.width / 2
  const y = STACK.y - SCREEN.height / 2
  const inset = (SCREEN.height - STACK.height / scale) / 2
  return {
    transform: `translate(${x}em, ${y}em) scale(${scale})`,
    clipPath: `inset(${inset}em 0 round ${STACK.radius / scale}em)`,
  }
}

// Each stop holds until the next, easing into it the way the stop says.
function fingerFrames() {
  const { start, arrow, swipe, stack } = FINGER
  const dragged = { x: swipe.x, y: swipe.y - FINGER.drag }
  const stops = [
    [0, start],
    [chatPress - GLIDE, start, 'ease-in-out'],
    [chatPress, arrow, 'ease-out'],
    [chatPress + PRESS, arrow, 'ease-out', { pressed: true }],
    [chatPress + PRESS + RELEASE, arrow],
    [scrollStart - GLIDE, arrow, 'ease-in-out'],
    [scrollStart, swipe, 'ease-in-out'],
    [scrolled, dragged],
    [scrollBack, dragged, EASE_OUT],
    [atTop, dragged, 'ease-in-out', { lifted: true }],
    [stackPress, stack, 'ease-out'],
    [stackPress + PRESS, stack, 'ease-out', { pressed: true }],
    [stackPress + PRESS + RELEASE, stack],
    [fadeStart - GLIDE, stack, 'ease-in-out'],
    [fadeStart, start],
    [CYCLE, start],
  ]
  return stops.map(([time, { x, y }, easing, { pressed, lifted } = {}]) => ({
    offset: at(time),
    transform: `translate(${x}em, ${y}em) scale(${pressed ? FINGER.pressed : 1})`,
    backgroundColor: pressed ? FINGER.pressedColor : FINGER.color,
    opacity: lifted ? FINGER.lifted : 1,
    ...(easing && { easing }),
  }))
}

function timeline({ chat, feed, scroll, moment, momentPhoto, finger }) {
  const offscreen = 'translateX(100%)'
  const small = stackShape()
  const full = { transform: 'none', clipPath: 'inset(0em 0 round 0em)' }
  return [
    [
      chat,
      // Back in place as soon as the feed covers it, ready for the crossfade.
      [
        { transform: 'none', offset: 0 },
        { transform: 'none', offset: at(pushStart), easing: EASE_OUT },
        { transform: `translateX(${PUSH_BACK})`, offset: at(pushed) },
        { transform: 'none', offset: at(pushed) },
        { transform: 'none', offset: 1 },
      ],
    ],
    [
      feed,
      // Out of the way once the moment covers it, so the crossfade lands on the chat.
      [
        { transform: offscreen, offset: 0 },
        { transform: offscreen, offset: at(pushStart), easing: EASE_OUT },
        { transform: 'none', offset: at(pushed) },
        { transform: 'none', offset: at(expanded) },
        { transform: offscreen, offset: at(expanded) },
        { transform: offscreen, offset: 1 },
      ],
    ],
    [
      scroll,
      [
        { transform: 'none', offset: 0 },
        { transform: 'none', offset: at(scrollStart), easing: 'ease-in-out' },
        { transform: `translateY(-${SCROLL}em)`, offset: at(scrolled) },
        { transform: `translateY(-${SCROLL}em)`, offset: at(scrollBack), easing: EASE_OUT },
        { transform: 'none', offset: at(atTop) },
        { transform: 'none', offset: 1 },
      ],
    ],
    [
      moment,
      [
        { ...small, opacity: 0, offset: 0 },
        { ...small, opacity: 0, offset: at(expandStart) },
        { ...small, opacity: 1, offset: at(expandStart), easing: EASE_EXPAND },
        { ...full, opacity: 1, offset: at(expanded) },
        { ...full, opacity: 1, offset: at(fadeStart), easing: 'ease-in-out' },
        { ...full, opacity: 0, offset: 1 },
      ],
    ],
    // The photo shows over the first moments of the growth, so it doesn't pop over the stack.
    [
      momentPhoto,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: at(expandStart) },
        { opacity: 1, offset: at(expandStart + PHOTO_FADE) },
        { opacity: 1, offset: 1 },
      ],
    ],
    [finger, fingerFrames()],
  ]
}

export function initHubLoop() {
  const screen = document.querySelector('.hub-loop')
  if (!screen) return
  const layers = {
    chat: screen.querySelector('.hub-chat'),
    feed: screen.querySelector('.hub-feed'),
    scroll: screen.querySelector('.hub-feed-scroll'),
    moment: screen.querySelector('.hub-moment'),
    momentPhoto: screen.querySelector('.hub-moment-photo'),
    finger: screen.querySelector('.hub-cursor'),
  }
  loopWhileVisible(screen, CYCLE, timeline(layers))
}
