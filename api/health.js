import { Redis } from '@upstash/redis'
import { withErrors } from '../server/handler.js'

// GET /api/health — controleert of Redis bereikbaar is (geen geheimen in de respons).
export default withErrors(async (req, res) => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  const out = {
    env: { url: !!url, token: !!token, host: url ? new URL(url).host : null },
    redis: null,
  }
  if (url && token) {
    try {
      const t0 = Date.now()
      const pong = await new Redis({ url, token }).ping()
      out.redis = { ok: true, ping: pong, ms: Date.now() - t0 }
    } catch (e) {
      out.redis = { ok: false, error: e?.message ?? String(e) }
    }
  }
  res.status(out.redis?.ok ? 200 : 503).json(out)
})
