// The places deck. Clicking a stack grows it into a deck of that place's photos, and each
// place has its own URL, so back works and a /places/japan link can be shared.
// The list stays behind the dialog, so closing returns to the exact spot it was opened from.

// Opening, about 450ms: the front photo becomes the top card, the back polaroids become the
// paper cards, and the frames and the rest of the page fade. The caption and close come last.
const MORPH_MS = 450
const FRAME_FADE_MS = 100
const CHROME_OUT_MS = 80 // closing: the caption and close go first
const LANDING_MS = 180 // closing: by here the settle ease has the cards nearly home
const ZOOM_MS = 360
const FADE_MS = 200
const FLIGHT_MS = 560
const FLIGHT_TURN = 0.45 // the share of a flight when the card passes behind or in front of the deck
const THROW = 0.72 // how far a card travels before it turns, as a share of its width
const TILT = 7
const TAP_SLOP = 8 // px of movement before a press counts as a drag
const SWIPE_SHARE = 0.18 // of the card width, how far a drag has to go to send the card
const DOUBLE_TAP_MS = 260 // a single tap waits this long, in case it turns out to be a double
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.2, 1)'
const EASE_SETTLE = 'cubic-bezier(0.2, 0, 0, 1)'
const HINT_KEY = 'deck-hint-seen'
const FULL_BLEED_ENABLED = false // off for now. Turning it on brings back double-tap, and its short wait on a tap.

// Each place's slots, starting with the stack's front photo so the opening reads as one object.
function photosFor(link, slug) {
  const slots = document.querySelectorAll(`.place-photos[data-place="${slug}"] .place-photo`)
  const photos = [...slots].map((slot) => {
    const image = slot.querySelector('img')
    return { src: image?.src, alt: image?.alt ?? '' }
  })
  const frontSrc = link.querySelector('.polaroid-front img')?.src
  const front = frontSrc ? photos.findIndex((photo) => photo.src === frontSrc) : -1
  if (front > 0) photos.unshift(...photos.splice(front, 1))
  return photos
}

function makeCard(photo) {
  const card = document.createElement('div')
  card.className = 'deck-card'
  const face = document.createElement('div')
  face.className = 'deck-face'
  if (photo.src) {
    const image = document.createElement('img')
    image.src = photo.src
    image.alt = ''
    image.draggable = false
    face.append(image)
  }
  card.append(face)
  return card
}

// A photo that hasn't decoded yet would grow as an empty card.
function imagesReady(cards) {
  const decoded = cards.flatMap((card) =>
    [...card.querySelectorAll('img')].map((image) => image.decode().catch(() => {})),
  )
  return Promise.race([Promise.all(decoded), new Promise((done) => setTimeout(done, 300))])
}

function placeFromUrl(links) {
  const match = window.location.pathname.match(/^\/places\/([^/]+)\/?$/)
  return match && links.has(match[1]) ? match[1] : null
}

export function initPlacesDeck() {
  const root = document.documentElement
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const phone = window.matchMedia('(max-width: 959px)') // matches the shell breakpoint in style.css
  const mouse = window.matchMedia('(hover: hover)')
  const siteTitle = document.title

  const links = new Map(
    [...document.querySelectorAll('a.polaroid-stack')].map((link) => [link.dataset.place, link]),
  )
  const dialog = document.querySelector('.deck')
  const scrim = dialog.querySelector('.deck-scrim')
  const ghost = dialog.querySelector('.deck-ghost')
  const body = dialog.querySelector('.deck-body')
  const closeButton = dialog.querySelector('.deck-close')
  const stage = dialog.querySelector('.deck-stage')
  const caption = dialog.querySelector('.deck-caption')
  const title = dialog.querySelector('.deck-title')
  const count = dialog.querySelector('.deck-count')
  const hint = dialog.querySelector('.deck-hint')
  const status = dialog.querySelector('[role="status"]')
  const zoom = dialog.querySelector('.deck-zoom')
  const zoomPhoto = dialog.querySelector('.deck-zoom-photo')
  const zoomScrim = dialog.querySelector('.deck-zoom-scrim')
  const zoomCaption = dialog.querySelector('.deck-zoom-caption')
  const zoomTitle = dialog.querySelector('.deck-zoom-title')
  const zoomCount = dialog.querySelector('.deck-zoom-count')
  const zoomClose = dialog.querySelector('.deck-zoom-close')

  let link = null
  let photos = []
  let cards = []
  let index = 0
  let closing = false
  let morphing = false
  let closeRequested = false
  let zoomed = false
  let press = null
  let lastTap = null
  let tapTimer = null
  let hintShown = false

  function layout() {
    const total = cards.length
    cards.forEach((card, i) => {
      card.dataset.depth = Math.min((i - index + total) % total, 3)
    })
    count.textContent = `${index + 1} / ${total}`
    const alt = photos[index].alt || (photos[index].src ? '' : 'placeholder')
    status.textContent = `photo ${index + 1} of ${total}${alt ? `: ${alt}` : ''}`
  }

  // The back cards in deck order. The stacking matches, so nothing crosses over on the way.
  function backPolaroid(depth) {
    return link.querySelector(depth === 1 ? '.polaroid-back-right' : '.polaroid-back-left')
  }

  // Where a back card has to be drawn to sit exactly over its polaroid.
  function stackTransform(depth) {
    const polaroid = backPolaroid(depth)
    const from = polaroid.getBoundingClientRect()
    const to = stage.getBoundingClientRect()
    const x = from.left + from.width / 2 - (to.left + to.width / 2)
    const y = from.top + from.height / 2 - (to.top + to.height / 2)
    const scale = polaroid.offsetWidth / stage.offsetWidth
    return `translate(${x}px, ${y}px) rotate(${angleOf(polaroid)}rad) scale(${scale})`
  }

  function angleOf(element) {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return Math.atan2(matrix.b, matrix.a)
  }

  // The top card's box over the front polaroid's photo. Its size changes rather than its scale,
  // so object-fit reveals more of the photo as the square becomes 3:4.
  function photoBox() {
    const from = link.querySelector('.polaroid-front .polaroid-photo').getBoundingClientRect()
    const to = stage.getBoundingClientRect()
    return {
      left: `${from.left - to.left}px`,
      top: `${from.top - to.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    }
  }

  function showGhost({ frameOnly }) {
    const front = link.querySelector('.polaroid-front')
    const clone = front.cloneNode(true)
    clone.style.transform = getComputedStyle(front).transform
    const box = link.getBoundingClientRect()
    Object.assign(ghost.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    })
    ghost.classList.toggle('is-frame-only', frameOnly)
    ghost.replaceChildren(clone)
    ghost.hidden = false
  }

  function addCardPolaroid(card, depth) {
    const polaroid = backPolaroid(depth).cloneNode(true)
    polaroid.classList.add('deck-card-polaroid')
    card.append(polaroid)
    return polaroid
  }

  function clearMorph() {
    morphing = false
    ghost.getAnimations().forEach((animation) => animation.cancel())
    ghost.hidden = true
    ghost.replaceChildren()
    stage.querySelectorAll('.deck-card-polaroid').forEach((polaroid) => polaroid.remove())
  }

  function morphOpen() {
    morphing = true
    showGhost({ frameOnly: true })
    const motion = [
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' }),
      ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FRAME_FADE_MS, easing: 'ease-out', fill: 'forwards' }),
    ]
    for (const card of visibleCards()) {
      const depth = Number(card.dataset.depth)
      if (depth === 0) {
        motion.push(
          card.animate(
            [
              { ...photoBox(), boxShadow: 'inset 0 0 0 0 transparent, 0 0 0 0 transparent' },
              { left: '0px', top: '0px', width: `${stage.offsetWidth}px`, height: `${stage.offsetHeight}px` },
            ],
            { duration: MORPH_MS, easing: EASE_SETTLE },
          ),
        )
      } else {
        // Written as the same list at both ends, so the rotation itself is what interpolates.
        const end = `translate(0px, 0px) rotate(${angleOf(card)}rad) scale(1)`
        motion.push(
          card.animate([{ transform: stackTransform(depth) }, { transform: end }], {
            duration: MORPH_MS,
            easing: EASE_SETTLE,
          }),
          addCardPolaroid(card, depth).animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: FRAME_FADE_MS,
            easing: 'ease-out',
            fill: 'forwards',
          }),
        )
      }
    }
    fadeChrome([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, delay: MORPH_MS, fill: 'backwards' })
    Promise.all(motion.map((animation) => animation.finished)).then(clearMorph, () => {})
  }

  function morphClose() {
    const landing = CHROME_OUT_MS + LANDING_MS
    const fadeIn = { duration: FRAME_FADE_MS, delay: landing, easing: 'ease-out', fill: 'both' }
    const cards = visibleCards().map((card) => {
      const style = getComputedStyle(card)
      return {
        card,
        depth: Number(card.dataset.depth),
        transform: style.transform,
        box: { left: style.left, top: style.top, width: style.width, height: style.height },
      }
    })
    // Closing can interrupt the opening or a card in flight, and carries on from where they were.
    stage.getAnimations({ subtree: true }).forEach((animation) => animation.cancel())
    clearMorph()
    showGhost({ frameOnly: false })
    const timing = { duration: MORPH_MS, delay: CHROME_OUT_MS, easing: EASE_SETTLE, fill: 'both' }
    const motion = [
      ...fadeChrome([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }),
      ghost.animate([{ opacity: 0 }, { opacity: 1 }], fadeIn),
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_MS,
        delay: landing - FADE_MS / 2,
        easing: 'ease-out',
        fill: 'both',
      }),
    ]
    for (const { card, depth, transform, box } of cards) {
      if (depth === 0) {
        motion.push(
          card.animate([box, photoBox()], timing),
          // The list's front photo may not be this one, so it hands over right at the end.
          card.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.85 }, { opacity: 0, offset: 1 }], {
            duration: MORPH_MS,
            delay: CHROME_OUT_MS,
            fill: 'both',
          }),
        )
      } else {
        motion.push(
          card.animate([{ transform }, { transform: stackTransform(depth) }], timing),
          addCardPolaroid(card, depth).animate([{ opacity: 0 }, { opacity: 1 }], fadeIn),
        )
      }
    }
    return Promise.all(motion.map((animation) => animation.finished.catch(() => {})))
  }

  function visibleCards() {
    return cards.filter((card) => Number(card.dataset.depth) < 3)
  }

  function fadeChrome(keyframes, options) {
    return [caption, closeButton, hint].map((element) =>
      element.animate(keyframes, { easing: 'ease-out', ...options }),
    )
  }

  // Only ever once, the first time someone on a phone opens a place.
  function showHintOnce() {
    hint.hidden = true
    if (!phone.matches || hintShown) return
    hintShown = true
    try {
      if (localStorage.getItem(HINT_KEY)) return
      localStorage.setItem(HINT_KEY, '1')
    } catch {
      // Storage can be blocked. Then it's once per visit.
    }
    hint.hidden = false
  }

  async function open(slug, { animate = true } = {}) {
    if (link) return
    link = links.get(slug)
    closing = false
    closeRequested = false
    photos = photosFor(link, slug)
    cards = photos.map(makeCard)
    index = 0
    const name = link.querySelector('.polaroid-front .polaroid-caption').textContent
    title.textContent = name
    zoomTitle.textContent = name
    stage.replaceChildren(...cards)
    layout()
    showHintOnce()
    await imagesReady(cards.slice(0, 3))

    dialog.showModal()
    root.classList.add('deck-open')
    delete root.dataset.place
    document.title = `${name} · melanie joy tabroff`
    history.scrollRestoration = 'manual'
    link.style.visibility = 'hidden'

    if (!animate) return

    if (reducedMotion.matches) {
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' })
      return
    }

    morphOpen()
  }

  async function close({ animate = true } = {}) {
    if (closing || !dialog.open) return
    closing = true
    clearTimeout(tapTimer)
    tapTimer = null
    leaveZoom()

    // Opened from a shared link, the stack may be nowhere near the screen.
    const stackRect = link.getBoundingClientRect()
    if (stackRect.bottom < 0 || stackRect.top > window.innerHeight) {
      link.scrollIntoView({ block: 'center', behavior: 'instant' })
    }

    if (animate && reducedMotion.matches) {
      await dialog
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' })
        .finished.catch(() => {})
    } else if (animate) {
      await morphClose()
    }
    dialog.close()
  }

  // Closing goes through history, so the browser's back button does the same thing.
  function requestClose() {
    if (closeRequested) return
    closeRequested = true
    if (history.state?.deck) {
      history.back()
      return
    }
    // Opened from a shared link, so there's no list to step back to.
    history.pushState(null, '', '/')
    close()
  }

  function send(direction = -1, from) {
    if (cards.length < 2 || closing || zoomed || morphing) return
    const card = cards[index]
    const start = from ?? getComputedStyle(card).transform
    index = (index + 1) % cards.length
    layout()

    if (reducedMotion.matches) {
      cards[index].firstChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' })
      return
    }

    const out = `translate(${direction * stage.offsetWidth * THROW}px, -2%) rotate(${direction * TILT}deg)`
    fly(
      card,
      [
        { transform: start, opacity: 1, zIndex: 50, offset: 0, easing: EASE_OUT },
        { transform: out, opacity: 1, zIndex: 50, offset: FLIGHT_TURN },
        { transform: out, opacity: 1, zIndex: 0, offset: FLIGHT_TURN, easing: EASE_IN_OUT },
        { zIndex: 0, offset: 1 }, // on to wherever the deck has it by then
      ],
      // Still a photo while it's in the air, and paper once it lands at the back.
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.6 },
        { offset: 1 },
      ],
    )
  }

  // The reverse of send: the back card swings out from behind the deck and lands on top.
  function bringBack() {
    if (cards.length < 2 || closing || zoomed || morphing) return
    const card = cards[(index - 1 + cards.length) % cards.length]
    const style = getComputedStyle(card)
    const start = style.transform
    const startOpacity = style.opacity
    index = (index - 1 + cards.length) % cards.length
    layout()

    if (reducedMotion.matches) {
      card.firstChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' })
      return
    }

    const out = `translate(${-stage.offsetWidth * THROW}px, -2%) rotate(${-TILT}deg)`
    fly(
      card,
      [
        { transform: start, opacity: startOpacity, zIndex: 0, offset: 0, easing: EASE_IN_OUT },
        { transform: out, opacity: 1, zIndex: 0, offset: FLIGHT_TURN },
        { transform: out, opacity: 1, zIndex: 50, offset: FLIGHT_TURN, easing: EASE_OUT },
        { zIndex: 50, offset: 1 },
      ],
      [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: FLIGHT_TURN },
        { offset: 1 },
      ],
    )
  }

  function fly(card, cardFrames, faceFrames) {
    card.flights?.forEach((flight) => flight.cancel())
    card.flights = [
      card.animate(cardFrames, { duration: FLIGHT_MS }),
      card.firstChild.animate(faceFrames, { duration: FLIGHT_MS }),
    ]
  }

  function enterZoom() {
    if (zoomed || closing || morphing) return
    zoomed = true
    const { src } = photos[index]
    zoomPhoto.hidden = !src
    zoom.classList.toggle('is-empty', !src)
    if (src) zoomPhoto.src = src
    zoomCount.textContent = `${count.textContent} · ${mouse.matches ? 'double-click' : 'double-tap'} to exit`
    zoom.hidden = false
    body.inert = true
    closeButton.inert = true
    zoomClose.focus({ preventScroll: true })

    if (reducedMotion.matches) {
      zoom.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' })
      return
    }
    zoom.animate([{ backgroundColor: 'transparent' }, {}], { duration: ZOOM_MS, easing: 'ease-out' })
    zoomPhoto.animate([cardBox(), {}], { duration: ZOOM_MS, easing: EASE_OUT })
    for (const element of [zoomScrim, zoomCaption, zoomClose]) {
      element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, delay: 160, fill: 'backwards', easing: 'ease-out' })
    }
  }

  // The photo's box while it sits on the top card. Its size changes rather than its scale,
  // so the crop changes smoothly from the card's to the full screen's.
  function cardBox() {
    const box = stage.getBoundingClientRect()
    return { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` }
  }

  async function exitZoom() {
    if (!zoomed) return
    zoomed = false
    body.inert = false
    closeButton.inert = false
    stage.focus({ preventScroll: true })

    const motion = reducedMotion.matches
      ? [zoom.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' })]
      : [
          zoom.animate([{}, { backgroundColor: 'transparent' }], { duration: ZOOM_MS, easing: 'ease-out', fill: 'forwards' }),
          zoomPhoto.animate([{}, cardBox()], { duration: ZOOM_MS, easing: EASE_OUT, fill: 'forwards' }),
          ...[zoomScrim, zoomCaption, zoomClose].map((element) =>
            element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }),
          ),
        ]
    await Promise.all(motion.map((animation) => animation.finished.catch(() => {})))
    if (!zoomed) leaveZoom()
  }

  function leaveZoom() {
    zoomed = false
    zoom.hidden = true
    body.inert = false
    closeButton.inert = false
    for (const element of [zoom, zoomPhoto, zoomScrim, zoomCaption, zoomClose]) {
      element.getAnimations().forEach((animation) => animation.cancel())
    }
  }

  function isDoubleTap(event) {
    const previous = lastTap
    const now = { time: event.timeStamp, x: event.clientX, y: event.clientY }
    const double =
      previous &&
      now.time - previous.time < DOUBLE_TAP_MS &&
      Math.hypot(now.x - previous.x, now.y - previous.y) < TAP_SLOP * 3
    lastTap = double ? null : now
    return double
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || closing || morphing) return
    stage.setPointerCapture(event.pointerId)
    press = { x: event.clientX, y: event.clientY, dragging: false }
  })

  stage.addEventListener('pointermove', (event) => {
    if (!press) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (!press.dragging && Math.hypot(dx, dy) < TAP_SLOP) return
    press.dragging = true
    if (reducedMotion.matches) return
    const card = cards[index]
    card.classList.add('is-dragging')
    card.style.transform = `translate(${dx}px, ${dy * 0.2}px) rotate(${(dx / stage.offsetWidth) * TILT}deg)`
    // The next photo comes up on its paper as this one moves off it.
    const next = cards[(index + 1) % cards.length]
    const progress = Math.min(Math.abs(dx) / (stage.offsetWidth * SWIPE_SHARE), 1)
    next.firstChild.style.opacity = progress
  })

  function releaseCard() {
    const card = cards[index]
    const from = getComputedStyle(card).transform
    card.classList.remove('is-dragging')
    card.style.transform = ''
    cards[(index + 1) % cards.length].firstChild.style.opacity = ''
    return from
  }

  stage.addEventListener('pointerup', (event) => {
    if (!press) return
    const { dragging, x } = press
    press = null
    if (!dragging) {
      if (!FULL_BLEED_ENABLED) {
        send()
        return
      }
      clearTimeout(tapTimer)
      tapTimer = null
      if (isDoubleTap(event)) {
        enterZoom()
        return
      }
      tapTimer = setTimeout(() => {
        tapTimer = null
        send()
      }, DOUBLE_TAP_MS)
      return
    }
    const dx = event.clientX - x
    const from = releaseCard()
    if (Math.abs(dx) >= stage.offsetWidth * SWIPE_SHARE) send(Math.sign(dx), from)
  })

  stage.addEventListener('pointercancel', () => {
    if (press?.dragging) releaseCard()
    press = null
  })

  // Pointer input is handled above, so this only answers Enter and Space.
  stage.addEventListener('click', (event) => {
    if (event.detail === 0) send()
  })

  closeButton.addEventListener('click', requestClose)
  zoomClose.addEventListener('click', exitZoom)

  zoom.addEventListener('pointerup', (event) => {
    if (event.target.closest('.deck-zoom-close')) return
    if (isDoubleTap(event)) exitZoom()
  })

  // Anywhere outside the deck closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('.deck-stage, .deck-close, .deck-zoom')) return
    requestClose()
  })

  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation() // Esc here shouldn't also close a work card behind the deck
    if (event.key === 'Tab') dialog.classList.add('is-tabbing')
    else if (event.key === 'ArrowRight') send()
    else if (event.key === 'ArrowLeft') bringBack()
    else if (event.key === 'Escape') {
      event.preventDefault()
      if (zoomed) exitZoom()
      else requestClose()
    }
  })

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    if (zoomed) exitZoom()
    else requestClose()
  })

  dialog.addEventListener('close', () => {
    for (const element of [scrim, caption, closeButton, hint, dialog]) {
      element.getAnimations().forEach((animation) => animation.cancel())
    }
    clearMorph()
    root.classList.remove('deck-open')
    const tabbing = dialog.classList.contains('is-tabbing')
    dialog.classList.remove('is-tabbing')
    stage.replaceChildren()
    document.title = siteTitle
    history.scrollRestoration = 'auto'
    link.style.visibility = ''
    // Without the ring, and the fan that comes with it, unless someone is tabbing.
    link.focus({ preventScroll: true, focusVisible: tabbing })
    link = null
    press = null
    lastTap = null
    // Closed by the browser rather than through requestClose, so the URL is still the place's.
    if (placeFromUrl(links)) {
      if (history.state?.deck) history.back()
      else history.pushState(null, '', '/')
    }
  })

  for (const [slug, stack] of links) {
    stack.addEventListener('click', (event) => {
      // Let a new-tab click or similar do what it normally does.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      history.pushState({ deck: true }, '', stack.pathname)
      open(slug)
    })
  }

  window.addEventListener('popstate', (event) => {
    const slug = placeFromUrl(links)
    const animate = !event.hasUAVisualTransition // Safari's swipe back has already animated
    if (slug && !link) open(slug, { animate })
    else if (!slug && dialog.open) close({ animate })
  })

  const initial = placeFromUrl(links)
  if (initial) {
    open(initial, { animate: false })
  } else {
    delete root.dataset.place
    if (window.location.pathname.startsWith('/places/')) history.replaceState(null, '', '/')
  }
}
