import { useReservationsStore } from '@/stores/reservations'
import { useSettingsStore } from '@/stores/settings'
import { useMembersStore } from '@/stores/members'
import { createReservation, validateReservation, getBookingProducts } from './knltb'

const timers = {}
const polls  = {}

const POLL_INTERVAL_MS  = 2000
const MAX_ATTEMPTS      = 150   // 5 minuten
const TRIGGER_CHECK_MS  = 3000  // check trigger elke 3s (robuust tegen browser throttling)

/** Initialiseer bij opstarten — plant alle pending reserveringen in */
export function initScheduler() {
  const store = useReservationsStore()
  store.reservations
    .filter(r => r.status === 'pending')
    .forEach(r => scheduleReservation(r))

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

  // Korte polling-interval i.p.v. één lange setTimeout — immuun voor browser throttling
  timers[reservation.id] = setInterval(() => {
    if (Date.now() >= triggerMs) {
      clearInterval(timers[reservation.id])
      delete timers[reservation.id]
      startPolling(reservation.id)
    }
  }, TRIGGER_CHECK_MS)
}

/** Annuleer een ingestelde timer of actieve poll */
export function cancelScheduled(id) {
  if (timers[id]) { clearInterval(timers[id]); delete timers[id] }
  if (polls[id])  { clearInterval(polls[id]);  delete polls[id] }
}

async function startPolling(id) {
  const reservationsStore = useReservationsStore()
  const settingsStore     = useSettingsStore()
  const membersStore      = useMembersStore()

  const res = reservationsStore.reservations.find(r => r.id === id)
  if (!res || res.status !== 'pending') return

  if (!settingsStore.lisaToken) {
    reservationsStore.addLog(id, '✗ Geen x-lisa-auth-token ingesteld — ga naar Instellingen.')
    return
  }

  reservationsStore.updateStatus(id, 'active')
  reservationsStore.addLog(id, '🚀 Boektijdstip bereikt — start boekpogingen...')

  // Eenmalige diagnostische pre-checks — helpen om fouten sneller te lokaliseren
  // zonder de eigenlijke boekpogingen te vertragen of te blokkeren.
  const clubMemberIdsPre = res.memberIds
    .map(mid => membersStore.members.find(m => m.id === mid)?.clubMemberId)
    .filter(Boolean)

  if (clubMemberIdsPre.length === 4) {
    try {
      const validation = await validateReservation(settingsStore.clubId, {
        date: res.date, timeSlot: res.timeSlot, courtId: res.courtId, clubMemberIds: clubMemberIdsPre
      }, settingsStore.lisaToken)
      reservationsStore.addLog(id, `🔍 Validatie: HTTP ${validation.status} — ${JSON.stringify(validation.data)?.slice(0, 300) ?? 'geen data'}`)
    } catch (e) {
      reservationsStore.addLog(id, `🔍 Validatie mislukt (netwerkfout): ${e.message}`)
    }

    try {
      const products = await getBookingProducts(settingsStore.clubId, settingsStore.lisaToken)
      reservationsStore.addLog(id, `📦 Boekingsproducten: HTTP ${products.status} — ${JSON.stringify(products.data)?.slice(0, 300) ?? 'geen data'}`)
    } catch (e) {
      reservationsStore.addLog(id, `📦 Boekingsproducten ophalen mislukt: ${e.message}`)
    }
  }

  let attempt = 0

  polls[id] = setInterval(async () => {
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
      } else {
        const msg = result.data?.message ?? result.data?.error ?? JSON.stringify(result.data)?.slice(0, 200) ?? 'geen details'
        reservationsStore.addLog(id, `→ Poging ${attempt}: HTTP ${result.status} — ${msg}`)
      }
    } catch (err) {
      reservationsStore.addLog(id, `→ Poging ${attempt} netwerkfout: ${err.message}`)
    }
  }, POLL_INTERVAL_MS)
}
