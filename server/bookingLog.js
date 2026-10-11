// Gedeeld tussen de browser (src/services/scheduler.js) en de cron (api/cron/tick.js):
// maakt van KNLTB-foutmeldingen korte, leesbare logregels.

const TOO_EARLY = 'start_date_too_far_in_future'

/**
 * KNLTB geeft bij "te vroeg" de laatst toegestane start_at (allowed_value) en de gevraagde
 * (current_value) terug. Het verschil is precies hoe lang het boekvenster nog dicht is,
 * want allowed_value schuift 1:1 mee met de klok.
 */
export function tooEarlyInfo(data, now = Date.now()) {
  const d = data?.errors_details?.find(e => e.error_code === TOO_EARLY)
  if (!d) return null
  const wait = new Date(d.current_value).getTime() - new Date(d.allowed_value).getTime()
  if (!Number.isFinite(wait) || wait < 0) return null
  return { opensAt: now + wait, waitMs: wait }
}

export const fmtTime = ms =>
  new Date(ms).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const fmtClock = ms =>
  new Date(ms).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })

/**
 * Fouten die herhalen niets oplost (de baan is dicht, of dit lid mag vandaag niet meer in piekuren
 * reserveren). Dan stoppen we meteen i.p.v. 150 keer hetzelfde antwoord te halen.
 * Geeft een korte reden terug, of null als het (mogelijk) tijdelijk is.
 */
export function permanentFailure(data) {
  const text = describeFailure(data, 400)
  if (/gesloten/i.test(text)) return text
  if (/niet meer (kan |mag )?reserveren/i.test(text)) return text
  return null
}

/**
 * Is een boekpoging "verlopen"? We proberen maximaal STALE_MS vanaf het moment dat de poging kon
 * beginnen: het openen van het boekvenster, óf het aanmaken van de reservering als dat later was
 * (een reservering voor een slot dat al open is). Daarna geven we op, ook als er geen tabblad of
 * cron meer actief is — anders blijft een reservering eeuwig 'actief'.
 */
export const STALE_MS = 7 * 60_000
export function isStaleAttempt(res, now = Date.now()) {
  if (!['pending', 'active'].includes(res.status)) return false
  const startedAt = Math.max(new Date(res.bookingTrigger).getTime() || 0, new Date(res.createdAt).getTime() || 0)
  return now - startedAt > STALE_MS
}

/** Duur in minuten uit een geslaagde proefboeking (validate): end_at − start_at. */
export function durationFromValidate(data) {
  const ms = new Date(data?.end_at).getTime() - new Date(data?.start_at).getTime()
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null
}

/** Korte beschrijving van een mislukte KNLTB-respons (i.p.v. 2000 tekens JSON). */
export function describeFailure(data, max = 220) {
  if (data == null) return 'geen details'
  const errs = data.errors
  if (errs && typeof errs === 'object') {
    const flat = Object.values(errs).flat().filter(Boolean)
    if (flat.length) return flat.join(' · ').slice(0, max)
  }
  const msg = data.message ?? data.error
  if (typeof msg === 'string') return msg.slice(0, max)
  return (JSON.stringify(data) ?? 'geen details').slice(0, max)
}

/**
 * Vervang de laatste logregel met dezelfde `key` (of voeg toe). Zo wordt "wacht op het venster"
 * één regel die meeloopt, in plaats van tientallen bijna identieke regels.
 */
export function upsertLog(logs, key, message) {
  const entry = { time: new Date().toISOString(), message, key }
  const i = logs.findLastIndex?.(l => l.key === key) ?? -1
  if (i !== -1 && i === logs.length - 1) logs[i] = entry
  else logs.push(entry)
  return logs
}
