// Herkent een lokale reservering in de lijst die KNLTB teruggeeft (GET …/reservations).
// KNLTB-velden (vastgesteld tegen de echte API): start_time, end_time, court_id, pincode, id,
// players: [{ id (= club-member-UUID), display_name }].

const AMS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Amsterdam', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Verschil Amsterdam − UTC op dit tijdstip in ms (3.600.000 in de winter, 7.200.000 in de zomer). */
function amsOffsetMs(utcMs) {
  const g = t => Number(AMS_PARTS.formatToParts(utcMs).find(p => p.type === t).value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs
}

/**
 * Speeltijd (Amsterdamse kloktijd, bv. 2026-10-11 + '12:00') → UTC-ms.
 * Onafhankelijk van de tijdzone van de browser of server, en correct rond zomer-/wintertijd.
 */
export function playStartMs(date, timeSlot) {
  const wall = Date.parse(`${date}T${timeSlot}:00Z`)   // kloktijd alsof het UTC was
  const first = wall - amsOffsetMs(wall)
  return wall - amsOffsetMs(first)
}

export function findLiveMatch(liveList, local, ourUuids) {
  const startMs = playStartMs(local.date, local.timeSlot)
  return (liveList ?? []).find(r =>
    r.start_time &&
    Math.abs(new Date(r.start_time).getTime() - startMs) < 60_000 &&
    r.court_id === local.courtId &&
    (r.players ?? []).some(p => ourUuids.has(p.id)))
}
