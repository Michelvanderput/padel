// Kleine debug-logger voor KNLTB API calls.
// Omdat de exacte response-structuur van sommige endpoints nog onbekend is,
// logt dit elke call naar de browser console én naar een reactieve lijst,
// zodat je de echte payload kan inspecteren — zowel via devtools als
// rechtstreeks in de app (Instellingen → API-log).

import { reactive } from 'vue'

const MAX_ENTRIES = 100
export const apiLog = reactive([])

export function logApiCall({ method, path, status, ok, data, error }) {
  const entry = { time: new Date().toISOString(), method, path, status, ok, data, error }
  apiLog.unshift(entry)
  if (apiLog.length > MAX_ENTRIES) apiLog.pop()

  const label = `[KNLTB] ${method} ${path} → ${status ?? 'ERR'}`
  if (error) {
    console.error(label, error)
  } else if (!ok) {
    console.warn(label, data)
  } else {
    console.log(label, data)
  }
  return entry
}

export function clearApiLog() {
  apiLog.length = 0
}
