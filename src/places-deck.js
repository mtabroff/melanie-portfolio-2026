// Temporary: an alternate places interaction, shown with ?places=deck so it can be
// compared with the place pages. Everything for it lives in this file and places-deck.css.
import './places-deck.css'

const OPEN_MS = 420
const CLOSE_MS = 340
const FLIGHT_MS = 560
const FLIGHT_TURN = 0.45 // the share of a flight when the card passes behind or in front of the deck
const THROW = 0.72 // how far a card travels before it turns, as a share of its width
const TILT = 7
const TAP_SLOP = 8 // px of movement before a press counts as a drag
const SWIPE_SHARE = 0.18 // of the card width, how far a drag has to go to send the card
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.2, 1)'

export function isDeckMode() {
  return new URLSearchParams(window.location.search).get('places') === 'deck'
}

// The place page's slots, starting with the stack's front photo so the expand reads as one
// object. The next two then match the polaroids behind it.
function photosFor(link, view) {
  const photos = [...view.querySelectorAll('.place-photo')].map((slot) => {
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
  if (photo.src) {
    const image = document.createElement('img')
    image.src = photo.src
    image.alt = ''
    image.draggable = false
    card.append(image)
  }
  return card
}

// A photo that hasn't decoded yet would expand as an empty card.
function imagesReady(cards) {
  const decoded = cards.flatMap((card) =>
    [...card.querySelectorAll('img')].map((image) => image.decode().catch(() => {})),
  )
  return Promise.race([Promise.all(decoded), new Promise((done) => setTimeout(done, 300))])
}

export function createPlacesDeck() {
  const root = document.documentElement
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  const dialog = document.createElement('dialog')
  dialog.className = 'deck'
  dialog.setAttribute('aria-labelledby', 'deck-title')
  dialog.innerHTML = `
    <div class="deck-scrim"></div>
    <div class="deck-body">
      <button class="deck-stage" type="button" aria-label="next photo" autofocus></button>
      <div class="deck-caption">
        <h2 class="deck-title" id="deck-title"></h2>
        <span class="deck-count"></span>
      </div>
    </div>
    <p class="visually-hidden" role="status"></p>
  `
  const closeButton = document.querySelector('.place-view-close').cloneNode(true)
  dialog.append(closeButton)
  document.body.append(dialog)

  const scrim = dialog.querySelector('.deck-scrim')
  const stage = dialog.querySelector('.deck-stage')
  const caption = dialog.querySelector('.deck-caption')
  const title = dialog.querySelector('.deck-title')
  const count = dialog.querySelector('.deck-count')
  const status = dialog.querySelector('[role="status"]')

  let link = null
  let photos = []
  let cards = []
  let index = 0
  let closing = false
  let press = null

  // A deck left open by a reload is gone, so its history entry shouldn't count as open.
  if (history.state?.deck) history.replaceState(null, '')

  function layout() {
    const total = cards.length
    cards.forEach((card, i) => {
      card.dataset.depth = Math.min((i - index + total) % total, 3)
    })
    count.textContent = `${index + 1} / ${total}`
    const alt = photos[index].alt || (photos[index].src ? '' : 'placeholder')
    status.textContent = `photo ${index + 1} of ${total}${alt ? `: ${alt}` : ''}`
  }

  // Where a card has to be drawn to sit exactly over one of the stack's polaroids.
  function stackTransform(depth) {
    const polaroid = link.querySelector(
      ['.polaroid-front', '.polaroid-back-left', '.polaroid-back-right'][depth],
    )
    const from = polaroid.getBoundingClientRect()
    const to = stage.getBoundingClientRect()
    const x = from.left + from.width / 2 - (to.left + to.width / 2)
    const y = from.top + from.height / 2 - (to.top + to.height / 2)
    const scale = polaroid.offsetWidth / stage.offsetWidth
    const matrix = new DOMMatrixReadOnly(getComputedStyle(polaroid).transform)
    const angle = Math.atan2(matrix.b, matrix.a)
    return `translate(${x}px, ${y}px) rotate(${angle}rad) scale(${scale})`
  }

  function visibleCards() {
    return cards.filter((card) => Number(card.dataset.depth) < 3)
  }

  function fadeChrome(keyframes, options) {
    return [caption, closeButton].map((element) =>
      element.animate(keyframes, { easing: 'ease-out', ...options }),
    )
  }

  async function open(nextLink, view) {
    if (link) return
    link = nextLink
    closing = false
    photos = photosFor(link, view)
    cards = photos.map(makeCard)
    index = 0
    title.textContent = view.querySelector('h1').textContent
    stage.replaceChildren(...cards)
    layout()
    await imagesReady(cards.slice(0, 3))

    dialog.showModal()
    root.classList.add('deck-open')
    history.pushState({ deck: true }, '', window.location.href)
    link.style.visibility = 'hidden'

    if (reducedMotion.matches) {
      dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      return
    }

    scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
    visibleCards().forEach((card) => {
      card.animate([{ transform: stackTransform(Number(card.dataset.depth)) }, {}], {
        duration: OPEN_MS,
        easing: EASE_OUT,
      })
    })
    fadeChrome([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 220, fill: 'backwards' })
  }

  async function close({ animate = true } = {}) {
    if (closing || !dialog.open) return
    closing = true
    link.style.visibility = ''

    if (animate && reducedMotion.matches) {
      await dialog
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' })
        .finished.catch(() => {})
    } else if (animate) {
      const motion = visibleCards().map((card) => {
        const start = getComputedStyle(card).transform
        return card.animate(
          [
            { transform: start, opacity: 1, offset: 0 },
            { opacity: 1, offset: 0.7 },
            { transform: stackTransform(Number(card.dataset.depth)), opacity: 0, offset: 1 },
          ],
          { duration: CLOSE_MS, easing: EASE_OUT, fill: 'forwards' },
        )
      })
      motion.push(
        scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: 'ease-out', fill: 'forwards' }),
        ...fadeChrome([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }),
      )
      await Promise.all(motion.map((animation) => animation.finished.catch(() => {})))
    }
    dialog.close()
  }

  // Closing goes through history, so the browser's back button does the same thing.
  function requestClose() {
    if (history.state?.deck) history.back()
    else close()
  }

  function send(direction = -1, from) {
    if (cards.length < 2 || closing) return
    const card = cards[index]
    const start = from ?? getComputedStyle(card).transform
    index = (index + 1) % cards.length
    layout()

    if (reducedMotion.matches) {
      cards[index].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      return
    }

    const out = `translate(${direction * stage.offsetWidth * THROW}px, -2%) rotate(${direction * TILT}deg)`
    card.flight?.cancel()
    card.flight = card.animate(
      [
        { transform: start, opacity: 1, zIndex: 50, offset: 0, easing: EASE_OUT },
        { transform: out, opacity: 1, zIndex: 50, offset: FLIGHT_TURN },
        { transform: out, opacity: 1, zIndex: 0, offset: FLIGHT_TURN, easing: EASE_IN_OUT },
        { zIndex: 0, offset: 1 }, // on to wherever the deck has it by then
      ],
      { duration: FLIGHT_MS },
    )
  }

  // The reverse of send: the back card swings out from behind the deck and lands on top.
  function bringBack() {
    if (cards.length < 2 || closing) return
    const card = cards[(index - 1 + cards.length) % cards.length]
    const style = getComputedStyle(card)
    const start = style.transform
    const startOpacity = style.opacity
    index = (index - 1 + cards.length) % cards.length
    layout()

    if (reducedMotion.matches) {
      card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
      return
    }

    const out = `translate(${-stage.offsetWidth * THROW}px, -2%) rotate(${-TILT}deg)`
    card.flight?.cancel()
    card.flight = card.animate(
      [
        { transform: start, opacity: startOpacity, zIndex: 0, offset: 0, easing: EASE_IN_OUT },
        { transform: out, opacity: 1, zIndex: 0, offset: FLIGHT_TURN },
        { transform: out, opacity: 1, zIndex: 50, offset: FLIGHT_TURN, easing: EASE_OUT },
        { zIndex: 50, offset: 1 },
      ],
      { duration: FLIGHT_MS },
    )
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || closing) return
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
    const turn = (dx / stage.offsetWidth) * TILT
    card.style.transform = `translate(${dx}px, ${dy * 0.2}px) rotate(${turn}deg)`
  })

  function releaseCard() {
    const card = cards[index]
    const from = getComputedStyle(card).transform
    card.classList.remove('is-dragging')
    card.style.transform = ''
    return from
  }

  stage.addEventListener('pointerup', (event) => {
    if (!press) return
    const { dragging, x } = press
    press = null
    if (!dragging) {
      send()
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

  dialog.addEventListener('keydown', (event) => {
    event.stopPropagation() // Esc here shouldn't also close a work card behind the deck
    if (event.key === 'Tab') dialog.classList.add('is-tabbing')
    else if (event.key === 'ArrowRight') send()
    else if (event.key === 'ArrowLeft') bringBack()
    else if (event.key === 'Escape') {
      event.preventDefault()
      requestClose()
    }
  })

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    requestClose()
  })

  dialog.addEventListener('close', () => {
    for (const element of [scrim, caption, closeButton, dialog]) {
      element.getAnimations().forEach((animation) => animation.cancel())
    }
    root.classList.remove('deck-open')
    dialog.classList.remove('is-tabbing')
    stage.replaceChildren()
    link.style.visibility = ''
    link.focus({ preventScroll: true })
    link = null
    press = null
    if (history.state?.deck) history.back()
  })

  window.addEventListener('popstate', (event) => {
    if (dialog.open && !event.state?.deck) close({ animate: !event.hasUAVisualTransition })
  })

  return { open }
}
