// Scroll-driven behavior (active nav state, avatar placement, work side panel),
// the work card reveal, and the theme toggle.
// (Still to come later: weather widget.)

const app = document.getElementById('app')
const heroAvatar = document.querySelector('.hero-avatar')
const sections = [...document.querySelectorAll('main > section[id]')]
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
  setActiveSection(current.id)
}

function updateAvatar() {
  const heroAvatarGone = heroAvatar.getBoundingClientRect().bottom <= 0
  app.classList.toggle('is-scrolled', activeId !== 'about' || heroAvatarGone)
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
  updateSections()
  updateAvatar()
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

// Theme. The inline script in index.html sets the starting theme before first paint.
const THEME_KEY = 'theme'
const root = document.documentElement
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
