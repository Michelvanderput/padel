import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCourts } from '@/services/knltb'
import { COURTS as STATIC_COURTS } from '@/constants/courts'

export const useCourtsStore = defineStore('courts', () => {
  const courts       = ref(STATIC_COURTS)
  const loadedFromApi = ref(false)
  const error         = ref(null)

  // Zet een KNLTB court-object om naar het interne { id, name, number } formaat.
  // Veldnamen zijn nog niet bevestigd met een echte response-body — vandaar
  // de fallbacks en de console.log zodat je de echte structuur kan checken.
  function normalize(raw) {
    return {
      id:     raw.id ?? raw.court_id ?? raw.uuid,
      name:   raw.name ?? raw.court_name ?? raw.title ?? 'Onbekende baan',
      number: raw.number ?? raw.court_number ?? raw.index ?? '',
    }
  }

  async function fetchCourts(clubId, lisaToken) {
    if (!clubId || !lisaToken) return
    error.value = null
    try {
      const res = await getCourts(clubId, lisaToken)
      if (!res.ok) {
        error.value = `API fout ${res.status}`
        return
      }
      const data = res.data
      const list = data?.courts ?? data?.data ?? (Array.isArray(data) ? data : [])
      const apiCourts = list.map(normalize).filter(c => c.id)

      // Nooit banen laten verdwijnen t.o.v. de bekende (werkende) lijst —
      // de API wordt alleen gebruikt om bestaande banen te verrijken en
      // écht nieuwe banen toe te voegen, nooit om te vervangen.
      const merged = STATIC_COURTS.map(staticCourt => {
        const match = apiCourts.find(c => c.id === staticCourt.id)
        return match ? { ...staticCourt, ...match } : staticCourt
      })
      for (const apiCourt of apiCourts) {
        if (!merged.some(c => c.id === apiCourt.id)) merged.push(apiCourt)
      }

      courts.value = merged
      loadedFromApi.value = apiCourts.length > 0
    } catch (e) {
      error.value = e.message
    }
  }

  return { courts, loadedFromApi, error, fetchCourts }
})
