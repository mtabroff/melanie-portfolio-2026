// The Titan Smart Cash card. On the left phone the rate scanner turns its ring and rolls the
// rate's digits to each fund it checks, then back to 4.51, forever. On the middle phone the
// chart's bars grow up from the baseline each time the card comes back into view, once it has
// fully left. Both hold still while the card's description is open on mobile, and carry on
// from there when it closes. With reduced motion, both stay at their final states.

import { isHeld, loopWhileVisible, onHoldChange, pauseRunning } from './screen-loop.js'

// The scanner: each step holds, then turns to the next fund.
const HOLD = 1500
const TURN = 750
const STEP = HOLD + TURN
const EASE_TURN = 'cubic-bezier(0.34, 1.3, 0.64, 1)'
const RING = 72 // degrees per fund
const DIGIT = 53 // the strips' pitch, in the export's points (ems here)
// Which digit each strip shows at each fund: 4.51, 4.23, 4.02, 4.34, 4.49, and 4.51 again.
const TENTHS = [0, 7, 5, 8, 9, 0]
const HUNDREDTHS = [0, 2, 1, 3, 8, 0]
const STEPS = TENTHS.length - 1
const CYCLE = STEP * STEPS

// The chart: a beat after the card comes into view, the bars grow left to right.
const CHART_WAIT = 400
const CHART_IN_VIEW = 0.4 // of the card, before the bars grow
const GROW = 600
const STAGGER = 60
const EASE_GROW = 'cubic-bezier(0.22, 1, 0.36, 1)'

// Each state holds, then springs into the next. The last state matches the first.
function stepFrames(states) {
  const at = (ms) => ms / CYCLE
  const frames = []
  for (let step = 0; step < STEPS; step++) {
    frames.push(
      { ...states[step], offset: at(STEP * step) },
      { ...states[step], offset: at(STEP * step + HOLD), easing: EASE_TURN },
    )
  }
  frames.push({ ...states[STEPS], offset: 1 })
  return frames
}

function scannerTracks(card) {
  const ring = card.querySelector('.smartcash-ring')
  const strip = (name) => card.querySelector(`.smartcash-digit-${name}`)
  const turns = TENTHS.map((_, step) => ({ transform: `rotate(${RING * step}deg)` }))
  const roll = (indexes) => indexes.map((index) => ({ transform: `translateY(${-index * DIGIT}em)` }))
  return [
    [ring, stepFrames(turns)],
    [strip('a'), stepFrames(roll(TENTHS))],
    [strip('b'), stepFrames(roll(HUNDREDTHS))],
  ]
}

// The bars are set back to nothing once the card has fully left the view, and grow again once
// enough of it is back. Being only partly scrolled away doesn't count as leaving.
function growWhenVisible(card) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reducedMotion.matches) return
  const bars = [...card.querySelectorAll('.smartcash-bar')]
  const chart = card.querySelector('.smartcash-chart')
  const ready = Promise.all([...chart.querySelectorAll('img')].map((image) => image.decode())).catch(() => {})
  let animations = []
  let armed = false
  let inView = false
  let resume = null // set while held, to pick up the bars that were growing

  // Waiting at the start, so the bars show at nothing until they play.
  function reset() {
    animations.forEach((animation) => animation.cancel())
    animations = bars.map((bar, index) => {
      const animation = bar.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], {
        duration: GROW,
        delay: CHART_WAIT + STAGGER * index,
        easing: EASE_GROW,
        fill: 'both',
      })
      animation.pause()
      return animation
    })
    armed = true
    resume = null
  }

  function growIfShown() {
    if (!armed || !inView || isHeld(card)) return
    armed = false
    const growing = animations
    ready.then(() => {
      if (growing !== animations) return // it left and reset before the images were ready
      if (isHeld(card)) resume = () => growing.forEach((animation) => animation.play())
      else growing.forEach((animation) => animation.play())
    })
  }

  reset()
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.intersectionRatio >= CHART_IN_VIEW
      if (reducedMotion.matches) return
      if (!entry.isIntersecting) reset()
      else growIfShown()
    },
    { threshold: [0, CHART_IN_VIEW] },
  ).observe(card)

  onHoldChange(card, () => {
    if (isHeld(card)) {
      if (!armed && !resume) resume = pauseRunning(animations)
    } else if (resume) {
      resume()
      resume = null
    } else {
      growIfShown()
    }
  })

  // Turning reduced motion on midway shows the bars in full.
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) animations.forEach((animation) => animation.finish())
  })
}

export function initSmartCash() {
  const card = document.querySelector('.smartcash-card')
  if (!card) return
  loopWhileVisible(card, CYCLE, scannerTracks(card))
  growWhenVisible(card)
}
