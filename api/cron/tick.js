import { createReservation } from '../../server/knltb.js'
import { redis, readMeta, readReservations, writeReservations } from '../../server/store.js'

const MEMBERS_KEY  = 'knltb:members'
const SETTINGS_KEY = 'knltb:settings'

// Dit endpoint moet elke minuut aangeroepen worden (Vercel Cron of een externe
// cron-service zoals cron-job.org). Het "kijkt vooruit": zodra het boekmoment
// van een reservering binnen dit tijdvenster valt, slaapt de functie tot het
// exacte moment en vuurt dan de boekpoging — onafhankelijk van of er een
// browser/tab open staat.
const LOOKAHEAD_MS = 90_000  // hoever vooruit kijken per tick (>60s om cron-jitter op te vangen)
const BUDGET_MS    = 58_000  // max. tijd die deze invocatie mag gebruiken (< maxDuration)
const RETRY_MS     = 500     // tijd tussen boekpogingen als eerste poging niet lukt
// Na dit venster (gerekend vanaf het openen van het boekvenster) geven we op. Zonder deze grens
// zette elke tick een onboekbare reservering terug op 'pending' en probeerde de volgende tick het
// opnieuw — elke minuut, voor altijd, met telkens volledige lees-/schrijfacties op Redis.
const GIVE_UP_MS   = 5 * 60_000

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function saveReservation(id, patch) {
  const list = await readReservations()
  const idx = list.findIndex(r => r.id === id)
  if (idx === -1) return null
  Object.assign(list[idx], patch)
  await writeReservations(list)
  return list[idx]
}

function pushLog(logs, message) {
  logs.push({ time: new Date().toISOString(), message })
  return logs
}

async function processReservation(reservation, settings, members, startedAt) {
  const logs = [...(reservation.logs ?? [])]

  // Bereken het exacte Amsterdam-tijdstip van de speeltijd als UTC ms
  const refUtc   = new Date(`${reservation.date}T12:00:00Z`)
  const amsLocal = new Date(refUtc.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const offsetMin = Math.round((amsLocal - refUtc) / 60000)
  const playMs   = new Date(`${reservation.date}T${reservation.timeSlot}:00`).getTime() - offsetMin * 60000

  // Slaap tot EXACT 72 uur voor speeltijd — dat is het moment het KNLTB-venster opengaat
  const openMs  = playMs - 72 * 60 * 60 * 1000
  const delay   = openMs - Date.now()
  const giveUpAt = openMs + GIVE_UP_MS

  if (Date.now() > giveUpAt) {
    pushLog(logs, `✗ [server] Boekvenster langer dan ${GIVE_UP_MS / 60_000} minuten open zonder succes — opgegeven.`)
    await saveReservation(reservation.id, { status: 'failed', logs })
    return
  }

  if (delay > 0) {
    const budgetLeft = BUDGET_MS - (Date.now() - startedAt) - 500
    await sleep(Math.max(0, Math.min(delay, budgetLeft)))
  }

  // Herlaad vlak voor het boeken — annuleren/wijzigen kan intussen gebeurd zijn.
  const fresh = (await readReservations()).find(r => r.id === reservation.id)
  if (!fresh || (fresh.status !== 'pending' && fresh.status !== 'active')) return

  // Log de start_at die we gaan sturen ter verificatie (UTC-equivalent van Amsterdam speeltijd)
  const startAt = new Date(playMs).toISOString()
  pushLog(logs, `🚀 [server] Boektijdstip bereikt — start_at wordt: ${startAt}`)
  await saveReservation(reservation.id, { status: 'active', logs })

  const clubMemberIds = reservation.memberIds
    .map(mid => members.find(m => m.id === mid)?.clubMemberId)
    .filter(Boolean)

  if (clubMemberIds.length < 4) {
    pushLog(logs, '✗ [server] Niet alle leden hebben een Club Member UUID.')
    await saveReservation(reservation.id, { status: 'failed', logs })
    return
  }

  let attempt = 0
  while (Date.now() - startedAt < BUDGET_MS && Date.now() < giveUpAt) {
    attempt++
    try {
      const result = await createReservation(settings.clubId, {
        date: reservation.date, timeSlot: reservation.timeSlot,
        courtId: reservation.courtId, clubMemberIds
      }, settings.lisaToken)

      if (result.ok) {
        pushLog(logs, `✓ [server] Reservering geslaagd na ${attempt} poging${attempt !== 1 ? 'en' : ''}!`)
        if (result.data?.id) pushLog(logs, `  Reservering ID: ${result.data.id}`)
        await saveReservation(reservation.id, { status: 'reserved', logs })
        return
      }

      const msg = result.data?.message ?? result.data?.error ?? JSON.stringify(result.data)?.slice(0, 200) ?? 'geen details'
      pushLog(logs, `→ [server] Poging ${attempt}: HTTP ${result.status} — ${msg}`)
    } catch (err) {
      pushLog(logs, `→ [server] Poging ${attempt} netwerkfout: ${err.message}`)
    }

    await sleep(RETRY_MS)
  }

  if (Date.now() >= giveUpAt) {
    pushLog(logs, `✗ [server] Geen succes binnen ${GIVE_UP_MS / 60_000} minuten na openen boekvenster (${attempt} pogingen) — opgegeven.`)
    await saveReservation(reservation.id, { status: 'failed', logs })
    return
  }

  // Tijdsbudget van deze tick op — status blijft 'active', volgende tick pakt het weer op.
  pushLog(logs, `⏳ [server] Tijdvenster van deze cron-tick verstreken na ${attempt} poging${attempt !== 1 ? 'en' : ''} — volgende tick gaat verder.`)
  await saveReservation(reservation.id, { status: 'pending', logs })
}

export default async function handler(req, res) {
  try {
    const secret = (req.headers['authorization'] || '').replace('Bearer ', '') || req.query.secret
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const startedAt = Date.now()

    // Snelle uitweg: 1 kleine read (meta). Is er niets actiefs en het eerstvolgende boekmoment
    // nog ver weg, dan hoeft de grote lijst, instellingen en ledenlijst niet gelezen te worden.
    const meta = await readMeta()
    if (meta && !meta.hasActive && (meta.nextDue == null || meta.nextDue - Date.now() > LOOKAHEAD_MS)) {
      return res.status(200).json({ skipped: 'niets te doen', nextDue: meta.nextDue ? new Date(meta.nextDue).toISOString() : null })
    }

    const settings = await redis.get(SETTINGS_KEY)
    if (!settings?.lisaToken || !settings?.clubId) {
      return res.status(200).json({ skipped: 'Geen server-side instellingen gevonden — sla /instellingen op.' })
    }

    const [reservations, members] = await Promise.all([
      readReservations(),
      redis.get(MEMBERS_KEY) ?? []
    ])

    const due = (reservations ?? []).filter(r =>
      (r.status === 'pending' && (new Date(r.bookingTrigger).getTime() - Date.now()) <= LOOKAHEAD_MS) ||
      r.status === 'active'
    )

    let processed = 0
    for (const reservation of due) {
      if (Date.now() - startedAt > BUDGET_MS) break
      try {
        await processReservation(reservation, settings, members ?? [], startedAt)
      } catch (procErr) {
        // Log de fout in de reservering zodat we het in de UI zien
        const list = await readReservations()
        const idx = list.findIndex(r => r.id === reservation.id)
        if (idx !== -1) {
          list[idx].logs = [...(list[idx].logs ?? []), { time: new Date().toISOString(), message: `💥 [server] Crash: ${procErr.message}` }]
          await writeReservations(list)
        }
      }
      processed++
    }

    res.json({ checked: (reservations ?? []).length, due: due.length, processed })
  } catch (err) {
    console.error('Cron tick error:', err)
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) })
  }
}
