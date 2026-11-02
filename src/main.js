// Scroll-driven behavior (active nav state, work side panel), the hero polaroid flip,
// the work card reveal, the place pages, and the theme toggle.
// (Still to come later: weather widget.)

import { createPlacesDeck, isDeckMode } from './places-deck.js'

const root = document.documentElement
const sections = [...document.querySelectorAll('#main > section[id]')]
const navLinks = new Map(
  [...document.querySelectorAll('[data-nav]')].map((link) => [link.dataset.nav, link]),
)

// Matches the shell breakpoint in style.css.
const desktop = window.matchMedia('(min-width: 960px)')

// Matches the side panel breakpoint in style.css.
const panelLayout = window.matchMedia('(min-width: 1200px)')

const projects = [...document.querySelectorAll('.project')]

// A card's text is fully shown until its center is this far (px) from the viewport center,
// then fades out by PANEL_FADE_END. Cards are 568px apart, so the fades just overlap
// and the panel is never empty.
const PANEL_HOLD = 200
const PANEL_FADE_END = 300

let activeId = null

function setActiveSection(id) {
  if (id === activeId) return
  activeId = id
  for (const [key, link] of navLinks) {
    if (key === id) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  }
}

function updateSections() {
  // The active section is the one crossing this line. It sits higher on mobile, where
  // the hero is short enough that the next section starts near the middle of the screen.
  const line = window.innerHeight * (desktop.matches ? 1 / 2 : 1 / 3)
  let current = sections[0]
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= line) current = section
  }
  // On a tall screen the footer can't scroll up to the line, so the end of the page counts too.
  const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1
  if (atEnd) current = sections[sections.length - 1]
  setActiveSection(current.id)
}

function updatePanel() {
  if (!panelLayout.matches) return
  const viewportCenter = window.innerHeight / 2
  for (const project of projects) {
    const rect = project.getBoundingClientRect()
    const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter)
    const reveal = (PANEL_FADE_END - distance) / (PANEL_FADE_END - PANEL_HOLD)
    project.style.setProperty('--reveal', Math.min(Math.max(reveal, 0), 1))
  }
}

let ticking = false

function update() {
  ticking = false
  if (root.dataset.place) return // the list is hidden, so there's nothing to measure
  updateSections()
  updatePanel()
}

function requestUpdate() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(update)
}

window.addEventListener('scroll', requestUpdate, { passive: true })
window.addEventListener('resize', requestUpdate)
desktop.addEventListener('change', requestUpdate)
update()

// Hero polaroid flip. A screen reader hears the handwritten note through the status line.
const heroPolaroid = document.querySelector('.hero-polaroid')
const heroFlipStatus = document.getElementById('hero-flip-status')
const heroNote = heroPolaroid.querySelector('.hero-polaroid-back').textContent

heroPolaroid.addEventListener('click', () => {
  const flipped = heroPolaroid.getAttribute('aria-pressed') !== 'true'
  heroPolaroid.setAttribute('aria-pressed', String(flipped))
  heroFlipStatus.textContent = flipped ? heroNote : ''
})

// Work card reveal, for screens without the side panel. Only one is open at a time.
function setRevealed(project, revealed) {
  project.classList.toggle('is-revealed', revealed)
  const toggle = project.querySelector('.info-toggle')
  toggle.setAttribute('aria-expanded', String(revealed))
  toggle.setAttribute('aria-label', revealed ? 'hide project details' : 'show project details')
}

function closeReveals(except) {
  for (const project of projects) {
    if (project !== except && project.classList.contains('is-revealed')) setRevealed(project, false)
  }
}

for (const project of projects) {
  project.querySelector('.info-toggle').addEventListener('click', () => {
    closeReveals(project)
    setRevealed(project, !project.classList.contains('is-revealed'))
  })
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  const open = document.querySelector('.project.is-revealed')
  if (!open) return
  setRevealed(open, false)
  open.querySelector('.info-toggle').focus()
})

panelLayout.addEventListener('change', () => {
  closeReveals()
  requestUpdate()
})

// Place pages. Each place has its own URL, and the list stays in the page behind it,
// so closing can bring back the exact spot it was opened from.
const placeLinks = new Map(
  [...document.querySelectorAll('a.polaroid-stack')].map((link) => [link.dataset.place, link]),
)
const placeViews = new Map(
  [...document.querySelectorAll('.place-view')].map((view) => [view.dataset.place, view]),
)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const siteTitle = document.title
const STACK_NAME = 'place-stack'

// Temporary: ?places=deck opens stacks as a card deck instead, to compare the two.
const placesDeck = isDeckMode() ? createPlacesDeck() : null

let currentPlace = null
let listScrollY = null
let transitionId = 0

for (const [slug, view] of placeViews) {
  view.querySelector('.place-view-stack').innerHTML = placeLinks.get(slug).innerHTML
  view.querySelectorAll('.place-photo').forEach((photo, i) => photo.style.setProperty('--i', i))
  view.querySelector('.place-view-close').addEventListener('click', closePlace)
}

function placeFromUrl() {
  const match = window.location.pathname.match(/^\/places\/([^/]+)\/?$/)
  return match && placeViews.has(match[1]) ? match[1] : null
}

function showPlace(slug) {
  const previous = currentPlace
  currentPlace = slug

  for (const [key, view] of placeViews) view.hidden = key !== slug

  if (slug) {
    root.dataset.place = slug
    document.title = `${placeViews.get(slug).querySelector('h1').textContent} · melanie joy tabroff`
    window.scrollTo({ top: 0, behavior: 'instant' })
    placeViews.get(slug).querySelector('h1').focus({ preventScroll: true })
    return
  }

  delete root.dataset.place
  document.title = siteTitle
  const link = placeLinks.get(previous)
  if (listScrollY === null) link.scrollIntoView({ block: 'center', behavior: 'instant' })
  else window.scrollTo({ top: listScrollY, behavior: 'instant' })
  link.focus({ preventScroll: true })
  history.scrollRestoration = 'auto'
  update()
}

// A lazy image that hasn't loaded yet would fly across the screen as a blank polaroid.
function stackImagesReady(stack) {
  const images = [...stack.querySelectorAll('img')]
  for (const image of images) image.loading = 'eager'
  const decoded = images.map((image) => image.decode().catch(() => {}))
  return Promise.race([Promise.all(decoded), new Promise((done) => setTimeout(done, 300))])
}

function clearStackMotion() {
  root.classList.remove('place-opening', 'place-closing')
  for (const stack of document.querySelectorAll('.polaroid-stack')) {
    stack.style.viewTransitionName = ''
  }
}

function goToPlace(slug, { animate = true } = {}) {
  if (slug === currentPlace) return

  const previous = currentPlace
  if (slug && !previous) listScrollY = window.scrollY

  clearStackMotion()
  for (const view of placeViews.values()) view.classList.remove('is-cascading')

  if (!animate) {
    showPlace(slug)
    return
  }

  // No View Transitions support: a plain fade on whatever is coming in.
  if (!document.startViewTransition) {
    showPlace(slug)
    const incoming = slug ? placeViews.get(slug) : document.getElementById('app')
    incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
    return
  }

  // Reduced motion, or one place straight to another: the default crossfade, nothing moves.
  if (reducedMotion.matches || (slug && previous)) {
    document.startViewTransition(() => showPlace(slug))
    return
  }

  const opening = Boolean(slug)
  const link = placeLinks.get(slug ?? previous)
  const thumb = placeViews.get(slug ?? previous).querySelector('.place-view-stack')
  const from = opening ? link : thumb
  const to = opening ? thumb : link

  root.classList.add(opening ? 'place-opening' : 'place-closing')
  from.style.viewTransitionName = STACK_NAME
  if (opening) placeViews.get(slug).classList.add('is-cascading')

  const id = ++transitionId
  const transition = document.startViewTransition(async () => {
    from.style.viewTransitionName = ''
    to.style.viewTransitionName = STACK_NAME
    showPlace(slug)
    await stackImagesReady(to)
  })
  transition.finished.finally(() => {
    if (id === transitionId) clearStackMotion()
  })
}

function closePlace() {
  // Opened from the list: step back, so the list isn't in the history twice.
  if (history.state?.fromList) {
    history.back()
    return
  }
  history.pushState(null, '', '/')
  goToPlace(null)
}

for (const [slug, link] of placeLinks) {
  link.addEventListener('click', (event) => {
    // Let a new-tab click or similar do what it normally does.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (placesDeck) {
      placesDeck.open(link, placeViews.get(slug))
      return
    }
    history.scrollRestoration = 'manual'
    history.pushState({ fromList: true }, '', link.pathname)
    goToPlace(slug)
  })
}

window.addEventListener('popstate', (event) => {
  // Safari's swipe back has already animated by now, so don't animate on top of it.
  goToPlace(placeFromUrl(), { animate: !event.hasUAVisualTransition })
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentPlace) closePlace()
})

const initialPlace = placeFromUrl()
if (initialPlace) {
  history.scrollRestoration = 'manual'
  showPlace(initialPlace)
} else {
  delete root.dataset.place
  if (window.location.pathname.startsWith('/places/')) history.replaceState(null, '', '/')
  update()
}

// The time in the footer, in case someone reads it far from NYC.
const nycTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

function updateNycTime() {
  const time = nycTime.format(new Date()).replace(/\s/g, '').toLowerCase()
  document.getElementById('nyc-time').textContent = time
}

updateNycTime()
setInterval(updateNycTime, 30000)

// Theme. The inline script in index.html sets the starting theme before first paint.
const THEME_KEY = 'theme'
const toggles = [...document.querySelectorAll('.theme-toggle')]
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme) {
  root.dataset.theme = theme
  const next = theme === 'dark' ? 'light' : 'dark'
  for (const toggle of toggles) toggle.setAttribute('aria-label', `switch to ${next} mode`)
}

// Storage can throw in private windows or when site data is blocked.
function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // The toggle still works for this visit.
  }
}

for (const toggle of toggles) {
  toggle.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    saveTheme(theme)
    applyTheme(theme)
  })
}

// Keep following the system setting until the visitor makes their own choice.
systemDark.addEventListener('change', (event) => {
  if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light')
})

applyTheme(root.dataset.theme)
