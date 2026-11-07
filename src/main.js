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
const firstCard = document.querySelector('.work-card')

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
    cardTop: top(firstCard),
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

let ticking = false

function update() {
  ticking = false
  if (!layout) measure()
  const { scrollY, innerHeight } = window
  siteNav.classList.toggle('is-past-hero', layout.heroBottom <= scrollY)
  // The mobile top bar is clear over the hero and fills in once the first card reaches it.
  siteNav.classList.toggle('is-over-content', layout.cardTop < scrollY + layout.navHeight)
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
window.addEventListener('resize', remeasure)
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
