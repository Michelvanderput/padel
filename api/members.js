import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const KEY = 'knltb:members'

const DEFAULT_MEMBERS = [
  { id: '5331bbd0-1993-4fff-b3d8-46950b4ea031', name: 'Sander van Dijk',    memberNumber: '', clubMemberId: '5331bbd0-1993-4fff-b3d8-46950b4ea031' },
  { id: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92', name: 'Eddie van Leuven',   memberNumber: '', clubMemberId: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92' },
  { id: '7698101b-b3d6-4e49-b282-cf6a39346834', name: 'Lerau Seyben',        memberNumber: '', clubMemberId: '7698101b-b3d6-4e49-b282-cf6a39346834' },
  { id: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df', name: 'Michel van der Put', memberNumber: '', clubMemberId: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df' },
]

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let members = await redis.get(KEY)
    if (!members || members.length === 0) {
      members = DEFAULT_MEMBERS
      await redis.set(KEY, members)
    }
    return res.json(members)
  }

  if (req.method === 'POST') {
    const members = await redis.get(KEY) ?? []
    members.push(req.body)
    await redis.set(KEY, members)
    return res.status(201).json(req.body)
  }

  res.status(405).end()
}
