// Plays a looping screen animation in a work card: once every image in it has decoded, only
// while it's on screen and not held, and never with reduced motion, where the CSS shows a still instead.
// `tracks` is a list of [element, keyframes], or [element, keyframes, duration] for a track with
// its own length. They all share one start time, so they can't drift apart.

// On mobile, while a card's description is open over it, the card is held: everything in it
// pauses, and picks up where it left off when the description closes. main.js fires
// 'revealchange' on the project when the description opens or closes, or the layout changes.
// Matches the mobile breakpoint in style.css.
const mobile = window.matchMedia('(max-width: 959px)')

export function isHeld(element) {
  return mobile.matches && Boolean(element.closest('.project.is-revealed'))
}

export function onHoldChange(element, callback) {
  element.closest('.project')?.addEventListener('revealchange', callback)
}

// Pauses whichever of these animations are running, and returns a function that resumes just
// those. A finished one stays finished, where play() would start it over.
export function pauseRunning(animations) {
  const running = animations.filter((animation) => animation.playState === 'running')
  running.forEach((animation) => animation.pause())
  return () => running.forEach((animation) => animation.play())
}

// `startAt` begins the loop partway in, for a loop whose first moments aren't its resting state.
export function loopWhileVisible(root, cycle, tracks, startAt = 0) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const images = [...root.querySelectorAll('img')]

  let animations = []
  let ready = false
  let visible = false

  function update() {
    if (!ready || reducedMotion.matches) {
      animations.forEach((animation) => animation.cancel())
      animations = []
      return
    }
    if (!animations.length) {
      const start = document.timeline.currentTime - startAt
      animations = tracks.map(([element, keyframes, duration = cycle]) => {
        const animation = element.animate(keyframes, { duration, iterations: Infinity })
        animation.startTime = start
        return animation
      })
    }
    const running = visible && !isHeld(root)
    animations.forEach((animation) => (running ? animation.play() : animation.pause()))
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    update()
  }).observe(root)

  reducedMotion.addEventListener('change', update)
  onHoldChange(root, update)

  Promise.all(images.map((image) => image.decode())).then(
    () => {
      ready = true
      update()
    },
    () => {}, // a screen that fails to load leaves the first one showing, rather than a gap
  )
}

// A looping video in a work card. It loads only once the card is near, and plays only while
// it's on screen and not held. With reduced motion it stays paused, and the CSS shows a still instead.
export function playWhileVisible(root, video) {
  if (!video) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false

  function update() {
    if (visible && !isHeld(root) && !reducedMotion.matches) {
      video.play().catch(() => {}) // if the browser refuses, the poster stays
    } else {
      video.pause()
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    update()
  }).observe(root)
  reducedMotion.addEventListener('change', update)
  onHoldChange(root, update)
}
