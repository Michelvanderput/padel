import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'knltb:members'

export default async function handler(req, res) {
  const { id } = req.query
  const members = await redis.get(KEY) ?? []
  const idx = members.findIndex(m => m.id === id)

  if (req.method === 'PATCH') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    Object.assign(members[idx], req.body)
    await redis.set(KEY, members)
    return res.json(members[idx])
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    members.splice(idx, 1)
    await redis.set(KEY, members)
    return res.status(204).end()
  }

  res.status(405).end()
}
