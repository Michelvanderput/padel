import { useReservationsStore } from '@/stores/reservations'
import { useSettingsStore } from '@/stores/settings'
import { useMembersStore } from '@/stores/members'
import { createReservation } from './knltb'

const timers = {}
const polls  = {}

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS     = 150  // 5 minuten

/** Initialiseer bij opstarten — plant alle pending reserveringen in */
export function initScheduler() {
  const store = useReservationsStore()
  store.reservations
    .filter(r => r.status === 'pending')
    .forEach(r => scheduleReservation(r))
}

/** Plan één reservering in op basis van bookingTrigger */
export function scheduleReservation(reservation) {
  if (timers[reservation.id]) return

  const store = useReservationsStore()
  const delay = new Date(reservation.bookingTrigger).getTime() - Date.now()

  if (delay < 0) {
    store.addLog(reservation.id, '⚠ Boektijdstip is al verstreken — niet ingepland.')
    return
  }

  const triggerStr = new Date(reservation.bookingTrigger).toLocaleString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
  store.addLog(reservation.id, `⏰ Ingepland: boeken op ${triggerStr}`)

  timers[reservation.id] = setTimeout(() => {
    delete timers[reservation.id]
    startPolling(reservation.id)
  }, delay)
}

/** Annuleer een ingestelde timer of actieve poll */
export function cancelScheduled(id) {
  if (timers[id]) { clearTimeout(timers[id]);  delete timers[id] }
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
        const msg = result.data?.message ?? result.data?.error ?? 'geen details'
        reservationsStore.addLog(id, `→ Poging ${attempt}: HTTP ${result.status} — ${msg}`)
      }
    } catch (err) {
      reservationsStore.addLog(id, `→ Poging ${attempt} netwerkfout: ${err.message}`)
    }
  }, POLL_INTERVAL_MS)
}
