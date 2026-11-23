import { redis } from '../../server/store.js'
import { withLock } from '../../server/lock.js'
import { withErrors } from '../../server/handler.js'

const KEY = 'knltb:members'
const LOCK = 'knltb:members:lock'
const EDITABLE = ['name', 'memberNumber', 'clubMemberId']   // id en andere velden laten we onaangeroerd

export default withErrors(async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PATCH') {
    const result = await withLock(redis, LOCK, async () => {
      const members = (await redis.get(KEY)) ?? []
      const member = members.find(m => m.id === id)
      if (!member) return null
      for (const field of EDITABLE) if (field in (req.body ?? {})) member[field] = req.body[field]
      await redis.set(KEY, members)
      return member
    })
    return result ? res.json(result) : res.status(404).json({ error: 'Not found' })
  }

  if (req.method === 'DELETE') {
    const found = await withLock(redis, LOCK, async () => {
      const members = (await redis.get(KEY)) ?? []
      const idx = members.findIndex(m => m.id === id)
      if (idx === -1) return false
      members.splice(idx, 1)
      await redis.set(KEY, members)
      return true
    })
    return found ? res.status(204).end() : res.status(404).json({ error: 'Not found' })
  }

  res.status(405).end()
})
