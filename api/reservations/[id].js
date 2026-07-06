import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'knltb:reservations'

export default async function handler(req, res) {
  const { id } = req.query
  const reservations = await redis.get(KEY) ?? []
  const idx = reservations.findIndex(r => r.id === id)

  if (req.method === 'PATCH') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    Object.assign(reservations[idx], req.body)
    await redis.set(KEY, reservations)
    return res.json(reservations[idx])
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    reservations.splice(idx, 1)
    await redis.set(KEY, reservations)
    return res.status(204).end()
  }

  res.status(405).end()
}
