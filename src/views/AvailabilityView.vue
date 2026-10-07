<script setup>
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Zap, CalendarDays } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { getAvailability } from '@/services/knltb'
import { useSettingsStore } from '@/stores/settings'
import { useCourtsStore } from '@/stores/courts'
import PageHeader from '@/components/PageHeader.vue'
import { useReveal } from '@/composables/useReveal'

const root = ref(null)
useReveal(root)

const settings   = useSettingsStore()
const courtsStore = useCourtsStore()
const router     = useRouter()

// ── Calendar ────────────────────────────────────────────────
const today      = new Date()
const viewYear   = ref(today.getFullYear())
const viewMonth  = ref(today.getMonth())
const selected   = ref(null)

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1)
    .toLocaleString('nl-NL', { month: 'long', year: 'numeric' })
)

const calDays = computed(() => {
  const y = viewYear.value, m = viewMonth.value
  const first = new Date(y, m, 1)
  const last  = new Date(y, m + 1, 0)
  const days  = []

  // Padding: Monday-first (Mon=0)
  let dow = first.getDay(); dow = dow === 0 ? 6 : dow - 1
  for (let i = dow - 1; i >= 0; i--) days.push({ d: new Date(y, m, -i), cur: false })
  for (let i = 1; i <= last.getDate(); i++) days.push({ d: new Date(y, m, i), cur: true })
  while (days.length % 7 !== 0) {
    days.push({ d: new Date(y, m + 1, days.length - last.getDate() - dow + 1), cur: false })
  }
  return days
})

function prevMonth() { if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- } else viewMonth.value-- }
function nextMonth() { if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ } else viewMonth.value++ }
function same(a, b) { return a && b && a.toDateString() === b.toDateString() }
function past(d) { const c = new Date(d); c.setHours(23,59,59); return c < today }

// ── Court selector ───────────────────────────────────────────
const selectedCourt = ref(courtsStore.courts[0]?.id || '')

// ── Time slots ───────────────────────────────────────────────
const TIME_SLOTS = []
for (let h = 7; h <= 21; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
}
TIME_SLOTS.push('22:00')

// ── API ──────────────────────────────────────────────────────
const loading  = ref(false)
const apiError = ref(null)
const rawData  = ref(null)
const showRaw  = ref(false)

// Map: time → courtId → 'available'|'booked'
const grid = ref({})

function initGrid() {
  const g = {}
  for (const t of TIME_SLOTS) { g[t] = {}; for (const c of courtsStore.courts) g[t][c.id] = 'available' }
  return g
}

function parseResponse(data) {
  const g = initGrid()
  const items =
    (Array.isArray(data) ? data : null) ??
    data?.reservations ?? data?.slots ?? data?.data ?? data?.timeline ?? []

  if (!Array.isArray(items)) return { g, ok: false }

  let hits = 0
  for (const item of items) {
    const courtId = item.court_id ?? item.courtId
    const startAt = item.start_at ?? item.start
    const endAt   = item.end_at   ?? item.end
    if (!startAt) continue
    hits++

    const isBooked = item.available === undefined ? true : (item.available === false)
    if (!isBooked) continue

    const cur = new Date(startAt)
    const end = endAt ? new Date(endAt) : new Date(cur.getTime() + 30 * 60 * 1000)
    while (cur < end) {
      const key = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`
      if (g[key]) {
        if (courtId && g[key][courtId] !== undefined) g[key][courtId] = 'booked'
        else if (!courtId) for (const c of courtsStore.courts) g[key][c.id] = 'booked'
      }
      cur.setMinutes(cur.getMinutes() + 30)
    }
  }
  return { g, ok: hits > 0 }
}

async function fetchDay(date) {
  selected.value  = date
  loading.value   = true
  apiError.value  = null
  rawData.value   = null
  grid.value      = {}
  showRaw.value   = false

  try {
    const ds = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    const res = await getAvailability(settings.clubId, `${ds}T00:00:00`, settings.lisaToken)
    rawData.value = res.data

    if (!res.ok) {
      apiError.value = `API fout ${res.status}`
      grid.value = initGrid()
      return
    }

    const { g, ok } = parseResponse(res.data)
    grid.value = g
    if (!ok) apiError.value = 'Onbekend API-formaat — ruwe data zichtbaar hieronder'
  } catch (e) {
    apiError.value = e.message
    grid.value = initGrid()
  } finally {
    loading.value = false
  }
}

const slotStatus = (time, courtId) => grid.value[time]?.[courtId] ?? 'unknown'
const hasData    = computed(() => Object.keys(grid.value).length > 0)

const dateLabel = computed(() => selected.value
  ? selected.value.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  : null
)

function bookSlot(time) {
  if (!selected.value) return
  const ds = `${selected.value.getFullYear()}-${String(selected.value.getMonth()+1).padStart(2,'0')}-${String(selected.value.getDate()).padStart(2,'0')}`
  router.push({ path: '/nieuw', query: { date: ds, time, court: selectedCourt.value } })
}
</script>

<template>
  <div ref="root" class="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-8 sm:pt-40">

    <PageHeader eyebrow="Banen" title="Beschikbaarheid" subtitle="Kies een datum om te zien welke tijdsloten vrij zijn." />

    <div v-if="!settings.isConfigured" data-reveal class="note note-amber mb-6">
      <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>Stel eerst een <RouterLink to="/instellingen" class="font-semibold underline">x-lisa-auth-token</RouterLink> in om beschikbaarheid op te vragen.</p>
    </div>

    <div data-reveal-group class="grid grid-cols-1 gap-5 lg:grid-cols-2">

      <!-- Calendar -->
      <div data-reveal class="panel overflow-hidden">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <button @click="prevMonth" class="btn-icon !h-10 !w-10 border border-line" aria-label="Vorige maand"><ChevronLeft class="h-4 w-4" /></button>
          <span class="display text-xl capitalize text-fog">{{ monthLabel }}</span>
          <button @click="nextMonth" class="btn-icon !h-10 !w-10 border border-line" aria-label="Volgende maand"><ChevronRight class="h-4 w-4" /></button>
        </div>
        <div class="grid grid-cols-7 px-4 pb-1 pt-4">
          <div v-for="d in ['Ma','Di','Wo','Do','Vr','Za','Zo']" :key="d" class="eyebrow py-1.5 text-center">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 gap-1 px-4 pb-5">
          <button
            v-for="({ d, cur }, i) in calDays" :key="i"
            @click="!past(d) && settings.isConfigured && fetchDay(d)"
            :disabled="!cur || past(d)"
            :aria-label="d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })"
            :aria-pressed="same(d, selected)"
            class="relative flex aspect-square max-h-12 items-center justify-center rounded-full text-sm font-semibold tabular transition-all duration-300 ease-out-expo"
            :class="[
              !cur ? 'invisible' : '',
              cur && past(d) ? 'cursor-not-allowed text-mist/35' : '',
              cur && !past(d) && !same(d, selected) ? 'text-fog hover:bg-white/10' : '',
              same(d, selected) ? 'scale-110 bg-lime text-ink shadow-[0_8px_30px_-6px_rgba(205,255,46,0.55)]' : '',
              same(d, today) && !same(d, selected) ? 'ring-1 ring-lime/70' : '',
            ]"
          >{{ d.getDate() }}</button>
        </div>
      </div>

      <!-- Court selector -->
      <div data-reveal class="space-y-3">
        <div class="panel p-5">
          <p class="label">Kies baan</p>
          <div role="radiogroup" aria-label="Baan" class="space-y-2">
            <label
              v-for="court in courtsStore.courts" :key="court.id"
              class="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-lime/40"
              :class="selectedCourt === court.id ? 'border-lime bg-lime/10' : 'border-line hover:border-white/25 hover:bg-white/[0.04]'"
            >
              <input type="radio" :value="court.id" v-model="selectedCourt" class="sr-only" />
              <span class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2" :class="selectedCourt === court.id ? 'border-lime' : 'border-mist/60'">
                <span v-if="selectedCourt === court.id" class="h-2 w-2 rounded-full bg-lime"></span>
              </span>
              <span class="flex-1 font-semibold" :class="selectedCourt === court.id ? 'text-lime' : 'text-fog'">{{ court.name }}</span>
              <span class="font-mono text-xs text-mist">#{{ court.number }}</span>
            </label>
          </div>
        </div>

        <div class="flex gap-5 px-1 text-xs text-mist">
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-lime"></span>Vrij</span>
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-danger"></span>Bezet</span>
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-mist"></span>Onbekend</span>
        </div>
      </div>
    </div>

    <!-- Availability grid -->
    <div data-reveal class="panel mt-5 overflow-hidden">
      <div class="flex items-center justify-between border-b border-line px-6 py-5">
        <div>
          <p class="display text-2xl text-fog first-letter:uppercase">{{ dateLabel ?? 'Selecteer een datum' }}</p>
          <p v-if="dateLabel" class="eyebrow mt-1">{{ courtsStore.courts.find(c => c.id === selectedCourt)?.name }}</p>
        </div>
        <button
          v-if="selected && settings.isConfigured"
          @click="fetchDay(selected)" class="btn-icon !h-10 !w-10 border border-line" aria-label="Ververs beschikbaarheid"
        >
          <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>

      <div v-if="loading" class="flex flex-col items-center gap-3 p-12" role="status">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-lime border-t-transparent"></div>
        <p class="text-sm text-mist">Beschikbaarheid ophalen…</p>
      </div>

      <div v-else-if="apiError" class="space-y-3 p-6">
        <div class="note note-amber"><AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" /><span>{{ apiError }}</span></div>
        <div v-if="rawData">
          <button @click="showRaw = !showRaw" class="text-xs text-mist transition-colors hover:text-fog">{{ showRaw ? 'Verberg' : 'Toon' }} ruwe API-response</button>
          <pre v-if="showRaw" data-lenis-prevent class="mt-2 max-h-48 overflow-auto rounded-2xl bg-ink p-4 font-mono text-xs text-lime">{{ JSON.stringify(rawData, null, 2) }}</pre>
        </div>
      </div>

      <div v-else-if="!hasData" class="flex flex-col items-center gap-3 p-14 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white/5"><CalendarDays class="h-6 w-6 text-mist" /></div>
        <p class="text-sm text-mist">Kies een datum in de kalender om de beschikbaarheid te zien.</p>
      </div>

      <ul v-else class="divide-y divide-line">
        <li v-for="time in TIME_SLOTS" :key="time" class="flex items-center gap-4 px-6 py-2.5">
          <span class="w-12 flex-shrink-0 font-mono text-xs text-mist tabular">{{ time }}</span>
          <div class="flex-1">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
              :class="{
                'border-lime/30 bg-lime/10 text-lime':    slotStatus(time, selectedCourt) === 'available',
                'border-danger/30 bg-danger/10 text-danger': slotStatus(time, selectedCourt) === 'booked',
                'border-line bg-white/5 text-mist':       slotStatus(time, selectedCourt) === 'unknown',
              }"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="{
                'bg-lime':   slotStatus(time, selectedCourt) === 'available',
                'bg-danger': slotStatus(time, selectedCourt) === 'booked',
                'bg-mist':   slotStatus(time, selectedCourt) === 'unknown',
              }"></span>
              {{ slotStatus(time, selectedCourt) === 'available' ? 'Vrij' : slotStatus(time, selectedCourt) === 'booked' ? 'Bezet' : '?' }}
            </span>
          </div>
          <button v-if="slotStatus(time, selectedCourt) === 'available'" @click="bookSlot(time)" class="btn btn-ghost !px-3.5 !py-1.5 text-xs text-lime hover:!bg-lime/10">
            <Zap class="h-3 w-3" />Boek
          </button>
        </li>
      </ul>
    </div>

  </div>
</template>
