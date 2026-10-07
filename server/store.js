import { Redis } from '@upstash/redis'

export const redis = Redis.fromEnv()

export const RES_KEY  = 'knltb:reservations'
export const META_KEY = 'knltb:reservations:meta'

const MAX_LOGS     = 40                      // per reservering; oudere regels vallen af
const KEEP_DONE_MS = 45 * 24 * 60 * 60 * 1000 // afgeronde reserveringen blijven 45 dagen na de speeldatum

/**
 * Waarom een apart "meta"-sleutelje?
 * De reserveringenlijst is één groot JSON-bestand. Elke poll of cron-tick die hem volledig
 * leest kost bandbreedte (Upstash rekent die). Meta is een paar tientallen bytes en zegt:
 *   rev      — verandert bij elke schrijfactie (voor ETag / 304 in GET /api/reservations)
 *   nextDue  — ms-timestamp van het eerstvolgende boekmoment van een 'pending' reservering
 *   hasActive— is er een 'active' reservering (die de cron moet blijven oppakken)
 * Zo kan de cron in 1 kleine read besluiten dat er niets te doen is.
 */
export function buildMeta(list) {
  const pending = list.filter(r => r.status === 'pending').map(r => new Date(r.bookingTrigger).getTime())
  return {
    rev: crypto.randomUUID(),
    nextDue: pending.length ? Math.min(...pending) : null,
    hasActive: list.some(r => r.status === 'active'),
  }
}

/** Beperk logs en ruim oude, afgeronde reserveringen op. Muteert niet; geeft de nieuwe lijst. */
export function tidy(list, now = Date.now()) {
  return list
    .filter(r => {
      if (!['reserved', 'failed', 'cancelled'].includes(r.status)) return true
      const play = new Date(`${r.date}T12:00:00Z`).getTime()
      return !(play < now - KEEP_DONE_MS)
    })
    .map(r => (r.logs?.length > MAX_LOGS ? { ...r, logs: r.logs.slice(-MAX_LOGS) } : r))
}

/** Schrijf de lijst + meta samen weg (één pipeline = één roundtrip). */
export async function writeReservations(list) {
  const clean = tidy(list)
  const meta = buildMeta(clean)
  await redis.pipeline().set(RES_KEY, clean).set(META_KEY, meta).exec()
  return { list: clean, meta }
}

export async function readReservations() {
  return (await redis.get(RES_KEY)) ?? []
}

export const readMeta = () => redis.get(META_KEY)
