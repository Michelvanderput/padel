import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Een cron die elke minuut draait, is "stil" na 3 minuten zonder hartslag.
const STALE_SEC = 180

export const useCronStore = defineStore('cron', () => {
  const agoSec = ref(null)      // seconden sinds de laatste tick; null = nog nooit gezien
  const loaded = ref(false)

  async function refresh() {
    try {
      const res = await fetch('/api/cron-status', { cache: 'no-store' })
      if (res.ok) { agoSec.value = (await res.json()).agoSec; loaded.value = true }
    } catch (_) {}
  }

  const running = computed(() => agoSec.value != null && agoSec.value < STALE_SEC)
  return { agoSec, loaded, running, refresh }
})
