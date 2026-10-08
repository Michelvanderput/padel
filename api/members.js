import { Redis } from '@upstash/redis'
import { withErrors } from '../server/handler.js'
import { withAuth } from '../server/auth.js'
import { applyRoster } from '../server/roster.js'

const redis = Redis.fromEnv()
const KEY = 'knltb:members'
const ROSTER_FLAG = 'knltb:members:roster-v1'

const DEFAULT_MEMBERS = [
  { id: '5331bbd0-1993-4fff-b3d8-46950b4ea031', name: 'Sander van Dijk',    memberNumber: '', clubMemberId: '5331bbd0-1993-4fff-b3d8-46950b4ea031' },
  { id: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92', name: 'Eddie van Leuven',   memberNumber: '', clubMemberId: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92' },
  { id: '7698101b-b3d6-4e49-b282-cf6a39346834', name: 'Lerau Seyben',        memberNumber: '', clubMemberId: '7698101b-b3d6-4e49-b282-cf6a39346834' },
  { id: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df', name: 'Michel van der Put', memberNumber: '', clubMemberId: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df' },
]

// Eenmalige merge van de bekende leden (server/roster.js). De NX-flag zorgt dat
// maar één request dit doet, en dat een later verwijderd lid niet terugkomt.
async function mergeRosterOnce(members) {
  const first = await redis.set(ROSTER_FLAG, '1', { nx: true })
  if (!first) return members
  try {
    const { members: merged, changed } = applyRoster(members)
    if (changed) await redis.set(KEY, merged)
    return merged
  } catch (e) {
    await redis.del(ROSTER_FLAG)
    throw e
  }
}

export default withErrors(withAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    let members = await redis.get(KEY)
    if (!members || members.length === 0) {
      members = DEFAULT_MEMBERS
      await redis.set(KEY, members)
    }
    members = await mergeRosterOnce(members)
    return res.json(members)
  }

  if (req.method === 'POST') {
    const members = await redis.get(KEY) ?? []
    members.push(req.body)
    await redis.set(KEY, members)
    return res.status(201).json(req.body)
  }

  res.status(405).end()
}))
