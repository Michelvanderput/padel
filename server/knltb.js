const API = 'https://api.knltb.club'

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

    return { ok: res.ok, status: res.status, data }
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message }
  }
}


/**
 * Maak een reservering aan (server-side variant van src/services/knltb.js).
 */
export function createReservation(clubId, { date, timeSlot, courtId, clubMemberIds }, lisaToken) {
  // Vercel draait in UTC, KNLTB negeert blijkbaar de timezone-offset en ziet
  // de kloktijd als UTC. We sturen dus de UTC-equivalent van de gewenste
  // Amsterdam-speeltijd (bv. 18:30 CEST -> 16:30 UTC).
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
