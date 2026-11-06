// The Titan trio, played as a relay. On the left phone a finger taps the Titan icon, the splash
// grows out of it like an app opening, and the portfolio loads in with its ring winding up. Then on the center phone it
// taps the team's avatars, the team panel fans out of the pill with the avatars flying into
// the list, and it taps the panel's X to close it. The right phone stays on the advisor
// profile, where Jack's intro video plays. With reduced motion, the CSS shows the splash, the
// team, and the advisor as stills.

import { loopWhileVisible, playWhileVisible } from './screen-loop.js'

// Each step, in ms.
const GLIDE = 600 // the finger moving to its next spot
const PRESS = 120
const RELEASE = 120
const FINGER_FADE = 200

const HOLD_HOME = 1000
const OPEN = 600
const HOLD_SPLASH = 1400
const LOAD = 900 // the portfolio rising in
const HOLD_APP = 2000
const CROSSFADE = 400
const PHOTO_FADE = 80

const HOLD_TEAM = 1000
const FAN = 400 // the dim and the panel
const AVATAR_FLIGHT = 450
const STAGGER = 40 // between avatars
const NAME_DELAY = 60 // after its avatar lands
const NAME_FADE = 150
const PANEL_FADE = 120 // the panel softens in, rather than covering the pill at once
const HOLD_PANEL = 1800
const CLOSE = 300
const PAUSE = 800

// Positions are in the screen's 1x points, which are ems here.
const SCREEN = { width: 393, height: 852, radius: 60.8 }
const ICON = { x: 34, y: 87, size: 59, radius: 14 }
const LOAD_RISE = 24
const RING_FROM = { rotate: 70, scale: 0.8, opacity: 0.3 } // it unwinds counter-clockwise into place
const PILL = { top: 66, left: 244, width: 129, height: 44, radius: 22 } // where the panel starts
const PANEL = { top: 64, left: 16, width: 361, height: 292, radius: 16 }
const PILL_DIP = 0.96
// Top-left corners in the pill, then in the list, where the avatars grow from 32 to 48.
const AVATARS = [
  { name: 'gaia', from: { x: 250, y: 72 }, to: { x: 36, y: 84 } },
  { name: 'sofia', from: { x: 270, y: 72 }, to: { x: 36, y: 152 } },
  { name: 'john', from: { x: 290, y: 72 }, to: { x: 36, y: 220 } },
  { name: 'amanda', from: { x: 310, y: 72 }, to: { x: 36, y: 288 } },
]
const AVATAR_FROM = 32 / 48
const SPOTS = {
  leftBelow: { x: 120, y: 900 }, // off the bottom of the screen
  icon: { x: 63, y: 116 },
  centerBelow: { x: 300, y: 900 },
  pill: { x: 308, y: 88 },
  rest: { x: 230, y: 410 }, // under the list while the panel is open
  close: { x: 347, y: 89 },
}
const FINGER = {
  pressed: 0.85,
  color: 'rgba(255, 255, 255, 0.7)',
  pressedColor: 'rgba(225, 225, 225, 0.8)',
}

const EASE_OPEN = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const EASE_LOAD = 'cubic-bezier(0.16, 1, 0.3, 1)'
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

// Each screen change starts as the finger releases.
const homePress = HOLD_HOME
const openStart = homePress + PRESS
const opened = openStart + OPEN
const loadStart = opened + HOLD_SPLASH
const loaded = loadStart + LOAD
const appFade = loaded + HOLD_APP
const leftDone = appFade + CROSSFADE

const teamPress = leftDone + HOLD_TEAM
const fanStart = teamPress + PRESS
const fanOpen = fanStart + FAN
const avatarOut = (index) => fanStart + STAGGER * index
const avatarIn = (index) => avatarOut(index) + AVATAR_FLIGHT
const fanLanded = avatarIn(AVATARS.length - 1)
const fanClose = fanLanded + HOLD_PANEL // as the finger releases the X
const closePress = fanClose - PRESS
const centerDone = fanClose + CLOSE
const CYCLE = centerDone + PAUSE
const at = (ms) => ms / CYCLE

// The splash screen, scaled down to the icon and clipped to its rounded square.
function iconShape() {
  const scale = ICON.size / SCREEN.width
  const x = ICON.x + ICON.size / 2 - SCREEN.width / 2
  const y = ICON.y + ICON.size / 2 - SCREEN.height / 2
  const inset = (SCREEN.height - ICON.size / scale) / 2
  return {
    transform: `translate(${x}em, ${y}em) scale(${scale})`,
    clipPath: `inset(${inset}em 0 round ${ICON.radius / scale}em)`,
  }
}

function inset({ top, left, width, height, radius }) {
  const right = SCREEN.width - left - width
  const bottom = SCREEN.height - top - height
  return `inset(${top}em ${right}em ${bottom}em ${left}em round ${radius}em)`
}

// Each stop holds until the next, easing into it the way the stop says.
function fingerFrames(stops) {
  return stops.map(([time, { x, y }, easing, { pressed, hidden } = {}]) => ({
    offset: at(time),
    transform: `translate(${x}em, ${y}em) scale(${pressed ? FINGER.pressed : 1})`,
    backgroundColor: pressed ? FINGER.pressedColor : FINGER.color,
    opacity: hidden ? 0 : 1,
    ...(easing && { easing }),
  }))
}

function leftFingerFrames() {
  const { leftBelow, icon } = SPOTS
  return fingerFrames([
    [0, leftBelow],
    [homePress - GLIDE, leftBelow, 'ease-in-out'],
    [homePress, icon, 'ease-out'],
    [homePress + PRESS, icon, 'ease-out', { pressed: true }],
    [openStart + RELEASE, icon, 'ease-out'],
    [openStart + RELEASE + FINGER_FADE, icon, undefined, { hidden: true }],
    [CYCLE, leftBelow, undefined, { hidden: true }],
  ])
}

function centerFingerFrames() {
  const { centerBelow, pill, rest, close } = SPOTS
  const released = fanStart + RELEASE
  return fingerFrames([
    [0, centerBelow],
    [teamPress - GLIDE, centerBelow, 'ease-in-out'],
    [teamPress, pill, 'ease-out'],
    [teamPress + PRESS, pill, 'ease-out', { pressed: true }],
    [released, pill, 'ease-in-out'],
    [released + GLIDE, rest],
    [closePress - GLIDE, rest, 'ease-in-out'],
    [closePress, close, 'ease-out'],
    [fanClose, close, 'ease-out', { pressed: true }],
    [fanClose + RELEASE, close, 'ease-in-out'],
    [fanClose + RELEASE + GLIDE, centerBelow],
    [CYCLE, centerBelow],
  ])
}

// Out of the pill one after another, landing with a little overshoot. They all close together.
function avatarFrames({ from, to }, index) {
  const inPill = { opacity: 1, transform: `translate(${from.x - to.x}em, ${from.y - to.y}em) scale(${AVATAR_FROM})` }
  const inList = { opacity: 1, transform: 'none' }
  return [
    { ...inPill, opacity: 0, offset: 0 },
    { ...inPill, opacity: 0, offset: at(fanStart) },
    { ...inPill, offset: at(fanStart) },
    { ...inPill, offset: at(avatarOut(index)), easing: EASE_SPRING },
    { ...inList, offset: at(avatarIn(index)) },
    { ...inList, offset: at(fanClose), easing: 'ease-in-out' },
    { ...inPill, offset: at(centerDone) },
    { ...inPill, opacity: 0, offset: at(centerDone) },
    { ...inPill, opacity: 0, offset: 1 },
  ]
}

// A cover in the panel's fill over one row, so each name shows just after its avatar lands.
function nameFrames(index) {
  const shown = avatarIn(index) + NAME_DELAY
  return [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: at(shown), easing: 'ease-out' },
    { opacity: 0, offset: at(shown + NAME_FADE) },
    { opacity: 0, offset: at(fanClose), easing: 'ease-in' },
    { opacity: 1, offset: at(fanClose + CLOSE / 3) },
    { opacity: 1, offset: 1 },
  ]
}

function timeline(layers) {
  const { homeDim, splash, splashPhoto, appStart, appEnd, ring, leftFinger } = layers
  const { pill, dim, panel, names, avatars, centerFinger } = layers
  const small = iconShape()
  const full = { transform: 'none', clipPath: `inset(0em 0 round ${SCREEN.radius}em)` }
  const risen = `translateY(${LOAD_RISE}em)`
  const wound = { opacity: RING_FROM.opacity, transform: `rotate(${RING_FROM.rotate}deg) scale(${RING_FROM.scale})` }
  return [
    [
      splash,
      // Hidden once the app covers it, so the crossfade back lands on the home screen.
      [
        { ...small, opacity: 0, offset: 0 },
        { ...small, opacity: 0, offset: at(openStart) },
        { ...small, opacity: 1, offset: at(openStart), easing: EASE_OPEN },
        { ...full, opacity: 1, offset: at(opened) },
        { ...full, opacity: 1, offset: at(loadStart) },
        { ...full, opacity: 0, offset: at(loadStart) },
        { ...full, opacity: 0, offset: 1 },
      ],
    ],
    // Hidden with the splash, once the app covers them.
    [
      homeDim,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: at(openStart), easing: EASE_OPEN },
        { opacity: 1, offset: at(opened) },
        { opacity: 1, offset: at(loadStart) },
        { opacity: 0, offset: at(loadStart) },
        { opacity: 0, offset: 1 },
      ],
    ],
    // The splash shows over the first moments of the growth, so it doesn't pop over the icon.
    [
      splashPhoto,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: at(openStart) },
        { opacity: 1, offset: at(openStart + PHOTO_FADE) },
        { opacity: 1, offset: 1 },
      ],
    ],
    // The end screen fades in over it, so nothing behind shows through the crossfade.
    [
      appStart,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: at(loadStart) },
        { opacity: 1, offset: at(loadStart) },
        { opacity: 1, offset: at(loaded) },
        { opacity: 0, offset: at(loaded) },
        { opacity: 0, offset: 1 },
      ],
    ],
    [
      appEnd,
      [
        { opacity: 0, transform: risen, offset: 0 },
        { opacity: 0, transform: risen, offset: at(loadStart), easing: EASE_LOAD },
        { opacity: 1, transform: 'none', offset: at(loaded) },
        { opacity: 1, transform: 'none', offset: at(appFade), easing: 'ease-in-out' },
        { opacity: 0, transform: 'none', offset: at(leftDone) },
        { opacity: 0, transform: risen, offset: 1 },
      ],
    ],
    [
      ring,
      [
        { ...wound, offset: 0 },
        { ...wound, offset: at(loadStart), easing: EASE_LOAD },
        { opacity: 1, transform: 'none', offset: at(loaded) },
        { opacity: 1, transform: 'none', offset: at(leftDone) },
        { ...wound, offset: at(leftDone) },
        { ...wound, offset: 1 },
      ],
    ],
    [leftFinger, leftFingerFrames()],
    [
      pill,
      [
        { transform: 'none', offset: 0 },
        { transform: 'none', offset: at(teamPress), easing: 'ease-out' },
        { transform: `scale(${PILL_DIP})`, offset: at(teamPress + PRESS), easing: 'ease-out' },
        { transform: 'none', offset: at(teamPress + PRESS + RELEASE) },
        { transform: 'none', offset: 1 },
      ],
    ],
    [
      dim,
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: at(fanStart), easing: 'ease-in-out' },
        { opacity: 1, offset: at(fanOpen) },
        { opacity: 1, offset: at(fanClose), easing: 'ease-in-out' },
        { opacity: 0, offset: at(centerDone) },
        { opacity: 0, offset: 1 },
      ],
    ],
    [
      panel,
      [
        { clipPath: inset(PILL), opacity: 0, offset: 0 },
        { clipPath: inset(PILL), opacity: 0, offset: at(fanStart), easing: 'ease-in-out' },
        { opacity: 1, offset: at(fanStart + PANEL_FADE) },
        { clipPath: inset(PANEL), opacity: 1, offset: at(fanOpen) },
        { clipPath: inset(PANEL), opacity: 1, offset: at(fanClose), easing: 'ease-in-out' },
        { opacity: 1, offset: at(centerDone - PANEL_FADE) },
        { clipPath: inset(PILL), opacity: 0, offset: at(centerDone) },
        { clipPath: inset(PILL), opacity: 0, offset: 1 },
      ],
    ],
    ...names.map((cover, index) => [cover, nameFrames(index)]),
    ...avatars.map((avatar, index) => [avatar, avatarFrames(AVATARS[index], index)]),
    [centerFinger, centerFingerFrames()],
  ]
}

export function initTitanLoop() {
  const card = document.querySelector('.titan-card')
  if (!card) return
  const layers = {
    homeDim: card.querySelector('.titan-home-dim'),
    splash: card.querySelector('.titan-splash'),
    splashPhoto: card.querySelector('.titan-splash-photo'),
    appStart: card.querySelector('.titan-app-start'),
    appEnd: card.querySelector('.titan-app-end'),
    ring: card.querySelector('.titan-ring'),
    leftFinger: card.querySelector('.titan-left .titan-cursor'),
    pill: card.querySelector('.titan-pill-photo'),
    dim: card.querySelector('.titan-dim'),
    panel: card.querySelector('.titan-panel'),
    names: [...card.querySelectorAll('.titan-panel-name')],
    avatars: AVATARS.map(({ name }) => card.querySelector(`.titan-avatar-${name}`)),
    centerFinger: card.querySelector('.titan-center .titan-cursor'),
  }
  loopWhileVisible(card, CYCLE, timeline(layers))
  playWhileVisible(card, card.querySelector('.titan-jack'))
}
