import { redis } from './store.js'
import { COURTS } from '../src/constants/courts.js'

const MEMBERS_KEY = 'knltb:members'
const NOTIFIED_TTL_S = 90 * 24 * 60 * 60 // lang genoeg: een reservering wordt nooit twee keer 'reserved'

/**
 * Stuurt een WhatsApp-bericht naar de groep via Green API zodra een reservering 'reserved' of 'failed' wordt.
 * Vereist de env-variabelen GREEN_API_INSTANCE, GREEN_API_TOKEN en WHATSAPP_GROUP_ID;
 * zijn die er niet, dan gebeurt er niets. Mag een boeking nooit laten mislukken, dus alle fouten
 * worden afgevangen en alleen gelogd.
 */
export function whatsappConfigured() {
  return !!(process.env.GREEN_API_INSTANCE && process.env.GREEN_API_TOKEN && process.env.WHATSAPP_GROUP_ID)
}

export function describeReservation(reservation, members) {
  const court = COURTS.find(c => c.id === reservation.courtId)?.name ?? 'een padelbaan'
  const day = new Date(`${reservation.date}T12:00:00Z`)
    .toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
  const names = (reservation.memberIds ?? [])
    .map(id => members.find(m => m.id === id)?.name)
    .filter(Boolean)
  const duration = Number(reservation.duration) ? ` (${Number(reservation.duration)} min)` : ''

  if (reservation.status === 'failed') {
    return [
      'Padelbaan boeking mislukt',
      `${court}${reservation.location ? `, ${reservation.location}` : ''}`,
      `${day} om ${reservation.timeSlot}${duration}`,
      names.length ? `Spelers: ${names.join(', ')}` : null,
      failureReason(reservation) ? `Reden: ${failureReason(reservation)}` : null,
    ].filter(Boolean).join('\n')
  }

  return [
    'Padelbaan gereserveerd',
    `${court}${reservation.location ? `, ${reservation.location}` : ''}`,
    `${day} om ${reservation.timeSlot}${duration}`,
    names.length ? `Spelers: ${names.join(', ')}` : null,
  ].filter(Boolean).join('\n')
}

// Laatste logregel zonder emoji/"[server]"-label, als korte reden voor in het bericht.
function failureReason(reservation) {
  const last = [...(reservation.logs ?? [])].reverse().find(l => l?.message)?.message
  if (!last) return ''
  return last
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\[server\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
    .slice(0, 200)
}

/**
 * Aanroepen na het wegschrijven van een reservering. Stuurt bij de overgang naar 'reserved' of
 * 'failed' (previousStatus !== nieuwe status) hooguit één bericht per reservering en uitkomst: de
 * atomaire SET NX vangt het geval op dat cron en browser tegelijk dezelfde status zetten.
 */
export async function notifyOutcome(reservation, previousStatus) {
  const status = reservation?.status
  if (status !== 'reserved' && status !== 'failed') return
  if (previousStatus === status) return
  if (!whatsappConfigured()) return

  const key = `knltb:notified:${reservation.id}:${status}`
  try {
    const first = await redis.set(key, '1', { nx: true, ex: NOTIFIED_TTL_S })
    if (!first) return

    const members = (await redis.get(MEMBERS_KEY)) ?? []
    const { GREEN_API_INSTANCE: id, GREEN_API_TOKEN: token, WHATSAPP_GROUP_ID: chatId } = process.env
    const res = await fetch(`https://api.green-api.com/waInstance${id}/sendMessage/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: describeReservation(reservation, members) }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Green API ${res.status}`)
  } catch (e) {
    // Sleutel weer vrijgeven zodat een volgende schrijfactie het opnieuw kan proberen.
    await redis.del(key).catch(() => {})
    console.error('[notify] WhatsApp-bericht mislukt:', e.message)
  }
}
