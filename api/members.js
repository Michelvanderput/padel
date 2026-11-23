import { redis } from '../server/store.js'
import { withLock } from '../server/lock.js'
import { withErrors } from '../server/handler.js'
import { applyRoster } from '../server/roster.js'

const KEY = 'knltb:members'
const LOCK = 'knltb:members:lock'
const ROSTER_FLAG = 'knltb:members:roster-v1'
const SEEDED_FLAG = 'knltb:members:seeded'

const DEFAULT_MEMBERS = [
  { id: '5331bbd0-1993-4fff-b3d8-46950b4ea031', name: 'Sander van Dijk',    memberNumber: '', clubMemberId: '5331bbd0-1993-4fff-b3d8-46950b4ea031' },
  { id: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92', name: 'Eddie van Leuven',   memberNumber: '', clubMemberId: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92' },
  { id: '7698101b-b3d6-4e49-b282-cf6a39346834', name: 'Lerau Seyben',        memberNumber: '', clubMemberId: '7698101b-b3d6-4e49-b282-cf6a39346834' },
  { id: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df', name: 'Michel van der Put', memberNumber: '', clubMemberId: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df' },
]

// De standaardleden worden hooguit één keer ooit geplaatst (eerste gebruik van een lege database).
// Is de lijst daarna leeg of weg, dan blijft hij leeg: stilzwijgend terugzetten laat verwijderde
// leden terugkomen en verbergt dat er gegevens kwijt zijn.
async function loadOrSeed() {
  const current = await redis.get(KEY)
  if (current != null) return current
  return withLock(redis, LOCK, async () => {
    const again = await redis.get(KEY)
    if (again != null) return again
    const firstTime = await redis.set(SEEDED_FLAG, '1', { nx: true })
    if (!firstTime) {
      console.warn('[members] ledenlijst ontbreekt terwijl hij eerder gevuld was; niet opnieuw geplaatst')
      return []
    }
    await redis.set(KEY, DEFAULT_MEMBERS)
    return DEFAULT_MEMBERS
  })
}

// Eenmalige merge van de bekende leden (server/roster.js). De NX-flag zorgt dat
// maar één request dit doet, en dat een later verwijderd lid niet terugkomt.
async function mergeRosterOnce() {
  if (await redis.get(ROSTER_FLAG)) return null
  return withLock(redis, LOCK, async () => {
    const first = await redis.set(ROSTER_FLAG, '1', { nx: true })
    if (!first) return null
    try {
      const { members, changed } = applyRoster((await redis.get(KEY)) ?? [])
      if (changed) await redis.set(KEY, members)
      return members
    } catch (e) {
      await redis.del(ROSTER_FLAG)
      throw e
    }
  })
}

export default withErrors(async function handler(req, res) {
  if (req.method === 'GET') {
    const members = await loadOrSeed()
    return res.json((await mergeRosterOnce()) ?? members)
  }

  if (req.method === 'POST') {
    const member = req.body
    if (!member?.id || !member?.name) return res.status(400).json({ error: 'id en name zijn verplicht' })
    await withLock(redis, LOCK, async () => {
      const members = (await redis.get(KEY)) ?? []
      if (!members.some(m => m.id === member.id)) {   // dubbel versturen mag niet dubbel toevoegen
        members.push(member)
        await redis.set(KEY, members)
      }
    })
    return res.status(201).json(member)
  }

  res.status(405).end()
})
