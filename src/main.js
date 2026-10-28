// Scroll-driven behavior: active nav state, avatar placement, and the work-section text fade.
// (Still to come later: weather widget, dark mode.)

const app = document.getElementById('app')
const nav = document.querySelector('.site-nav')
const heroAvatar = document.querySelector('.hero-avatar')
const sections = [...document.querySelectorAll('main > section[id]')]
const navLinks = new Map(
  [...document.querySelectorAll('[data-nav]')].map((link) => [link.dataset.nav, link]),
)
const projects = [...document.querySelectorAll('.project')]

// The side-by-side layout (and therefore the fade) only exists at this width; see style.css.
const desktop = window.matchMedia('(min-width: 1200px)')

// How long a project must stay in/out of center before its text changes.
// Stops flicker when someone scrolls back and forth right at the trigger point.
const SETTLE_MS = 150

let activeId = null

function setActiveSection(id) {
  if (id === activeId) return
  activeId = id
  for (const [key, link] of navLinks) {
    if (key === id) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  }
}

function updateSections(viewportMid) {
  // The active section is the one crossing the middle of the viewport.
  let current = sections[0]
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= viewportMid) current = section
  }
  setActiveSection(current.id)
}

function updateAvatar() {
  // On small screens the sticky top bar covers the top of the page, so treat
  // the hero avatar as "gone" once it slides under the bar.
  const topInset = getComputedStyle(nav).position === 'sticky' ? nav.offsetHeight : 0
  const heroAvatarGone = heroAvatar.getBoundingClientRect().bottom <= topInset
  app.classList.toggle('is-scrolled', activeId !== 'about' || heroAvatarGone)
}

const pending = new WeakMap()

function updateProjects(viewportMid) {
  for (const project of projects) {
    const rect = project.getBoundingClientRect()
    const centered = desktop.matches && rect.top <= viewportMid && rect.bottom >= viewportMid
    const showing = project.classList.contains('is-centered')

    if (centered === showing) {
      // Back to where it was before the change settled, so cancel the change.
      clearTimeout(pending.get(project))
      pending.delete(project)
      continue
    }
    if (pending.has(project)) continue

    pending.set(
      project,
      setTimeout(() => {
        pending.delete(project)
        project.classList.toggle('is-centered', centered)
      }, SETTLE_MS),
    )
  }
}

let ticking = false

function update() {
  ticking = false
  const viewportMid = window.innerHeight / 2
  updateSections(viewportMid)
  updateAvatar()
  updateProjects(viewportMid)
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
