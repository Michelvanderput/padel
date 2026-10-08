import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Optionele wachtwoordbeveiliging. Zet APP_PASSWORD in Vercel (Settings → Environment Variables)
 * om alle data-API's (leden, reserveringen, instellingen/token) achter een login te zetten.
 * Zonder APP_PASSWORD blijft alles open — zoals voorheen.
 *
 * Sessie: een HttpOnly-cookie met een HMAC van het wachtwoord. Geen serverstatus nodig; wijzig je
 * het wachtwoord, dan zijn alle bestaande sessies meteen ongeldig.
 */
export const COOKIE = 'pm_session'
const MAX_AGE = 30 * 24 * 60 * 60   // 30 dagen

export const isProtected = () => !!process.env.APP_PASSWORD

const sessionToken = () => createHmac('sha256', process.env.APP_PASSWORD).update('padel-maatjes-session-v1').digest('hex')

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers?.cookie ?? ''
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i !== -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

export const isAuthorized = req => !isProtected() || safeEqual(readCookie(req) ?? '', sessionToken())

export const passwordOk = pw => isProtected() && typeof pw === 'string' && safeEqual(pw, process.env.APP_PASSWORD)

export function sessionCookie(clear = false) {
  const base = `${COOKIE}=${clear ? '' : sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Strict`
  return clear ? `${base}; Max-Age=0` : `${base}; Max-Age=${MAX_AGE}`
}

/** Handler-wrapper: 401 zonder geldige sessie (alleen als beveiliging aan staat). */
export function withAuth(fn) {
  return async function handler(req, res) {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Niet ingelogd' })
    return fn(req, res)
  }
}
