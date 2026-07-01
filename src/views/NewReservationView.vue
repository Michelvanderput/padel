<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MapPin, Users, Check, AlertCircle, ChevronLeft, ChevronRight, Zap, Timer, RefreshCw } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { useSettingsStore } from '@/stores/settings'
import { scheduleReservation } from '@/services/scheduler'
import { getAvailability } from '@/services/knltb'
import { COURTS, LOCATION } from '@/constants/courts'

const router   = useRouter()
const route    = useRoute()
const reservationsStore = useReservationsStore()
const membersStore      = useMembersStore()
const settings          = useSettingsStore()

// ── Form ─────────────────────────────────────────────────────
const form = ref({
  date:     route.query.date  || '',
  timeSlot: route.query.time  || '',
  duration: 60,
  courtId:  route.query.court || COURTS[0].id,
})

const selectedMemberIds = ref([])
const bookingMode       = ref('vooruit')

const computedTrigger = computed(() => {
  if (bookingMode.value === 'direct') return new Date().toISOString()
  if (!form.value.date || !form.value.timeSlot) return null
  const play = new Date(`${form.value.date}T${form.value.timeSlot}:00`)
  return new Date(play.getTime() - 72 * 60 * 60 * 1000).toISOString()
})

function formatTriggerPreview(iso) {
  return new Date(iso).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const isValid = computed(() =>
  form.value.date && form.value.timeSlot && form.value.courtId &&
  computedTrigger.value !== null && selectedMemberIds.value.length === 4
)

function toggleMember(id) {
  const idx = selectedMemberIds.value.indexOf(id)
  if (idx !== -1) selectedMemberIds.value.splice(idx, 1)
  else if (selectedMemberIds.value.length < 4) selectedMemberIds.value.push(id)
}
function getMember(id) { return membersStore.members.find(m => m.id === id) }

function submit() {
  if (!isValid.value) return
  reservationsStore.addReservation({
    location: LOCATION, date: form.value.date, timeSlot: form.value.timeSlot,
    duration: form.value.duration, courtId: form.value.courtId,
    bookingTrigger: computedTrigger.value, memberIds: [...selectedMemberIds.value]
  })
  const newRes = reservationsStore.reservations.at(-1)
  if (newRes) scheduleReservation(newRes)
  router.push('/wachtrij')
}

// ── Calendar ─────────────────────────────────────────────────
const today     = new Date()
const viewYear  = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleString('nl-NL', { month: 'long', year: 'numeric' })
)

const calDays = computed(() => {
  const y = viewYear.value, m = viewMonth.value
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
  const days = []
  let dow = first.getDay(); dow = dow === 0 ? 6 : dow - 1
  for (let i = dow - 1; i >= 0; i--) days.push({ d: new Date(y, m, -i), cur: false })
  for (let i = 1; i <= last.getDate(); i++) days.push({ d: new Date(y, m, i), cur: true })
  while (days.length % 7 !== 0) days.push({ d: new Date(y, m + 1, days.length - last.getDate() - dow + 1), cur: false })
  return days
})

function prevMonth() { if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- } else viewMonth.value-- }
function nextMonth() { if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ } else viewMonth.value++ }
function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString() }
function isPast(d)     { const c = new Date(d); c.setHours(23,59,59); return c < today }
function toDateStr(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

const selectedCalDate = computed(() => form.value.date ? new Date(form.value.date + 'T12:00:00') : null)

async function pickDate(d) {
  if (isPast(d)) return
  form.value.date     = toDateStr(d)
  form.value.timeSlot = ''
  await fetchSlots(d)
}

// ── Availability ─────────────────────────────────────────────
// slotMap: localTime (HH:MM) → { status: 'available'|'booked'|'closed', durations: number[] }
const TIME_SLOTS = []
for (let h = 7; h <= 21; h++) { TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`); TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`) }
TIME_SLOTS.push('22:00')

const avLoading = ref(false)
const avError   = ref(null)
const rawApiData = ref(null) // full response cached for court switching
const slotMap   = ref({})

function localKey(isoStr) {
  const d = new Date(isoStr)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function buildSlotMap(data, courtId) {
  const map = {}

  const courtEntry = data?.timeline_court_availability?.find(
    c => c.court_details?.id === courtId
  )
  if (!courtEntry) return map

  for (const block of (courtEntry.timeline?.blocks ?? [])) {
    if (block.block_type === 'available' && block.slots) {
      const fourP = block.slots['4players'] ?? []
      for (const slot of fourP) {
        if (!slot.available) continue
        const key = localKey(slot.start_time)
        const dur = Math.round((new Date(slot.end_time) - new Date(slot.start_time)) / 60000)
        if (!map[key]) map[key] = { status: 'available', durations: [] }
        if (!map[key].durations.includes(dur)) map[key].durations.push(dur)
      }
    } else if (block.block_type === 'reservation') {
      const cur = new Date(block.start)
      const end = new Date(block.end)
      while (cur < end) {
        const key = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`
        map[key] = { status: 'booked', durations: [] }
        cur.setMinutes(cur.getMinutes() + 30)
      }
    } else if (block.block_type === 'courtClosedByOpeningHours') {
      const cur = new Date(block.start)
      const end = new Date(block.end)
      while (cur < end) {
        const key = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`
        if (!map[key]) map[key] = { status: 'closed', durations: [] }
        cur.setMinutes(cur.getMinutes() + 30)
      }
    }
  }
  return map
}

async function fetchSlots(d) {
  if (!settings.isConfigured) { slotMap.value = {}; return }
  avLoading.value = true; avError.value = null; slotMap.value = {}; rawApiData.value = null
  try {
    const res = await getAvailability(settings.clubId, `${toDateStr(d)}T00:00:00`, settings.lisaToken)
    if (!res.ok) { avError.value = `API fout ${res.status}`; return }
    rawApiData.value = res.data
    slotMap.value = buildSlotMap(res.data, form.value.courtId)
  } catch (e) { avError.value = e.message }
  finally { avLoading.value = false }
}

const hasSlots = computed(() => Object.keys(slotMap.value).length > 0)

function slotInfo(time) {
  return slotMap.value[time] ?? { status: 'unknown', durations: [] }
}

function pickSlot(time) {
  const info = slotInfo(time)
  if (info.status === 'booked' || info.status === 'closed') return
  form.value.timeSlot = time
  // Auto-select duration if only one option available
  if (info.durations.length === 1) form.value.duration = info.durations[0]
  else if (info.durations.length > 1 && !info.durations.includes(form.value.duration)) {
    form.value.duration = info.durations[0]
  }
}

// Available durations for the currently selected time slot
const selectedSlotDurations = computed(() => {
  if (!form.value.timeSlot) return [60, 90]
  const d = slotInfo(form.value.timeSlot).durations
  return d.length > 0 ? d : [60, 90]
})

// Rebuild slotMap when court changes (data already cached)
watch(() => form.value.courtId, () => {
  if (rawApiData.value) {
    slotMap.value = buildSlotMap(rawApiData.value, form.value.courtId)
    form.value.timeSlot = ''
  } else if (form.value.date) {
    fetchSlots(new Date(form.value.date + 'T12:00:00'))
  }
})

// Pre-load if arriving with query params
if (route.query.date) fetchSlots(new Date(route.query.date + 'T12:00:00'))
</script>

<template>
  <div class="max-w-2xl space-y-5">

    <!-- Header -->
    <div>
      <button @click="router.back()" class="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-3 transition-colors">
        <ChevronLeft class="w-4 h-4" />Terug
      </button>
      <h1 class="text-2xl font-bold text-slate-900">Nieuwe reservering</h1>
      <p class="text-sm text-slate-400 mt-0.5">Kies een baan, datum en tijdslot</p>
    </div>

    <!-- ── Stap 1: Baan ── -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">1 — Kies baan</p>

      <!-- Location badge -->
      <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl w-fit">
        <MapPin class="w-3.5 h-3.5 text-slate-400" />
        <span class="text-xs font-medium text-slate-600">{{ LOCATION }}</span>
      </div>

      <!-- Court radio grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label
          v-for="court in COURTS" :key="court.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all text-sm"
          :class="form.courtId === court.id ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'"
        >
          <input type="radio" :value="court.id" v-model="form.courtId" class="sr-only" />
          <span class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
            :class="form.courtId === court.id ? 'border-green-500' : 'border-slate-300'">
            <span v-if="form.courtId === court.id" class="w-2 h-2 rounded-full bg-green-500"></span>
          </span>
          <span class="flex-1 font-medium" :class="form.courtId === court.id ? 'text-green-700' : 'text-slate-700'">{{ court.name }}</span>
          <span class="text-xs text-slate-400">{{ court.number }}</span>
        </label>
      </div>
    </div>

    <!-- ── Stap 2: Datum + Tijdslot ── -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-50">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">2 — Kies datum & tijdslot</p>
        <p v-if="!settings.isConfigured" class="text-xs text-amber-600 mt-1">
          ⚠ Geen token ingesteld — beschikbaarheid kan niet worden opgehaald
        </p>
      </div>

      <!-- Calendar -->
      <div class="p-4 border-b border-slate-50">
        <div class="flex items-center justify-between mb-3">
          <button @click="prevMonth" class="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><ChevronLeft class="w-4 h-4 text-slate-500" /></button>
          <span class="font-semibold text-slate-900 text-sm capitalize">{{ monthLabel }}</span>
          <button @click="nextMonth" class="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><ChevronRight class="w-4 h-4 text-slate-500" /></button>
        </div>
        <div class="grid grid-cols-7 mb-1">
          <div v-for="d in ['Ma','Di','Wo','Do','Vr','Za','Zo']" :key="d" class="text-center text-xs font-semibold text-slate-400 py-1">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 gap-y-0.5">
          <button
            v-for="({ d, cur }, i) in calDays" :key="i"
            @click="cur && !isPast(d) && pickDate(d)"
            class="relative h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-all"
            :class="[
              !cur                                          ? 'text-slate-200 cursor-default' : '',
              cur && isPast(d)                             ? 'text-slate-300 cursor-not-allowed' : '',
              cur && !isPast(d) && !sameDay(d, selectedCalDate) ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : '',
              sameDay(d, selectedCalDate)                  ? 'bg-green-500 text-white shadow shadow-green-500/30' : '',
              sameDay(d, today) && !sameDay(d, selectedCalDate) ? 'ring-2 ring-green-400 ring-offset-1' : '',
            ]"
          >{{ d.getDate() }}</button>
        </div>
      </div>

      <!-- Availability / time slot picker -->
      <div class="p-4">
        <!-- Not selected yet -->
        <p v-if="!form.date" class="text-sm text-slate-400 text-center py-4">
          ← Kies een datum in de kalender
        </p>

        <!-- Loading -->
        <div v-else-if="avLoading" class="flex items-center justify-center gap-3 py-6">
          <div class="w-5 h-5 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
          <span class="text-sm text-slate-400">Beschikbaarheid ophalen…</span>
        </div>

        <!-- Slots -->
        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Tijdsloten — {{ new Date(form.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) }}
            </p>
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400"></span>Vrij</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span>Bezet</span>
              <button v-if="settings.isConfigured" @click="fetchSlots(new Date(form.date + 'T12:00:00'))" class="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- API error -->
          <div v-if="avError" class="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />{{ avError }}
          </div>

          <!-- Slot chips -->
          <div class="flex flex-wrap gap-1.5">
            <template v-for="time in TIME_SLOTS" :key="time">
              <!-- Skip closed slots entirely -->
              <button
                v-if="slotInfo(time).status !== 'closed'"
                @click="pickSlot(time)"
                :disabled="slotInfo(time).status === 'booked'"
                class="flex flex-col items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all min-w-[3.5rem]"
                :class="{
                  'bg-green-500 text-white border-green-500 shadow shadow-green-500/25': form.timeSlot === time,
                  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer': slotInfo(time).status === 'available' && form.timeSlot !== time,
                  'bg-red-50 text-red-400 border-red-100 cursor-not-allowed opacity-60': slotInfo(time).status === 'booked',
                  'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 cursor-pointer': slotInfo(time).status === 'unknown' && form.timeSlot !== time,
                }"
              >
                <span>{{ time }}</span>
                <!-- Duration badges -->
                <span
                  v-if="slotInfo(time).status === 'available' || form.timeSlot === time"
                  class="flex gap-0.5 mt-0.5"
                >
                  <span
                    v-for="dur in slotInfo(time).durations" :key="dur"
                    class="text-[9px] font-bold px-1 rounded"
                    :class="form.timeSlot === time ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'"
                  >{{ dur }}'</span>
                </span>
                <span v-if="slotInfo(time).status === 'booked'" class="text-[9px] mt-0.5 font-medium">bezet</span>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Stap 3: Speelduur + Boekwijze ── -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
      <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide">3 — Speelduur & boekwijze</p>

      <!-- Duration -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-slate-700">Speelduur</label>
          <span v-if="form.timeSlot && selectedSlotDurations.length === 1" class="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            ⚡ Prime time — alleen {{ selectedSlotDurations[0] }} min
          </span>
        </div>
        <div class="flex gap-3">
          <label v-for="d in selectedSlotDurations" :key="d"
            class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-medium select-none"
            :class="form.duration === d ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'"
          >
            <input type="radio" :value="d" v-model="form.duration" class="sr-only" />
            <span class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              :class="form.duration === d ? 'border-green-500' : 'border-slate-300'">
              <span v-if="form.duration === d" class="w-2 h-2 rounded-full bg-green-500"></span>
            </span>
            {{ d }} min
          </label>
        </div>
      </div>

      <!-- Booking mode -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Boekwijze</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-2 p-4 rounded-xl border cursor-pointer transition-all"
            :class="bookingMode === 'vooruit' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'">
            <input type="radio" value="vooruit" v-model="bookingMode" class="sr-only" />
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" :class="bookingMode === 'vooruit' ? 'bg-green-500' : 'bg-slate-100'">
                <Timer class="w-4 h-4" :class="bookingMode === 'vooruit' ? 'text-white' : 'text-slate-400'" />
              </div>
              <span class="text-sm font-semibold" :class="bookingMode === 'vooruit' ? 'text-green-700' : 'text-slate-700'">Vooruit boeken</span>
            </div>
            <p class="text-xs leading-relaxed" :class="bookingMode === 'vooruit' ? 'text-green-600' : 'text-slate-400'">Precies 72 uur voor het tijdslot, op de milliseconde</p>
          </label>
          <label class="flex flex-col gap-2 p-4 rounded-xl border cursor-pointer transition-all"
            :class="bookingMode === 'direct' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'">
            <input type="radio" value="direct" v-model="bookingMode" class="sr-only" />
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" :class="bookingMode === 'direct' ? 'bg-blue-500' : 'bg-slate-100'">
                <Zap class="w-4 h-4" :class="bookingMode === 'direct' ? 'text-white' : 'text-slate-400'" />
              </div>
              <span class="text-sm font-semibold" :class="bookingMode === 'direct' ? 'text-blue-700' : 'text-slate-700'">Direct boeken</span>
            </div>
            <p class="text-xs leading-relaxed" :class="bookingMode === 'direct' ? 'text-blue-600' : 'text-slate-400'">Probeert meteen te plaatsen</p>
          </label>
        </div>

        <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0">
          <div v-if="computedTrigger" class="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
            :class="bookingMode === 'direct' ? 'bg-blue-50 border border-blue-100' : 'bg-green-50 border border-green-100'">
            <Timer class="w-3.5 h-3.5 flex-shrink-0" :class="bookingMode === 'direct' ? 'text-blue-400' : 'text-green-400'" />
            <span :class="bookingMode === 'direct' ? 'text-blue-700' : 'text-green-700'">
              <span class="font-medium">Boekmoment: </span>{{ formatTriggerPreview(computedTrigger) }}
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Member selection -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Users class="w-4 h-4 text-gray-400" />
          <h2 class="font-semibold text-gray-900">Selecteer 4 leden</h2>
        </div>
        <div
          class="flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full transition-colors"
          :class="selectedMemberIds.length === 4 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'"
        >
          {{ selectedMemberIds.length }} / 4
        </div>
      </div>

      <!-- No members warning -->
      <div v-if="membersStore.members.length === 0" class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <AlertCircle class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-semibold text-amber-800">Nog geen leden toegevoegd</p>
          <p class="text-sm text-amber-700 mt-0.5">
            Voeg eerst KNLTB lidnummers toe op de <RouterLink to="/leden" class="underline font-medium">Leden pagina</RouterLink>.
          </p>
        </div>
      </div>

      <!-- Members grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          v-for="member in membersStore.members"
          :key="member.id"
          @click="toggleMember(member.id)"
          :disabled="!selectedMemberIds.includes(member.id) && selectedMemberIds.length >= 4"
          class="relative flex flex-col items-start p-3 rounded-xl border transition-all text-left"
          :class="[
            selectedMemberIds.includes(member.id)
              ? 'border-green-500 bg-green-50 shadow-sm'
              : selectedMemberIds.length >= 4
              ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
              : 'border-gray-200 hover:border-green-300 hover:bg-gray-50 cursor-pointer'
          ]"
        >
          <div
            v-if="selectedMemberIds.includes(member.id)"
            class="absolute top-2 right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
          >
            <Check class="w-3 h-3 text-white" />
          </div>
          <span class="text-sm font-semibold text-gray-900 pr-7 leading-tight">{{ member.name }}</span>
          <span class="text-xs text-gray-500 font-mono mt-1">{{ member.memberNumber }}</span>
        </button>
      </div>
    </div>

    <!-- Selected order summary -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div v-if="selectedMemberIds.length > 0" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p class="text-sm font-semibold text-gray-900 mb-3">Geselecteerde leden (volgorde)</p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(id, i) in selectedMemberIds"
            :key="id"
            class="flex items-center gap-2 bg-green-50 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium"
          >
            <span class="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {{ i + 1 }}
            </span>
            {{ getMember(id)?.name }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- Validation hint -->
    <div v-if="!isValid && (form.date || selectedMemberIds.length > 0)" class="flex items-center gap-2 text-sm text-amber-600">
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      <span>
        <template v-if="!form.date">Kies een speeldatum. </template>
        <template v-if="selectedMemberIds.length < 4">Selecteer nog {{ 4 - selectedMemberIds.length }} lid{{ 4 - selectedMemberIds.length !== 1 ? 'en' : '' }}. </template>
      </span>
    </div>

    <!-- Submit -->
    <button
      @click="submit"
      :disabled="!isValid"
      class="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
      :class="isValid
        ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25'
        : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
    >
      Reservering toevoegen aan wachtrij
    </button>

  </div>
</template>
