// Temporary switches for tracking down scroll performance on a real phone. Each URL parameter
// turns one feature off, and they combine: /?novideo&noanim. The inline script in index.html
// reads them before first paint and marks the page with a debug-no<feature> class; the CSS for the
// visual ones is at the end of style.css. With no parameters, nothing changes.
export function debugOff(feature) {
  return document.documentElement.classList.contains(`debug-no${feature}`) // debugOff('video') for ?novideo
}
