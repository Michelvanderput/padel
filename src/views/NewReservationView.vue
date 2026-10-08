<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MapPin, AlertCircle, ChevronLeft, ChevronRight, Zap, Timer, RefreshCw, ArrowUpRight } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { useSettingsStore } from '@/stores/settings'
import { scheduleReservation } from '@/services/scheduler'
import { getAvailability } from '@/services/knltb'
import { buildSlotMap, effectiveDuration, TIME_SLOTS } from '@/services/availability'
import { useCourtsStore } from '@/stores/courts'
import { LOCATION } from '@/constants/courts'
import PageHeader from '@/components/PageHeader.vue'
import { useReveal } from '@/composables/useReveal'

const root = ref(null)
useReveal(root)

const router   = useRouter()
const route    = useRoute()
const reservationsStore = useReservationsStore()
const membersStore      = useMembersStore()
const settings          = useSettingsStore()
const courtsStore       = useCourtsStore()

// ── Form ─────────────────────────────────────────────────────
const form = ref({
  date:     route.query.date  || '',
  timeSlot: route.query.time  || '',
  duration: 90,      // KNLTB bepaalt de duur zelf (meestal 90)
  minDuration: 60,   // 90 = alleen boeken als KNLTB minimaal 90 minuten geeft
  courtId:  route.query.court || courtsStore.courts[0]?.id || '',
})

const selectedMemberIds = ref([])
const bookingMode       = ref('vooruit')

const computedTrigger = computed(() => {
  if (bookingMode.value === 'direct') return new Date().toISOString()
  if (!form.value.date || !form.value.timeSlot) return null
  const play = new Date(`${form.value.date}T${form.value.timeSlot}:00`)
  return new Date(play.getTime() - 72 * 60 * 60 * 1000 - 2 * 60 * 1000).toISOString()
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

async function submit() {
  if (!isValid.value) return
  const newRes = await reservationsStore.addReservation({
    location: LOCATION, date: form.value.date, timeSlot: form.value.timeSlot,
    duration: form.value.duration, minDuration: form.value.minDuration, courtId: form.value.courtId,
    bookingTrigger: computedTrigger.value, memberIds: [...selectedMemberIds.value]
  })
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
// slotMap: Amsterdamse tijd (HH:MM) → { status, durations, opensAt? } — zie services/availability.js
const avLoading = ref(false)
const avError   = ref(null)
const rawApiData = ref(null) // full response cached for court switching
const slotMap   = ref({})

async function fetchSlots(d) {
  if (!settings.isConfigured) { slotMap.value = {}; return }
  avLoading.value = true; avError.value = null; slotMap.value = {}; rawApiData.value = null
  try {
    const res = await getAvailability(settings.clubId, `${toDateStr(d)}T00:00:00`, settings.lisaToken)
    if (!res.ok) { avError.value = res.status === 401 ? 'Token ongeldig of verlopen — vernieuw het bij Instellingen' : `API fout ${res.status}`; return }
    rawApiData.value = res.data
    slotMap.value = buildSlotMap(res.data, form.value.courtId)
    syncDuration()
  } catch (e) { avError.value = e.message }
  finally { avLoading.value = false }
}

const hasSlots = computed(() => Object.keys(slotMap.value).length > 0)

function slotInfo(time) {
  return slotMap.value[time] ?? { status: 'unknown', durations: [] }
}

// De duur wordt door KNLTB bepaald (langste slot dat op dit startpunt past); meesturen heeft geen effect.
function syncDuration() {
  form.value.duration = effectiveDuration(slotInfo(form.value.timeSlot))
}

function pickSlot(time) {
  const info = slotInfo(time)
  if (['booked', 'closed', 'buffer', 'short'].includes(info.status)) return
  form.value.timeSlot = time
  syncDuration()
}

function slotTitle(time) {
  const i = slotInfo(time)
  const label = { booked: 'Bezet', short: 'Te kort (minder dan 60 min vrij)', buffer: 'Wisseltijd na een vorige boeking', closed: 'Baan dicht' }[i.status]
  if (label) return label
  if (i.status === 'later') return `Nog niet te boeken — opent ${new Date(i.opensAt).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}`
  return ''
}

const unavailable = status => ['booked', 'closed', 'buffer', 'short'].includes(status)

// Rebuild slotMap when court changes (data already cached)
watch(() => form.value.courtId, () => {
  if (rawApiData.value) {
    slotMap.value = buildSlotMap(rawApiData.value, form.value.courtId)
    form.value.timeSlot = ''
    syncDuration()
  } else if (form.value.date) {
    fetchSlots(new Date(form.value.date + 'T12:00:00'))
  }
})

// Pre-load if arriving with query params
if (route.query.date) fetchSlots(new Date(route.query.date + 'T12:00:00'))
</script>

<template>
  <div ref="root" class="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-8 sm:pt-40">

    <button @click="router.back()" data-reveal class="mb-6 inline-flex items-center gap-1 text-sm text-mist transition-colors hover:text-fog">
      <ChevronLeft class="h-4 w-4" />Terug
    </button>

    <PageHeader eyebrow="Reserveren" title="Nieuwe&#10;reservering" subtitle="Kies een baan, datum, tijdslot en vier maatjes. Wij doen de rest." />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div class="space-y-6">

        <!-- ── Stap 1: Baan ── -->
        <section data-reveal class="panel p-6 sm:p-8" aria-labelledby="step-1">
          <div class="mb-6 flex items-start justify-between gap-4">
            <h2 id="step-1" class="flex items-baseline gap-4"><span class="display text-5xl text-lime">01</span><span class="display text-2xl text-fog">Kies baan</span></h2>
            <span class="chip"><MapPin class="h-3.5 w-3.5 text-lime" />{{ LOCATION }}</span>
          </div>

          <div role="radiogroup" aria-labelledby="step-1" class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label
              v-for="court in courtsStore.courts" :key="court.id"
              class="group flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-lime/40"
              :class="form.courtId === court.id ? 'border-lime bg-lime/10' : 'border-line hover:border-white/25 hover:bg-white/[0.04]'"
            >
              <input type="radio" :value="court.id" v-model="form.courtId" class="sr-only" />
              <span class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors" :class="form.courtId === court.id ? 'border-lime' : 'border-mist/60'">
                <span v-if="form.courtId === court.id" class="h-2 w-2 rounded-full bg-lime"></span>
              </span>
              <span class="flex-1 text-sm font-semibold" :class="form.courtId === court.id ? 'text-lime' : 'text-fog'">{{ court.name }}</span>
              <span class="font-mono text-xs text-mist">#{{ court.number }}</span>
            </label>
          </div>
        </section>

        <!-- ── Stap 2: Datum + tijdslot ── -->
        <section data-reveal class="panel overflow-hidden" aria-labelledby="step-2">
          <div class="p-6 pb-0 sm:p-8 sm:pb-0">
            <h2 id="step-2" class="flex items-baseline gap-4"><span class="display text-5xl text-lime">02</span><span class="display text-2xl text-fog">Datum &amp; tijdslot</span></h2>
            <p v-if="!settings.isConfigured" class="note note-amber mt-4">
              <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />Geen token ingesteld — beschikbaarheid kan niet worden opgehaald.
            </p>
          </div>

          <!-- Calendar -->
          <div class="border-b border-line p-6 sm:px-8">
            <div class="mb-4 flex items-center justify-between">
              <button @click="prevMonth" class="btn-icon !h-10 !w-10 border border-line" aria-label="Vorige maand"><ChevronLeft class="h-4 w-4" /></button>
              <span class="display text-xl capitalize text-fog">{{ monthLabel }}</span>
              <button @click="nextMonth" class="btn-icon !h-10 !w-10 border border-line" aria-label="Volgende maand"><ChevronRight class="h-4 w-4" /></button>
            </div>
            <div class="mb-1 grid grid-cols-7">
              <div v-for="d in ['Ma','Di','Wo','Do','Vr','Za','Zo']" :key="d" class="eyebrow py-1.5 text-center">{{ d }}</div>
            </div>
            <div class="grid grid-cols-7 gap-1">
              <button
                v-for="({ d, cur }, i) in calDays" :key="i"
                @click="cur && !isPast(d) && pickDate(d)"
                :disabled="!cur || isPast(d)"
                :aria-label="d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })"
                :aria-pressed="sameDay(d, selectedCalDate)"
                class="relative flex aspect-square max-h-12 items-center justify-center rounded-full text-sm font-semibold tabular transition-all duration-300 ease-out-expo"
                :class="[
                  !cur ? 'invisible' : '',
                  cur && isPast(d) ? 'cursor-not-allowed text-mist/35' : '',
                  cur && !isPast(d) && !sameDay(d, selectedCalDate) ? 'text-fog hover:bg-white/10' : '',
                  sameDay(d, selectedCalDate) ? 'scale-110 bg-lime text-ink shadow-[0_8px_30px_-6px_rgba(205,255,46,0.55)]' : '',
                  sameDay(d, today) && !sameDay(d, selectedCalDate) ? 'ring-1 ring-lime/70' : '',
                ]"
              >{{ d.getDate() }}</button>
            </div>
          </div>

          <!-- Slots -->
          <div class="p-6 sm:p-8">
            <p v-if="!form.date" class="py-6 text-center text-mist">Kies eerst een datum in de kalender.</p>

            <div v-else-if="avLoading" class="flex items-center justify-center gap-3 py-8" role="status">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-lime border-t-transparent"></div>
              <span class="text-sm text-mist">Beschikbaarheid ophalen…</span>
            </div>

            <div v-else>
              <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p class="eyebrow !text-fog">
                  {{ new Date(form.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) }}
                </p>
                <div class="flex items-center gap-4 text-xs text-mist">
                  <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-lime"></span>Vrij</span>
                  <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-danger"></span>Bezet</span>
                  <button v-if="settings.isConfigured" @click="fetchSlots(new Date(form.date + 'T12:00:00'))" class="btn-icon !h-8 !w-8" aria-label="Ververs beschikbaarheid">
                    <RefreshCw class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div v-if="avError" class="note note-amber mb-4">
                <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />{{ avError }}
              </div>

              <div class="flex flex-wrap gap-2">
                <template v-for="time in TIME_SLOTS" :key="time">
                  <button
                    v-if="slotInfo(time).status !== 'closed'"
                    @click="pickSlot(time)"
                    :disabled="unavailable(slotInfo(time).status)"
                    :aria-pressed="form.timeSlot === time"
                    :title="slotTitle(time)"
                    class="flex min-w-[4.25rem] flex-col items-center rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-300 ease-out-expo"
                    :class="{
                      'border-lime bg-lime text-ink shadow-[0_8px_30px_-8px_rgba(205,255,46,0.6)]': form.timeSlot === time,
                      'border-lime/25 bg-lime/[0.07] text-lime hover:bg-lime/15': slotInfo(time).status === 'available' && form.timeSlot !== time,
                      'cursor-not-allowed border-line bg-white/[0.02] text-mist/50 line-through': ['booked', 'short'].includes(slotInfo(time).status),
                      'cursor-not-allowed border-dashed border-line bg-white/[0.02] text-mist/50': slotInfo(time).status === 'buffer',
                      'border-line bg-white/[0.04] text-mist hover:bg-white/10': ['unknown', 'later'].includes(slotInfo(time).status) && form.timeSlot !== time,
                    }"
                  >
                    <span class="font-mono tabular">{{ time }}</span>
                    <span v-if="slotInfo(time).status === 'available' || form.timeSlot === time" class="mt-0.5 flex gap-1">
                      <span v-for="dur in slotInfo(time).durations" :key="dur" class="rounded px-1 font-mono text-[9px] font-bold" :class="form.timeSlot === time ? 'bg-ink/15' : 'bg-lime/15'">{{ dur }}'</span>
                    </span>
                  </button>
                </template>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Stap 3: Speelduur + boekwijze ── -->
        <section data-reveal class="panel p-6 sm:p-8" aria-labelledby="step-3">
          <h2 id="step-3" class="mb-6 flex items-baseline gap-4"><span class="display text-5xl text-lime">03</span><span class="display text-2xl text-fog">Duur &amp; boekwijze</span></h2>

          <div class="mb-7">
            <span class="label">Speelduur</span>
            <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-5 py-4">
              <Timer class="h-4 w-4 flex-shrink-0 text-lime" />
              <p class="text-sm text-mist">
                <template v-if="form.timeSlot && slotInfo(form.timeSlot).durations.length">
                  KNLTB boekt hier <strong class="text-fog">{{ form.duration }} minuten</strong>
                  <template v-if="form.duration === 60"> (prime time)</template>.
                </template>
                <template v-else>De duur wordt door KNLTB bepaald: <strong class="text-fog">meestal 90 minuten</strong>, op prime time 60.</template>
                <span class="text-mist/80"> Dit kun je niet zelf kiezen.</span>
              </p>
            </div>

            <!-- Controle vóór het boeken: sommige tijden geven alleen 60 minuten (prime time) -->
            <div role="radiogroup" aria-label="Minimale duur" class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-lime/40"
                :class="form.minDuration === 60 ? 'border-lime bg-lime/10' : 'border-line hover:border-white/25'">
                <input type="radio" :value="60" v-model="form.minDuration" class="sr-only" />
                <span class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2" :class="form.minDuration === 60 ? 'border-lime' : 'border-mist/60'"><span v-if="form.minDuration === 60" class="h-2 w-2 rounded-full bg-lime"></span></span>
                <span><span class="block text-sm font-semibold" :class="form.minDuration === 60 ? 'text-lime' : 'text-fog'">Boek altijd</span><span class="mt-0.5 block text-xs text-mist">60 of 90 minuten, wat KNLTB geeft.</span></span>
              </label>
              <label class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-lime/40"
                :class="form.minDuration === 90 ? 'border-lime bg-lime/10' : 'border-line hover:border-white/25'">
                <input type="radio" :value="90" v-model="form.minDuration" class="sr-only" />
                <span class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2" :class="form.minDuration === 90 ? 'border-lime' : 'border-mist/60'"><span v-if="form.minDuration === 90" class="h-2 w-2 rounded-full bg-lime"></span></span>
                <span><span class="block text-sm font-semibold" :class="form.minDuration === 90 ? 'text-lime' : 'text-fog'">Alleen als het 90 min kan</span><span class="mt-0.5 block text-xs text-mist">Vlak vóór het boeken vraagt de app KNLTB de duur; bij 60 minuten wordt er niet geboekt.</span></span>
              </label>
            </div>
            <p v-if="form.minDuration === 90 && form.timeSlot && slotInfo(form.timeSlot).durations.length && effectiveDuration(slotInfo(form.timeSlot)) < 90" class="note note-amber mt-3">
              <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />Op dit tijdstip is nu alleen {{ effectiveDuration(slotInfo(form.timeSlot)) }} minuten te boeken — er wordt dan niet geboekt.
            </p>
          </div>

          <div>
            <span class="label">Boekwijze</span>
            <div role="radiogroup" aria-label="Boekwijze" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                class="flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-lime/40"
                :class="bookingMode === 'vooruit' ? 'border-lime bg-lime/10' : 'border-line hover:border-white/25'"
              >
                <input type="radio" value="vooruit" v-model="bookingMode" class="sr-only" />
                <span class="flex items-center gap-3">
                  <span class="flex h-9 w-9 items-center justify-center rounded-full" :class="bookingMode === 'vooruit' ? 'bg-lime text-ink' : 'bg-white/10 text-mist'"><Timer class="h-4 w-4" /></span>
                  <span class="display text-xl" :class="bookingMode === 'vooruit' ? 'text-lime' : 'text-fog'">Vooruit boeken</span>
                </span>
                <span class="text-sm leading-relaxed text-mist">Precies 72 uur voor het tijdslot, op de milliseconde.</span>
              </label>
              <label
                class="flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition-all duration-300 ease-out-expo focus-within:ring-2 focus-within:ring-sky/40"
                :class="bookingMode === 'direct' ? 'border-sky bg-sky/10' : 'border-line hover:border-white/25'"
              >
                <input type="radio" value="direct" v-model="bookingMode" class="sr-only" />
                <span class="flex items-center gap-3">
                  <span class="flex h-9 w-9 items-center justify-center rounded-full" :class="bookingMode === 'direct' ? 'bg-sky text-ink' : 'bg-white/10 text-mist'"><Zap class="h-4 w-4" /></span>
                  <span class="display text-xl" :class="bookingMode === 'direct' ? 'text-sky' : 'text-fog'">Direct boeken</span>
                </span>
                <span class="text-sm leading-relaxed text-mist">Probeert de baan meteen te plaatsen.</span>
              </label>
            </div>
          </div>
        </section>

        <!-- ── Stap 4: Leden ── -->
        <section data-reveal class="panel p-6 sm:p-8" aria-labelledby="step-4">
          <div class="mb-6 flex items-start justify-between gap-4">
            <h2 id="step-4" class="flex items-baseline gap-4"><span class="display text-5xl text-lime">04</span><span class="display text-2xl text-fog">Vier maatjes</span></h2>
            <span class="chip tabular transition-colors" :class="selectedMemberIds.length === 4 ? '!border-lime/40 !bg-lime/10 !text-lime' : ''">{{ selectedMemberIds.length }} / 4</span>
          </div>

          <div v-if="membersStore.members.length === 0" class="note note-amber">
            <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p class="font-semibold">Nog geen leden toegevoegd</p>
              <p class="mt-0.5 text-amber/80">Voeg eerst KNLTB lidnummers toe op de <RouterLink to="/leden" class="underline">Leden pagina</RouterLink>.</p>
            </div>
          </div>

          <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              v-for="member in membersStore.members" :key="member.id"
              @click="toggleMember(member.id)"
              :disabled="!selectedMemberIds.includes(member.id) && selectedMemberIds.length >= 4"
              :aria-pressed="selectedMemberIds.includes(member.id)"
              class="relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-300 ease-out-expo"
              :class="selectedMemberIds.includes(member.id)
                ? 'border-lime bg-lime/10'
                : selectedMemberIds.length >= 4
                  ? 'cursor-not-allowed border-line opacity-35'
                  : 'border-line hover:border-white/25 hover:bg-white/[0.04]'"
            >
              <span
                v-if="selectedMemberIds.includes(member.id)"
                class="display absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-lime text-sm text-ink"
              >{{ selectedMemberIds.indexOf(member.id) + 1 }}</span>
              <span class="pr-8 text-sm font-semibold leading-tight text-fog">{{ member.name }}</span>
              <span class="mt-1.5 font-mono text-xs text-mist">{{ member.memberNumber || '—' }}</span>
              <span v-if="!member.clubMemberId" class="mt-2 text-[11px] font-medium text-amber">geen UUID</span>
            </button>
          </div>
        </section>
      </div>

      <!-- ── Samenvatting (blijft in beeld) ── -->
      <aside data-reveal class="lg:sticky lg:top-28">
        <div class="panel-solid overflow-hidden">
          <div class="border-b border-dashed border-line bg-lime px-6 py-5 text-ink">
            <p class="eyebrow !text-ink/70">Jouw reservering</p>
            <p class="display mt-1 text-4xl tabular">
              <template v-if="form.timeSlot">{{ form.timeSlot }} <span class="text-xl opacity-60">· {{ form.duration }}′</span></template>
              <span v-else class="text-2xl opacity-60">Kies een tijdslot</span>
            </p>
          </div>

          <dl class="space-y-4 px-6 py-5 text-sm">
            <div>
              <dt class="eyebrow">Baan</dt>
              <dd class="mt-1 font-semibold text-fog">{{ courtsStore.courts.find(c => c.id === form.courtId)?.name ?? '—' }}</dd>
            </div>
            <div>
              <dt class="eyebrow">Datum</dt>
              <dd class="mt-1 font-semibold text-fog">
                {{ form.date ? new Date(form.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : '—' }}
              </dd>
            </div>
            <div>
              <dt class="eyebrow">Maatjes</dt>
              <dd class="mt-1.5 flex flex-wrap gap-1.5">
                <span v-for="(id, i) in selectedMemberIds" :key="id" class="chip !border-lime/30 !bg-lime/10 !text-lime">
                  <span class="font-mono text-[10px]">{{ i + 1 }}</span>{{ getMember(id)?.name }}
                </span>
                <span v-if="selectedMemberIds.length === 0" class="text-mist">—</span>
              </dd>
            </div>
            <div v-if="computedTrigger" class="rounded-2xl border px-4 py-3" :class="bookingMode === 'direct' ? 'border-sky/30 bg-sky/10' : 'border-lime/30 bg-lime/10'">
              <dt class="eyebrow" :class="bookingMode === 'direct' ? '!text-sky' : '!text-lime'">Boekmoment</dt>
              <dd class="mt-1 text-sm font-semibold text-fog first-letter:uppercase">{{ formatTriggerPreview(computedTrigger) }}</dd>
            </div>
          </dl>

          <div class="px-6 pb-6">
            <div v-if="!isValid && (form.date || selectedMemberIds.length > 0)" class="mb-4 flex items-start gap-2 text-sm text-amber">
              <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <template v-if="!form.date">Kies een speeldatum. </template>
                <template v-else-if="!form.timeSlot">Kies een tijdslot. </template>
                <template v-if="selectedMemberIds.length < 4">Selecteer nog {{ 4 - selectedMemberIds.length }} lid{{ 4 - selectedMemberIds.length !== 1 ? 'en' : '' }}.</template>
              </span>
            </div>
            <button @click="submit" :disabled="!isValid" class="btn btn-primary w-full !py-4 text-base">
              Aan wachtrij toevoegen <ArrowUpRight class="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>

  </div>
</template>
