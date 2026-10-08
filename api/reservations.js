import { withErrors } from '../server/handler.js'
import { withAuth } from '../server/auth.js'
import { redis, RES_KEY, META_KEY, buildMeta, readMeta, readReservations, writeReservations } from '../server/store.js'

export default withErrors(withAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    // Conditional GET: bij ongewijzigde data lezen we alleen het kleine meta-sleutelje en
    // sturen 304 — de browser levert dan zelf zijn kopie. Dat bespaart de Redis-bandbreedte.
    let meta = await readMeta()
    const etag = meta ? `"${meta.rev}"` : null
    res.setHeader('Cache-Control', 'no-cache')
    if (etag && req.headers['if-none-match'] === etag) {
      res.setHeader('ETag', etag)
      return res.status(304).end()
    }

    const data = await readReservations()
    if (!meta) {   // eerste keer na deze update: meta aanmaken
      meta = buildMeta(data)
      await redis.set(META_KEY, meta)
    }
    res.setHeader('ETag', `"${meta.rev}"`)
    return res.json(data)
  }

  if (req.method === 'POST') {
    const reservations = await readReservations()
    reservations.push(req.body)
    await writeReservations(reservations)
    return res.status(201).json(req.body)
  }

  res.status(405).end()
}))
