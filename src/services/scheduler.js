import { useReservationsStore } from '@/stores/reservations'
import { useSettingsStore } from '@/stores/settings'
import { useMembersStore } from '@/stores/members'
import { createReservation, validateReservation, getBookingProducts, getReservations } from './knltb'

const timers = {}
const polls  = {}

const POLL_INTERVAL_MS  = 2000
const MAX_ATTEMPTS      = 150   // 5 minuten
const TRIGGER_CHECK_MS  = 500   // fallback check elke 500ms voor browser throttling edge-cases
const SYNC_INTERVAL_MS  = 60_000 // elke minuut sync met live KNLTB reserveringen

let syncTimer = null

/** Initialiseer bij opstarten — plant alle pending reserveringen in */
export function initScheduler() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }

  const store = useReservationsStore()
  store.reservations
    .filter(r => r.status === 'pending')
    .forEach(r => scheduleReservation(r))

  syncReservations()
  syncTimer = setInterval(syncReservations, SYNC_INTERVAL_MS)

  // Hercheck bij terugkeren naar tab (voorkomt gemiste triggers door browser throttling)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      store.reservations
        .filter(r => r.status === 'pending')
        .forEach(r => { if (!timers[r.id]) scheduleReservation(r) })
    }
  })
}

/** Plan één reservering in op basis van bookingTrigger */
export function scheduleReservation(reservation) {
  if (timers[reservation.id]) return

  const store = useReservationsStore()
  const triggerMs = new Date(reservation.bookingTrigger).getTime()

  if (triggerMs - Date.now() < 0) {
    store.addLog(reservation.id, '⚠ Boektijdstip is al verstreken — start direct boekpogingen.')
    startPolling(reservation.id)
    return
  }

  const triggerStr = new Date(reservation.bookingTrigger).toLocaleString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  store.addLog(reservation.id, `⏰ Ingepland: boeken op ${triggerStr}`)

  // Exacte setTimeout op de resterende milliseconden voor precisie op de seconde.
  // Fallback setInterval van 500ms vangt browser throttling op (tab inactief).
  const fire = () => {
    if (timers[reservation.id + '_fb']) {
      clearInterval(timers[reservation.id + '_fb'])
      delete timers[reservation.id + '_fb']
    }
    clearTimeout(timers[reservation.id])
    delete timers[reservation.id]
    startPolling(reservation.id)
  }

  const remaining = triggerMs - Date.now()
  timers[reservation.id] = setTimeout(fire, remaining)

  // Fallback: als browser de setTimeout throttlet (tab op achtergrond), vang dit op
  timers[reservation.id + '_fb'] = setInterval(() => {
    if (Date.now() >= triggerMs) fire()
  }, TRIGGER_CHECK_MS)
}

/** Annuleer een ingestelde timer of actieve poll */
export function cancelScheduled(id) {
  if (timers[id])        { clearTimeout(timers[id]);         delete timers[id] }
  if (timers[id + '_fb'])  { clearInterval(timers[id + '_fb']); delete timers[id + '_fb'] }
  if (polls[id])         { clearInterval(polls[id]);          delete polls[id] }
}

async function startPolling(id) {
  const reservationsStore = useReservationsStore()
  const settingsStore     = useSettingsStore()
  const membersStore      = useMembersStore()

  const res = reservationsStore.reservations.find(r => r.id === id)
  if (!res || (res.status !== 'pending' && res.status !== 'active')) return
  if (polls[id]) return

  if (!settingsStore.lisaToken) {
    reservationsStore.addLog(id, '✗ Geen x-lisa-auth-token ingesteld — ga naar Instellingen.')
    return
  }

  reservationsStore.updateStatus(id, 'active')
  reservationsStore.addLog(id, '🚀 Boektijdstip bereikt — start boekpogingen...')

  // Eenmalige diagnostische pre-checks — puur informatief, draaien op de achtergrond
  // en blokkeren de eigenlijke (tijdskritische) boekpogingen niet.
  const clubMemberIdsPre = res.memberIds
    .map(mid => membersStore.members.find(m => m.id === mid)?.clubMemberId)
    .filter(Boolean)

  if (clubMemberIdsPre.length === 4) {
    validateReservation(settingsStore.clubId, {
      date: res.date, timeSlot: res.timeSlot, courtId: res.courtId, clubMemberIds: clubMemberIdsPre
    }, settingsStore.lisaToken)
      .then(validation => reservationsStore.addLog(id, `🔍 Validatie: HTTP ${validation.status} — ${JSON.stringify(validation.data)?.slice(0, 300) ?? 'geen data'}`))
      .catch(e => reservationsStore.addLog(id, `🔍 Validatie mislukt (netwerkfout): ${e.message}`))

    getBookingProducts(settingsStore.clubId, settingsStore.lisaToken)
      .then(products => reservationsStore.addLog(id, `📦 Boekingsproducten: HTTP ${products.status} — ${JSON.stringify(products.data)?.slice(0, 300) ?? 'geen data'}`))
      .catch(e => reservationsStore.addLog(id, `📦 Boekingsproducten ophalen mislukt: ${e.message}`))
  }

  let attempt = 0

  const tryBook = async () => {
    if (attempt >= MAX_ATTEMPTS) {
      clearInterval(polls[id]); delete polls[id]
      reservationsStore.updateStatus(id, 'failed')
      reservationsStore.addLog(id, `✗ Maximaal ${MAX_ATTEMPTS} pogingen bereikt. Reservering mislukt.`)
      return
    }

    attempt++

    const token  = settingsStore.lisaToken
    const clubId = settingsStore.clubId
    const clubMemberIds = res.memberIds
      .map(mid => membersStore.members.find(m => m.id === mid)?.clubMemberId)
      .filter(Boolean)

    if (clubMemberIds.length < 4) {
      clearInterval(polls[id]); delete polls[id]
      reservationsStore.updateStatus(id, 'failed')
      reservationsStore.addLog(id, '✗ Niet alle leden hebben een Club Member UUID — controleer de ledenlijst.')
      return
    }

    try {
      const result = await createReservation(clubId, {
        date: res.date,
        timeSlot: res.timeSlot,
        courtId: res.courtId,
        clubMemberIds
      }, token)

      if (result.ok) {
        clearInterval(polls[id]); delete polls[id]
        reservationsStore.updateStatus(id, 'reserved')
        reservationsStore.addLog(id, `✓ Reservering geslaagd na ${attempt} poging${attempt !== 1 ? 'en' : ''}!`)
        if (result.data?.id) {
          reservationsStore.addLog(id, `  Reservering ID: ${result.data.id}`)
        }
        syncReservations()
      } else {
        const msg = JSON.stringify(result.data ?? 'geen details')
        reservationsStore.addLog(id, `→ Poging ${attempt}: HTTP ${result.status} — ${msg}`)
      }
    } catch (err) {
      reservationsStore.addLog(id, `→ Poging ${attempt} netwerkfout: ${err.message}`)
    }
  }

  // Meteen de eerste poging doen — niet wachten op de eerste setInterval-tick.
  tryBook()
  polls[id] = setInterval(tryBook, POLL_INTERVAL_MS)
}

/** Zoek in live reserveringen of een lokale pending/active reservering al geboekt is. */
async function syncReservations() {
  const reservationsStore = useReservationsStore()
  const settingsStore     = useSettingsStore()
  const membersStore      = useMembersStore()

  if (!settingsStore.lisaToken || !settingsStore.clubId) return

  const ours = reservationsStore.reservations.filter(r => r.status === 'pending' || r.status === 'active')
  if (ours.length === 0) return

  try {
    const res = await getReservations(settingsStore.clubId, settingsStore.lisaToken)
    if (!res.ok) return

    const list = res.data?.reservations ?? res.data?.data ?? (Array.isArray(res.data) ? res.data : [])
    const live = list.filter(r => r.start_at && new Date(r.start_at) >= new Date())

    const ourNames = membersStore.members.map(m => m.name.toLowerCase().trim())

    for (const local of ours) {
      const refUtc = new Date(`${local.date}T12:00:00Z`)
      const amsLocal = new Date(refUtc.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
      const offsetMin = Math.round((amsLocal - refUtc) / 60000)
      const localStartMs = new Date(`${local.date}T${local.timeSlot}:00`).getTime() - offsetMin * 60000

      const match = live.find(r => {
        if (!r.start_at) return false
        const sameTime = Math.abs(new Date(r.start_at).getTime() - localStartMs) < 60_000
        const sameCourt = r.court_id === local.courtId || r.court?.id === local.courtId
        const hasOurMember = (r.participants ?? r.club_members ?? r.members ?? [])
          .some(p => {
            const name = (p.full_name ?? p.name ?? '').toLowerCase().trim()
            return ourNames.some(our => our === name || name.includes(our.split(' ')[0]) || our.includes(name.split(' ')[0]))
          })
        return sameTime && sameCourt && hasOurMember
      })

      if (match) {
        reservationsStore.updateStatus(local.id, 'reserved')
        reservationsStore.addLog(local.id, `✓ Opgeslagen als gereserveerd via KNLTB sync (ID: ${match.id})`)
      }
    }
  } catch (_) {}
}
