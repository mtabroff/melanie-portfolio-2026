// The weather in the corner: the current temperature in NYC from Open-Meteo, cached for 30
// minutes. If it can't be fetched, the line stays hidden rather than showing anything made up.

import sun from './assets/weather/sun.svg'
import moon from './assets/weather/moon.svg'
import cloudSun from './assets/weather/cloud-sun.svg'
import cloudMoon from './assets/weather/cloud-moon.svg'
import cloud from './assets/weather/cloud.svg'
import fog from './assets/weather/cloud-fog.svg'
import rain from './assets/weather/cloud-rain.svg'
import snow from './assets/weather/cloud-snow.svg'
import storm from './assets/weather/cloud-lightning.svg'

const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=40.7831&longitude=-73.9712&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit&timezone=America/New_York'
const CACHE_KEY = 'weather'
const CACHE_MS = 30 * 60 * 1000

// WMO weather codes. Phosphor has no drizzle icon, so drizzle uses the rain cloud.
function iconFor(code, isDay) {
  if (code === 0) return isDay ? sun : moon
  if (code <= 2) return isDay ? cloudSun : cloudMoon
  if (code === 3) return cloud
  if (code === 45 || code === 48) return fog
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return rain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return snow
  if (code >= 95) return storm
  return cloud
}

function cached() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY))
    return saved && Date.now() - saved.time < CACHE_MS ? saved.current : null
  } catch {
    return null
  }
}

function cache(current) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), current }))
  } catch {
    // It just fetches again next time.
  }
}

export async function initWeather() {
  const line = document.querySelector('.weather-temp')
  if (!line) return
  let current = cached()
  if (!current) {
    try {
      const response = await fetch(URL)
      if (!response.ok) throw new Error(response.status)
      current = (await response.json()).current
      if (typeof current?.temperature_2m !== 'number') throw new Error('no temperature')
      cache(current)
    } catch {
      return
    }
  }
  line.querySelector('.weather-text').textContent = `${Math.round(current.temperature_2m)}°F in NYC`
  line.querySelector('.weather-icon').style.setProperty('--weather-icon', `url("${iconFor(current.weather_code, current.is_day === 1)}")`)
  line.classList.add('is-ready')
}
