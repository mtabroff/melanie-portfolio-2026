// Scroll-driven behavior (active nav state, work side panel), the hero polaroid flip,
// the work card reveal, and the theme toggle. The places deck is in places-deck.js.
// (Still to come later: weather widget.)

import { initHubLoop } from './hub-loop.js'
import { initPlacesDeck } from './places-deck.js'
import { initTitanLoop } from './titan-loop.js'
import { initWebsiteLoop } from './website-loop.js'
import { initConciergeLoop } from './concierge-loop.js'
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
    project.classList.toggle('is-panel-shown', reveal > 0)
  }
}

let ticking = false

function update() {
  ticking = false
  siteNav.classList.toggle('is-past-hero', hero.getBoundingClientRect().bottom <= 0)
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

initPlacesDeck()
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
