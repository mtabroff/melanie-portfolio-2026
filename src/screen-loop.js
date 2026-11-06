// Plays a looping screen animation in a work card: once every image in it has decoded, only
// while it's on screen, and never with reduced motion, where the CSS shows a still instead.
// `tracks` is a list of [element, keyframes], or [element, keyframes, duration] for a track with
// its own length. They all share one start time, so they can't drift apart.

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
    animations.forEach((animation) => (visible ? animation.play() : animation.pause()))
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    update()
  }).observe(root)

  reducedMotion.addEventListener('change', update)

  Promise.all(images.map((image) => image.decode())).then(
    () => {
      ready = true
      update()
    },
    () => {}, // a screen that fails to load leaves the first one showing, rather than a gap
  )
}

// A looping video in a work card. It loads only once the card is near, and plays only while
// it's on screen. With reduced motion it stays paused, and the CSS shows a still instead.
export function playWhileVisible(root, video) {
  if (!video) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false

  function update() {
    if (visible && !reducedMotion.matches) {
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
}
