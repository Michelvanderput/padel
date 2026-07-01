const API = '/api/knltb'

// Static app-level Basic auth (decoded: lisax-api-pub-user:6T6hrM0Ne91BSjkvIJxh8MajSnpN1M9u)
const BASIC_AUTH = 'Basic bGlzYXgtYXBpLXB1Yi11c2VyOjZUNmhyTTBOZTkxQlNqa3ZpSnhoOE1BalNucE4xTTl1'

async function request(method, path, lisaToken, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization':      BASIC_AUTH,
      'x-lisa-auth-token':  lisaToken,
      'Content-Type':       'application/json',
      'Accept':             '*/*',
      'Accept-Language':    'nl-NL,nl;q=0.9',
      'User-Agent':         'KNLTB/202605140844 CFNetwork/3860.600.12 Darwin/25.5.0'
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })

  let data = null
  try { data = await res.json() } catch (_) {}

  return { ok: res.ok, status: res.status, data }
}

/**
 * Haal een lid op via hun UUID (zoals zichtbaar in /members/{uuid} calls).
 */
export function getMember(clubId, memberUuid, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/members/${memberUuid}`, lisaToken)
}

/**
 * Maak een reservering aan.
 * clubMemberIds = array van 4 club-member UUIDs (niet lidnummers).
 * courtId       = UUID van de specifieke baan.
 * start_at      = lokale datetime → automatisch naar UTC geconverteerd.
 */
export function createReservation(clubId, { date, timeSlot, courtId, clubMemberIds }, lisaToken) {
  const startAt = new Date(`${date}T${timeSlot}:00`).toISOString()

  return request('POST', `/v1/pub/tennis/clubs/${clubId}/reservations`, lisaToken, {
    reservation: {
      club_member_ids: clubMemberIds,
      court_id:        courtId,
      start_at:        startAt,
      guests:          [],
      products:        [],
      callback_url:    'knltbGeneral://'
    }
  })
}

/**
 * Annuleer een bestaande reservering.
 * reservationId = gecombineerde UUID uit de KNLTB app (uuid_uuid formaat)
 */
export function deleteReservation(clubId, reservationId, lisaToken) {
  return request('DELETE', `/v1/pub/tennis/clubs/${clubId}/reservations/${reservationId}?refund=false`, lisaToken)
}

/**
 * Controleer beschikbaarheid van banen vanaf een datum.
 */
export function getAvailability(clubId, date, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/availability_timeline?time_from=${date}`, lisaToken)
}
