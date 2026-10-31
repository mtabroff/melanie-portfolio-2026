// Scroll-driven behavior (active nav state, avatar placement) and the theme toggle.
// (Still to come later: weather widget, work-section text fade.)

const app = document.getElementById('app')
const heroAvatar = document.querySelector('.hero-avatar')
const sections = [...document.querySelectorAll('main > section[id]')]
const navLinks = new Map(
  [...document.querySelectorAll('[data-nav]')].map((link) => [link.dataset.nav, link]),
)

// Matches the shell breakpoint in style.css.
const desktop = window.matchMedia('(min-width: 960px)')

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

let ticking = false

function update() {
  ticking = false
  updateSections()
  updateAvatar()
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
