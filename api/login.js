import { withErrors } from '../server/handler.js'
import { isProtected, isAuthorized, passwordOk, sessionCookie } from '../server/auth.js'

// Vertraagt wachtwoord-raden: elke foute poging kost een halve seconde.
const sleep = ms => new Promise(r => setTimeout(r, ms))

export default withErrors(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  // GET: is de app beveiligd, en ben ik ingelogd?
  if (req.method === 'GET') {
    return res.json({ protected: isProtected(), authed: isAuthorized(req) })
  }

  if (req.method === 'POST') {
    if (!isProtected()) return res.json({ protected: false, authed: true })
    if (passwordOk(req.body?.password)) {
      res.setHeader('Set-Cookie', sessionCookie())
      return res.json({ protected: true, authed: true })
    }
    await sleep(500)
    return res.status(401).json({ error: 'Onjuist wachtwoord' })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', sessionCookie(true))
    return res.json({ protected: isProtected(), authed: false })
  }

  res.status(405).end()
})
