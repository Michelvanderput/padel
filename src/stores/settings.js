import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const lisaToken    = ref(localStorage.getItem('knltb-lisa-token') || 'pRBYZW5NuaF9GXaxwHxmXA==')
  const clubId       = ref(localStorage.getItem('knltb-club-id') || '568d56ef-ba65-405d-b2e1-82453a182de1')

  let syncing = false // voorkomt dat init() de server meteen weer overschrijft

  watch(lisaToken, val => {
    localStorage.setItem('knltb-lisa-token', val)
    if (!syncing) pushToServer()
  })
  watch(clubId, val => {
    localStorage.setItem('knltb-club-id', val)
    if (!syncing) pushToServer()
  })

  const isConfigured = computed(() => lisaToken.value.trim().length > 0)

  async function pushToServer() {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lisaToken: lisaToken.value, clubId: clubId.value })
      })
    } catch (_) {}
  }

  // Haal server-side instellingen op zodat de cron-worker (api/cron/tick.js)
  // dezelfde token/clubId gebruikt als de browser — nodig voor server-side boeken.
  async function init() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data?.lisaToken && data?.clubId) {
          syncing = true
          lisaToken.value = data.lisaToken
          clubId.value    = data.clubId
          syncing = false
          return
        }
      }
    } catch (_) {}
    // Nog geen server-side instellingen — huidige (lokale) waarden alsnog opslaan.
    pushToServer()
  }

  return { lisaToken, clubId, isConfigured, init }
})
