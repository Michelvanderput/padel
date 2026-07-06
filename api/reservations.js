import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'knltb:reservations'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await redis.get(KEY) ?? []
    return res.json(data)
  }

  if (req.method === 'POST') {
    const reservations = await redis.get(KEY) ?? []
    reservations.push(req.body)
    await redis.set(KEY, reservations)
    return res.status(201).json(req.body)
  }

  res.status(405).end()
}
