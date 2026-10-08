/**
 * Verwerkt het antwoord van KNLTB `availability_timeline` tot een eenvoudige tijdslot-kaart.
 *
 * Antwoord (vastgesteld tegen de echte API):
 *   { day, timeline_court_availability: [{ court_details: { id, sport, … },
 *       timeline: { blocks: [{ block_type, start, end, slots, reservation }] } }] }
 *
 * block_type:
 *   available                 — vrij; slots['4players'] = [{ start_time, end_time, available }]
 *   reservation               — bezet (ook 'memberReservation')
 *   courtClosedByOpeningHours — baan dicht
 *   settingMinutesBetweenBooking — wisseltijd tussen twee boekingen (niet boekbaar)
 *   maxHoursBeforeBooking     — ligt nog te ver vooruit; opent 72 uur vóór aanvang
 */

const AMS = { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
const fmt = new Intl.DateTimeFormat('nl-NL', AMS)

/** ISO-tijdstip → 'HH:MM' in Amsterdamse tijd (onafhankelijk van de browser-tijdzone). */
export const slotKey = iso => fmt.format(new Date(iso))

export const STEP_MS = 30 * 60 * 1000

/** Alle tijdsloten van een dag (07:00–22:00 per half uur), in Amsterdamse kloktijd. */
export const TIME_SLOTS = (() => {
  const out = []
  for (let h = 7; h <= 21; h++) { out.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`) }
  out.push('22:00')
  return out
})()

export function padelCourtDetails(data) {
  return (data?.timeline_court_availability ?? [])
    .map(t => t.court_details)
    .filter(c => c?.sport === 'Padel' && !c.disabled)
}

/**
 * Tijdslot-kaart voor één baan: { 'HH:MM': { status, durations, opensAt? } }
 * status: available | booked | closed | buffer | short | later
 */
export function buildSlotMap(data, courtId, now = Date.now()) {
  const map = {}
  const entry = (data?.timeline_court_availability ?? []).find(c => c.court_details?.id === courtId)
  if (!entry) return map

  const each = (b, fn) => {
    for (let t = new Date(b.start).getTime(); t < new Date(b.end).getTime(); t += STEP_MS) fn(slotKey(new Date(t).toISOString()), t)
  }

  for (const b of entry.timeline?.blocks ?? []) {
    switch (b.block_type) {
      case 'available': {
        each(b, key => { if (!map[key]) map[key] = { status: 'short', durations: [] } })   // < 60 min over: niet boekbaar
        for (const s of b.slots?.['4players'] ?? []) {
          if (!s.available) continue
          const key = slotKey(s.start_time)
          const dur = Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000)
          if (!map[key] || map[key].status !== 'available') map[key] = { status: 'available', durations: [] }
          if (!map[key].durations.includes(dur)) map[key].durations.push(dur)
        }
        break
      }
      case 'reservation':
      case 'memberReservation':
        each(b, key => { map[key] = { status: 'booked', durations: [] } })
        break
      case 'courtClosedByOpeningHours':
        each(b, key => { if (!map[key]) map[key] = { status: 'closed', durations: [] } })
        break
      case 'settingMinutesBetweenBooking':
        each(b, key => { if (!map[key]) map[key] = { status: 'buffer', durations: [] } })
        break
      case 'maxHoursBeforeBooking': {
        // Het boekvenster is er nog niet. Het venster is nu + N uur breed (N = 72 bij Ready).
        const hours = Math.round((new Date(b.start).getTime() - now) / 3_600_000)
        each(b, (key, t) => { if (!map[key]) map[key] = { status: 'later', durations: [], opensAt: t - hours * 3_600_000 } })
        break
      }
    }
  }

  // Wat KNLTB boekt is de langste duur die op dit startpunt past; sorteer zodat [0] de kortste is.
  for (const v of Object.values(map)) v.durations.sort((a, b) => a - b)
  return map
}

/** De duur die KNLTB daadwerkelijk boekt: de langste beschikbare, anders 90. */
export const effectiveDuration = info => (info?.durations?.length ? Math.max(...info.durations) : 90)
