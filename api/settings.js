import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'knltb:settings'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await redis.get(KEY) ?? null
    return res.json(data)
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const current = await redis.get(KEY) ?? {}
    const updated = { ...current, ...req.body }
    await redis.set(KEY, updated)
    return res.json(updated)
  }

  res.status(405).end()
}
