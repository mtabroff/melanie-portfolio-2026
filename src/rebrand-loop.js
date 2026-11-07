// The Titan rebrand card. As it scrolls into view, both phones start upright and tilt into
// place, the right one just after the left. Once they settle, a soft light sweeps across the
// gold Pegasus on the left phone every few seconds. When the card leaves the viewport it resets,
// so it plays again next time. It holds still while the card's description is open on mobile, and
// carries on from there when it closes. With reduced motion, the CSS shows the tilted phones and no light.

const HOLD = 300 // upright, before the tilt
const TILT = 1100
const STAGGER = 120 // the right phone starts this much after the left
const SETTLED = HOLD + STAGGER + TILT
const FIRST_SWEEP = SETTLED + 400
const SWEEP = 1200
const WAIT = 3500
const IN_VIEW = 0.4 // how much of the card shows before it plays

const ANGLE = '11.87deg' // Figma's -11.87, as the tilted-pair layout sets it
const SPRING = 'cubic-bezier(0.34, 1.25, 0.64, 1)'
const FROM = -135 // the light, in the screen's points, off the illustration's left edge
const TO = 408.4 // and off its right edge

import { isHeld, onHoldChange, pauseRunning } from './screen-loop.js'

export function initRebrandCard() {
  const card = document.querySelector('.rebrand-card')
  const band = card?.querySelector('.rebrand-shimmer-band')
  if (!band) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const phones = [...card.querySelectorAll('.phone')]
  const images = [...card.querySelectorAll('img')]
  const ready = Promise.all(images.map((image) => image.decode())).catch(() => {})

  const place = (x) => ({ transform: `translateX(${x}em) rotate(20deg)` })
  const at = (ms) => ms / (SWEEP + WAIT)
  let animations = []
  let armed = true
  let inView = false
  let resume = null // set while held, to pick up the animations that were running

  // Paused at the start: both phones upright, the light off to the side.
  function reset() {
    animations.forEach((animation) => animation.cancel())
    armed = true
    resume = null
    if (reducedMotion.matches) {
      animations = []
      return
    }
    animations = [
      ...phones.map((phone, i) =>
        phone.animate([{ '--rotate': '0deg' }, { '--rotate': ANGLE }], {
          duration: TILT,
          delay: HOLD + i * STAGGER,
          easing: SPRING,
          fill: 'backwards',
        }),
      ),
      band.animate(
        [
          { ...place(FROM), offset: 0, easing: 'ease-in-out' },
          { ...place(TO), offset: at(SWEEP) },
          { ...place(TO), offset: 1 },
        ],
        { duration: SWEEP + WAIT, delay: FIRST_SWEEP, iterations: Infinity, fill: 'backwards' },
      ),
    ]
    animations.forEach((animation) => animation.pause())
  }

  function play() {
    armed = false
    ready.then(() => {
      if (armed) return // it left again before the images were ready
      const start = document.timeline.currentTime
      animations.forEach((animation) => (animation.startTime = start))
      if (isHeld(card)) resume = pauseRunning(animations) // the description opened while it waited
    })
  }

  function playIfShown() {
    if (armed && inView && !isHeld(card)) play()
  }

  reset()
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.intersectionRatio >= IN_VIEW
      if (reducedMotion.matches) return
      if (!entry.isIntersecting) reset()
      else playIfShown()
    },
    { threshold: [0, IN_VIEW] },
  ).observe(card)

  onHoldChange(card, () => {
    if (reducedMotion.matches) return
    if (isHeld(card)) {
      if (!armed && !resume) resume = pauseRunning(animations)
    } else if (resume) {
      resume()
      resume = null
    } else {
      playIfShown()
    }
  })

  // Turning reduced motion on shows the tilted phones; turning it off waits for the next entry.
  reducedMotion.addEventListener('change', reset)
}
