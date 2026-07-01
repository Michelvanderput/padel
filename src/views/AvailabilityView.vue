<script setup>
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Zap, CalendarDays } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { getAvailability } from '@/services/knltb'
import { useSettingsStore } from '@/stores/settings'
import { COURTS } from '@/constants/courts'

const settings = useSettingsStore()
const router   = useRouter()

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
const selectedCourt = ref(COURTS[0].id)

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
  for (const t of TIME_SLOTS) { g[t] = {}; for (const c of COURTS) g[t][c.id] = 'available' }
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
        else if (!courtId) for (const c of COURTS) g[key][c.id] = 'booked'
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
  <div class="max-w-3xl space-y-5">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Beschikbaarheid</h1>
      <p class="text-sm text-slate-400 mt-0.5">Kies een datum om te zien welke tijdsloten vrij zijn</p>
    </div>

    <!-- No token warning -->
    <div v-if="!settings.isConfigured" class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
      <AlertCircle class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <p class="text-amber-800">Stel eerst een <RouterLink to="/instellingen" class="font-semibold underline">x-lisa-auth-token</RouterLink> in om beschikbaarheid op te vragen.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

      <!-- ── Calendar ── -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <button @click="prevMonth" class="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft class="w-4 h-4 text-slate-500" />
          </button>
          <span class="font-semibold text-slate-900 text-sm capitalize">{{ monthLabel }}</span>
          <button @click="nextMonth" class="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight class="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <!-- Day headers -->
        <div class="grid grid-cols-7 px-3 pt-3 pb-1">
          <div v-for="d in ['Ma','Di','Wo','Do','Vr','Za','Zo']" :key="d" class="text-center text-xs font-semibold text-slate-400 py-1">{{ d }}</div>
        </div>

        <!-- Day grid -->
        <div class="grid grid-cols-7 px-3 pb-4 gap-y-1">
          <button
            v-for="({ d, cur }, i) in calDays"
            :key="i"
            @click="!past(d) && settings.isConfigured && fetchDay(d)"
            class="relative h-9 w-full flex items-center justify-center rounded-xl text-sm font-medium transition-all"
            :class="[
              !cur ? 'text-slate-300' : '',
              cur && past(d) ? 'text-slate-300 cursor-not-allowed' : '',
              cur && !past(d) && !same(d, selected) ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : '',
              same(d, selected) ? 'bg-green-500 text-white shadow-md shadow-green-500/30' : '',
              same(d, today) && !same(d, selected) ? 'ring-2 ring-green-400 ring-offset-1' : '',
            ]"
          >
            {{ d.getDate() }}
          </button>
        </div>
      </div>

      <!-- ── Court selector ── -->
      <div class="space-y-3">
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Kies baan</p>
          <div class="space-y-1.5">
            <label
              v-for="court in COURTS"
              :key="court.id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm"
              :class="selectedCourt === court.id ? 'border-green-500 bg-green-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'"
            >
              <input type="radio" :value="court.id" v-model="selectedCourt" class="sr-only" />
              <span class="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                :class="selectedCourt === court.id ? 'border-green-500' : 'border-slate-300'">
                <span v-if="selectedCourt === court.id" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              </span>
              <span class="flex-1 font-medium" :class="selectedCourt === court.id ? 'text-green-700' : 'text-slate-700'">{{ court.name }}</span>
              <span class="text-xs text-slate-400">{{ court.number }}</span>
            </label>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex gap-4 px-1">
          <div class="flex items-center gap-1.5 text-xs text-slate-500"><span class="w-3 h-3 rounded-sm bg-green-100 border border-green-300"></span>Vrij</div>
          <div class="flex items-center gap-1.5 text-xs text-slate-500"><span class="w-3 h-3 rounded-sm bg-red-100 border border-red-300"></span>Bezet</div>
          <div class="flex items-center gap-1.5 text-xs text-slate-500"><span class="w-3 h-3 rounded-sm bg-slate-100 border border-slate-300"></span>Onbekend</div>
        </div>
      </div>
    </div>

    <!-- ── Availability grid ── -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      <!-- Grid header -->
      <div class="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <div>
          <p class="font-semibold text-slate-900 text-sm">
            {{ dateLabel ?? 'Selecteer een datum' }}
          </p>
          <p v-if="dateLabel" class="text-xs text-slate-400 mt-0.5">{{ COURTS.find(c => c.id === selectedCourt)?.name }}</p>
        </div>
        <button
          v-if="selected && settings.isConfigured"
          @click="fetchDay(selected)"
          class="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          :class="loading ? 'animate-spin text-slate-400' : 'text-slate-400 hover:text-slate-600'"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-10 flex flex-col items-center gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
        <p class="text-sm text-slate-400">Beschikbaarheid ophalen…</p>
      </div>

      <!-- Error -->
      <div v-else-if="apiError" class="p-5 space-y-3">
        <div class="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{{ apiError }}</span>
        </div>
        <div v-if="rawData">
          <button @click="showRaw = !showRaw" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            {{ showRaw ? 'Verberg' : 'Toon' }} ruwe API-response
          </button>
          <pre v-if="showRaw" class="mt-2 text-xs bg-slate-950 text-green-400 p-4 rounded-xl overflow-auto max-h-48 font-mono">{{ JSON.stringify(rawData, null, 2) }}</pre>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!hasData" class="p-10 flex flex-col items-center gap-3 text-center">
        <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
          <CalendarDays class="w-6 h-6 text-slate-300" />
        </div>
        <p class="text-sm text-slate-400">Kies een datum in de kalender om de beschikbaarheid te zien</p>
      </div>

      <!-- Slot list -->
      <div v-else class="divide-y divide-slate-50">
        <div
          v-for="time in TIME_SLOTS"
          :key="time"
          class="flex items-center gap-4 px-5 py-2.5"
        >
          <span class="w-12 text-xs font-mono text-slate-400 flex-shrink-0">{{ time }}</span>

          <!-- Status pill -->
          <div class="flex-1">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              :class="{
                'bg-green-50 text-green-700 border border-green-200': slotStatus(time, selectedCourt) === 'available',
                'bg-red-50 text-red-700 border border-red-200':       slotStatus(time, selectedCourt) === 'booked',
                'bg-slate-100 text-slate-400 border border-slate-200': slotStatus(time, selectedCourt) === 'unknown',
              }"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="{
                'bg-green-500': slotStatus(time, selectedCourt) === 'available',
                'bg-red-500':   slotStatus(time, selectedCourt) === 'booked',
                'bg-slate-400': slotStatus(time, selectedCourt) === 'unknown',
              }"></span>
              {{ slotStatus(time, selectedCourt) === 'available' ? 'Vrij' : slotStatus(time, selectedCourt) === 'booked' ? 'Bezet' : '?' }}
            </span>
          </div>

          <!-- Book button -->
          <button
            v-if="slotStatus(time, selectedCourt) === 'available'"
            @click="bookSlot(time)"
            class="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-500 hover:bg-green-50 px-2.5 py-1.5 rounded-lg transition-all"
          >
            <Zap class="w-3 h-3" />
            Boek
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
