import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCourts } from '@/services/knltb'
import { COURTS as STATIC_COURTS } from '@/constants/courts'

export const useCourtsStore = defineStore('courts', () => {
  const courts       = ref(STATIC_COURTS)
  const loadedFromApi = ref(false)
  const error         = ref(null)

  // KNLTB levert { courts: [{ court: { id, name, number, sport, … } }] } — dus genest, en
  // inclusief tennisbanen. Wij willen alleen de padelbanen.
  function normalize(item) {
    const raw = item?.court ?? item
    return {
      id:       raw.id ?? raw.court_id ?? raw.uuid,
      name:     raw.name ?? raw.court_name ?? raw.title ?? 'Onbekende baan',
      number:   raw.number ?? raw.court_number ?? raw.index ?? '',
      sport:    raw.sport,
      disabled: !!raw.disabled,
    }
  }

  async function fetchCourts(clubId, lisaToken) {
    if (!clubId || !lisaToken) return
    error.value = null
    try {
      const res = await getCourts(clubId, lisaToken)
      if (!res.ok) {
        error.value = res.status === 401 ? 'Token ongeldig of verlopen' : `API fout ${res.status}`
        return
      }
      const data = res.data
      const list = data?.courts ?? data?.data ?? (Array.isArray(data) ? data : [])
      const apiCourts = list.map(normalize).filter(c => c.id && c.sport === 'Padel' && !c.disabled)
      if (apiCourts.length === 0) return   // onverwacht antwoord: houd de bekende lijst

      // De API is leidend (namen, nieuwe/verdwenen banen); de vaste lijst is alleen het vangnet.
      courts.value = apiCourts
        .map(({ id, name, number }) => ({ id, name, number }))
        .sort((a, b) => Number(b.number) - Number(a.number))
      loadedFromApi.value = true
    } catch (e) {
      error.value = e.message
    }
  }

  return { courts, loadedFromApi, error, fetchCourts }
})
