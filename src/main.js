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

// The active nav link: the last section whose top has passed a line a third of the way down a
// phone screen, or halfway down a wider one. Each section is watched against everything above
// that line, so a section counts as soon as its top passes it, however fast the page moves. The
// end of the page counts for the last section, since on a tall screen it can't reach the line.
const onLine = new Set()
let atPageEnd = false

function showActiveSection() {
  const current = atPageEnd ? sections.at(-1) : sections.findLast((section) => onLine.has(section))
  if (current) setActiveSection(current.id)
}

let sectionWatcher = null

function watchSections() {
  sectionWatcher?.disconnect()
  onLine.clear()
  const line = desktop.matches ? 50 : 100 / 3
  sectionWatcher = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onLine.add(entry.target)
        else onLine.delete(entry.target)
      }
      showActiveSection()
    },
    { rootMargin: `10000% 0px ${line - 100}% 0px` },
  )
  sections.forEach((section) => sectionWatcher.observe(section))
}

// The page's last pixel: 1px tall but pulled up over the end of the page, so it adds no height.
const pageEnd = Object.assign(document.createElement('div'), { style: 'height: 1px; margin-top: -1px' })
document.getElementById('main').append(pageEnd)
new IntersectionObserver(([entry]) => {
  atPageEnd = entry.isIntersecting
  showActiveSection()
}).observe(pageEnd)

watchSections()

// The mobile top bar is clear over the hero, and fills with the page color once the hero starts
// to pass under it. The hero is watched against the screen below the bar (and well past the
// bottom, so only its top edge matters): fully inside means nothing has scrolled under the bar yet.
let barWatcher = null

function watchBar() {
  barWatcher?.disconnect()
  const barHeight = desktop.matches ? 0 : siteNav.offsetHeight
  barWatcher = new IntersectionObserver(
    ([entry]) => {
      siteNav.classList.toggle('is-over-content', entry.intersectionRatio < 1)
      syncThemeColor()
    },
    { rootMargin: `-${barHeight}px 0px 100% 0px`, threshold: 1 },
  )
  barWatcher.observe(hero)
}

// The browser's toolbar color follows what's under the top bar, so Safari doesn't keep sampling
// the page to tint it: the hero's top edge while the bar is clear, the page color once it fills.
// Both theme-color tags get it, since the theme toggle can override the system setting.
const themeColorTags = [...document.querySelectorAll('meta[name="theme-color"]')]

function syncThemeColor() {
  const token = siteNav.classList.contains('is-over-content') ? '--surface-z0' : '--surface-hero-top'
  const color = getComputedStyle(root).getPropertyValue(token).trim()
  if (color) themeColorTags.forEach((tag) => tag.setAttribute('content', color))
}

watchBar()

// The work side panel, on wide screens: each card's text fades with its distance from the
// middle of the screen, so it's the one scroll-driven thing left. Positions are measured when
// the layout changes, and scrolling reads only scrollY.
let projectCenters = null
let ticking = false

function updatePanel() {
  ticking = false
  if (!panelLayout.matches) return
  projectCenters ??= projects.map((project) => {
    return project.getBoundingClientRect().top + window.scrollY + project.offsetHeight / 2
  })
  const viewportCenter = window.scrollY + window.innerHeight / 2
  projects.forEach((project, index) => {
    const distance = Math.abs(projectCenters[index] - viewportCenter)
    const reveal = (PANEL_FADE_END - distance) / (PANEL_FADE_END - PANEL_HOLD)
    project.style.setProperty('--reveal', Math.min(Math.max(reveal, 0), 1))
    project.classList.toggle('is-panel-shown', reveal > 0)
  })
}

function requestPanelUpdate() {
  if (ticking || !panelLayout.matches) return
  ticking = true
  requestAnimationFrame(updatePanel)
}

window.addEventListener('scroll', requestPanelUpdate, { passive: true })
new ResizeObserver(() => {
  projectCenters = null
  requestPanelUpdate()
}).observe(document.body)
requestPanelUpdate()

desktop.addEventListener('change', () => {
  watchSections()
  watchBar()
  // An open description holds its card only on mobile, so crossing the breakpoint changes that.
  for (const project of projects) project.dispatchEvent(new Event('revealchange'))
})

// Nav links: a quick eased scroll to the section wherever the browser isn't already smooth
// scrolling it. The CSS turns scroll-behavior: smooth on only for a mouse or trackpad, so this
// covers phones, without relying on how a phone reports its pointer. With reduced motion the
// link just jumps. Each section's scroll-margin-top keeps it clear of the top bar. A touch or
// wheel during the scroll stops it, so it never fights a finger.
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
    const cssSmooth = getComputedStyle(root).scrollBehavior === 'smooth'
    showLayout(`tap ${link.hash}: ${reducedMotion.matches ? 'jump (reduced motion)' : cssSmooth ? 'css smooth scroll' : `glide ${NAV_SCROLL_MS}ms`}`)
    if (reducedMotion.matches || cssSmooth) return
    const section = document.getElementById(link.hash.slice(1))
    if (!section) return
    event.preventDefault()
    history.pushState(null, '', link.hash)
    scrollToSection(section)
  })
}

window.addEventListener('touchstart', stopNavScroll, { passive: true })
window.addEventListener('wheel', stopNavScroll, { passive: true })

// ?showlayout: a small panel with what the phone actually reports, for debugging on a device.
function showLayout(note) {
  if (!root.classList.contains('debug-showlayout')) return
  let panel = document.getElementById('layout-panel')
  if (!panel) {
    panel = Object.assign(document.createElement('pre'), { id: 'layout-panel' })
    document.body.append(panel)
  }
  const unit = (u) => {
    const probe = Object.assign(document.createElement('div'), { style: `position:absolute;height:100${u}` })
    document.body.append(probe)
    const height = probe.offsetHeight
    probe.remove()
    return height
  }
  const box = (selector) => document.querySelector(selector).getBoundingClientRect()
  const nav = box('.site-nav'), hero = box('.hero'), card = box('.hero-polaroid-tilt'), firstCard = box('.work-card')
  const media = (query) => (window.matchMedia(query).matches ? 'yes' : 'no')
  panel.textContent = [
    `innerHeight ${window.innerHeight}  visualViewport ${Math.round(window.visualViewport?.height ?? 0)}`,
    `svh ${unit('svh')}  lvh ${unit('lvh')}  dvh ${unit('dvh')}`,
    `pointer:fine ${media('(pointer: fine)')}  hover ${media('(hover: hover)')}  reduce motion ${media('(prefers-reduced-motion: reduce)')}`,
    // As at the top of the page, wherever it's scrolled.
    `hero ${Math.round(hero.height)}  polaroid below bar ${Math.round(card.top + window.scrollY - nav.height)}  card peek ${Math.round(window.innerHeight - firstCard.top - window.scrollY)}`,
    note ? `last: ${note}` : panel.textContent.split('\n').find((line) => line.startsWith('last:')) ?? '',
  ].join('\n')
}

if (root.classList.contains('debug-showlayout')) {
  window.addEventListener('load', () => showLayout())
}

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
  projectCenters = null
  requestPanelUpdate()
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
  syncThemeColor()
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
