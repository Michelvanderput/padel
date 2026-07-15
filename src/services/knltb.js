import { logApiCall } from './logger'

const API = '/api/knltb'

// Static app-level Basic auth (decoded: lisax-api-pub-user:6T6hrM0Ne91BSjkvIJxh8MajSnpN1M9u)
const BASIC_AUTH = 'Basic bGlzYXgtYXBpLXB1Yi11c2VyOjZUNmhyTTBOZTkxQlNqa3ZpSnhoOE1BalNucE4xTTl1'

async function request(method, path, lisaToken, body) {
  try {
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

    logApiCall({ method, path, status: res.status, ok: res.ok, data })
    return { ok: res.ok, status: res.status, data }
  } catch (error) {
    logApiCall({ method, path, error })
    return { ok: false, status: 0, data: null, error: error.message }
  }
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
  // KNLTB negeert blijkbaar de timezone-offset en ziet de kloktijd als UTC.
  // Stuur dus de UTC-equivalent van de gewenste Amsterdam-speeltijd.
  const refUtc = new Date(`${date}T12:00:00Z`)
  const amsLocal = new Date(refUtc.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }))
  const offsetMin = Math.round((amsLocal - refUtc) / 60000)
  const playMs = new Date(`${date}T${timeSlot}:00`).getTime() - offsetMin * 60000
  const startAt = new Date(playMs).toISOString()

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
 * Haal aankomende reserveringen op voor de club (vanaf vandaag).
 */
export function getReservations(clubId, lisaToken) {
  const from = new Date().toISOString()
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/reservations?time_from=${from}`, lisaToken)
}

/**
 * Controleer beschikbaarheid van banen vanaf een datum.
 */
export function getAvailability(clubId, date, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/availability_timeline?time_from=${date}`, lisaToken)
}

/**
 * Zoek leden van de club op (voor)naam — vervangt handmatig UUID opzoeken via Proxyman.
 */
export function searchMembers(clubId, namePattern, lisaToken) {
  const q = encodeURIComponent(namePattern)
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/members?name_pattern=${q}&page_number=1&page_size=100`, lisaToken)
}

/**
 * Haal de vaste speelpartners ("buddies") van een lid op.
 */
export function getBuddies(clubId, memberUuid, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/members/${memberUuid}/buddies?page_number=1&page_size=100`, lisaToken)
}

/**
 * Valideer een reservering vóórdat hij daadwerkelijk wordt aangemaakt.
 * Zelfde payload als createReservation — geeft vroegtijdig een foutmelding
 * terug (bv. "baan al bezet") zonder een echte boeking te proberen.
 */
export function validateReservation(clubId, { date, timeSlot, courtId, clubMemberIds }, lisaToken) {
  const startAt = new Date(`${date}T${timeSlot}:00`).toISOString()

  return request('POST', `/v1/pub/tennis/clubs/${clubId}/reservations/validate`, lisaToken, {
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
 * Haal de banen van de club op (dynamisch, i.p.v. hardcoded in constants/courts.js).
 */
export function getCourts(clubId, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/courts`, lisaToken)
}

/**
 * Haal beschikbare boekingsproducten op (bv. baanhuur-tarieven).
 */
export function getBookingProducts(clubId, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/booking_products`, lisaToken)
}

/**
 * Haal clubdetails op.
 */
export function getClub(clubId, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}`, lisaToken)
}

/**
 * Haal één specifieke reservering op via zijn gecombineerde ID.
 */
export function getReservation(clubId, reservationId, lisaToken) {
  return request('GET', `/v1/pub/tennis/clubs/${clubId}/reservations/${reservationId}`, lisaToken)
}
