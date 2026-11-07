// Scroll-driven behavior (active nav state, work side panel), the hero polaroid flip,
// the work card reveal, and the theme toggle. The places deck is in places-deck.js.

import { initHubLoop } from './hub-loop.js'
import { initPlacesDeck } from './places-deck.js'
import { initTitanLoop } from './titan-loop.js'
import { initWebsiteLoop } from './website-loop.js'
import { initConciergeLoop } from './concierge-loop.js'
import { initWeather } from './weather.js'
import { initAllaraLoop } from './allara-loop.js'
import { initSmartCash } from './smartcash-loop.js'
import { initSwapLoop } from './swap-loop.js'
import { initRebrandCard } from './rebrand-loop.js'

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
const siteNav = document.querySelector('.site-nav')
const hero = document.querySelector('.hero')
const heroPolaroid = document.querySelector('.hero-polaroid')

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

// Where things sit on the page, measured only when the layout changes. Scrolling then reads
// nothing but scrollY, so it never forces a layout while the card animations are running.
let layout = null

function measure() {
  const top = (element) => element.getBoundingClientRect().top + window.scrollY
  layout = {
    heroBottom: hero.getBoundingClientRect().bottom + window.scrollY,
    polaroidTop: top(heroPolaroid),
    navHeight: siteNav.offsetHeight,
    sectionTops: sections.map(top),
    projectCenters: projects.map((project) => top(project) + project.offsetHeight / 2),
    pageHeight: document.documentElement.scrollHeight,
  }
}

function updateSections(scrollY, viewportHeight) {
  // The active section is the one crossing this line. It sits higher on mobile, where
  // the hero is short enough that the next section starts near the middle of the screen.
  const line = scrollY + viewportHeight * (desktop.matches ? 1 / 2 : 1 / 3)
  let current = 0
  layout.sectionTops.forEach((top, index) => {
    if (top <= line) current = index
  })
  // On a tall screen the footer can't scroll up to the line, so the end of the page counts too.
  if (scrollY + viewportHeight >= layout.pageHeight - 1) current = sections.length - 1
  setActiveSection(sections[current].id)
}

function updatePanel(scrollY, viewportHeight) {
  if (!panelLayout.matches) return
  const viewportCenter = scrollY + viewportHeight / 2
  projects.forEach((project, index) => {
    const distance = Math.abs(layout.projectCenters[index] - viewportCenter)
    const reveal = (PANEL_FADE_END - distance) / (PANEL_FADE_END - PANEL_HOLD)
    project.style.setProperty('--reveal', Math.min(Math.max(reveal, 0), 1))
    project.classList.toggle('is-panel-shown', reveal > 0)
  })
}

// The mobile top bar fills in as soon as the hero polaroid, the first thing under it, starts
// to pass beneath it: on once the polaroid's top is within BAR_ON of the bar's bottom edge, and
// off again only once it's BAR_OFF clear, so it can't flicker at the line. Always clear at the top.
const BAR_ON = 4
const BAR_OFF = 8

function isOverContent(scrollY) {
  if (scrollY <= 0) return false
  const gap = layout.polaroidTop - scrollY - layout.navHeight // polaroid top to the bar's bottom
  const wasOn = siteNav.classList.contains('is-over-content')
  return wasOn ? gap < BAR_OFF : gap <= BAR_ON
}

let ticking = false

function update() {
  ticking = false
  if (!layout) measure()
  const { scrollY, innerHeight } = window
  siteNav.classList.toggle('is-past-hero', layout.heroBottom <= scrollY)
  // The mobile top bar is clear over the hero and fills in once the first card reaches it.
  siteNav.classList.toggle('is-over-content', isOverContent(scrollY))
  updateSections(scrollY, innerHeight)
  updatePanel(scrollY, innerHeight)
}

function requestUpdate() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(update)
}

function remeasure() {
  layout = null
  requestUpdate()
}

window.addEventListener('scroll', requestUpdate, { passive: true })
desktop.addEventListener('change', () => {
  remeasure()
  // An open description holds its card only on mobile, so crossing the breakpoint changes that.
  for (const project of projects) project.dispatchEvent(new Event('revealchange'))
})
// Covers resizes, fonts and images settling in, and the hero growing when the polaroid flips.
new ResizeObserver(remeasure).observe(document.body)
// Only a change of width can move anything: heights here use svh, so iOS Safari's toolbar
// sliding away mid-scroll (a height-only resize) leaves the layout, and these measurements, as they are.
let viewportWidth = window.innerWidth
window.addEventListener('resize', () => {
  if (window.innerWidth === viewportWidth) return
  viewportWidth = window.innerWidth
  remeasure()
})
update()

// Nav links on a touch screen: a quick eased scroll to the section. With a mouse or trackpad
// the CSS's scroll-behavior: smooth already does this, and with reduced motion the link just
// jumps. Each section's scroll-margin-top keeps it clear of the top bar. A touch or wheel
// during the scroll stops it, so it never fights a finger.
const finePointer = window.matchMedia('(pointer: fine)')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const NAV_SCROLL_MS = 450
let navScroll = null

function stopNavScroll() {
  if (navScroll) cancelAnimationFrame(navScroll)
  navScroll = null
}

function scrollToSection(section) {
  stopNavScroll()
  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0
  const maxY = document.documentElement.scrollHeight - window.innerHeight
  const to = Math.min(Math.max(section.getBoundingClientRect().top + window.scrollY - margin, 0), maxY)
  const from = window.scrollY
  const start = performance.now()
  const step = (now) => {
    const t = Math.min((now - start) / NAV_SCROLL_MS, 1)
    const eased = 1 - (1 - t) ** 3 // ease-out
    window.scrollTo(0, from + (to - from) * eased)
    navScroll = t < 1 ? requestAnimationFrame(step) : null
  }
  navScroll = requestAnimationFrame(step)
}

for (const link of navLinks.values()) {
  link.addEventListener('click', (event) => {
    if (finePointer.matches || reducedMotion.matches) return
    const section = document.getElementById(link.hash.slice(1))
    if (!section) return
    event.preventDefault()
    history.pushState(null, '', link.hash)
    scrollToSection(section)
  })
}

window.addEventListener('touchstart', stopNavScroll, { passive: true })
window.addEventListener('wheel', stopNavScroll, { passive: true })

// Hero polaroid flip. A screen reader hears the handwritten note through the status line.
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
  project.dispatchEvent(new Event('revealchange')) // pauses or resumes the card, on mobile
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

initPlacesDeck()
initWeather()
initHubLoop()
initTitanLoop()
initWebsiteLoop()
initConciergeLoop()
initAllaraLoop()
initSmartCash()
initSwapLoop()
initRebrandCard()

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
