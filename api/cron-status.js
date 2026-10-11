import { withErrors } from '../server/handler.js'
import { redis, HEARTBEAT_KEY } from '../server/store.js'

// GET /api/cron-status — wanneer is de externe cron voor het laatst langsgekomen?
export default withErrors(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const last = await redis.get(HEARTBEAT_KEY)
  const lastTickMs = typeof last === 'number' ? last : Number(last) || null
  res.json({ lastTickMs, agoSec: lastTickMs ? Math.round((Date.now() - lastTickMs) / 1000) : null })
})
