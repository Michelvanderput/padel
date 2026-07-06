<script setup>
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Clock, Zap, CheckCircle2, Users, Plus, ChevronRight, Calendar, Target, RefreshCw, AlertCircle } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { useSettingsStore } from '@/stores/settings'
import { useCourtsStore } from '@/stores/courts'
import { getReservations } from '@/services/knltb'
import StatusBadge from '@/components/StatusBadge.vue'

const reservationsStore = useReservationsStore()
const membersStore = useMembersStore()
const settings = useSettingsStore()
const courtsStore = useCourtsStore()

const stats = computed(() => ({
  pending:  reservationsStore.reservations.filter(r => r.status === 'pending').length,
  active:   reservationsStore.reservations.filter(r => r.status === 'active').length,
  reserved: reservationsStore.reservations.filter(r => r.status === 'reserved').length,
  members:  membersStore.members.length,
}))

const upcoming = computed(() =>
  [...reservationsStore.reservations]
    .filter(r => ['pending', 'active'].includes(r.status))
    .sort((a, b) => new Date(a.bookingTrigger) - new Date(b.bookingTrigger))
    .slice(0, 5)
)

function getCourtName(id) {
  return courtsStore.courts.find(c => c.id === id)?.name ?? 'Onbekende baan'
}

function getMemberNames(ids) {
  return ids
    .map(id => membersStore.members.find(m => m.id === id))
    .filter(Boolean)
    .map(m => m.name.split(' ')[0])
    .join(' · ')
}

function formatDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTrigger(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Live KNLTB reserveringen ─────────────────────────────────
const liveReservations = ref([])   // alle club-reserveringen (ongefilterd)
const liveLoading = ref(false)
const liveError = ref(null)
const showAllClub = ref(false)     // false = alleen "onze" reserveringen tonen

const displayedReservations = computed(() => {
  if (showAllClub.value) return liveReservations.value
  const filtered = liveReservations.value.filter(r => isOwnReservation(r) !== false)
  return filtered
})

// Haal de starttijd uit een reservering-object — de exacte veldnaam is niet
// bevestigd met een echte response, dus we proberen meerdere varianten
// (ook genest onder court_booking / slot, gezien velden als
// show_details_in_courtbooking die op zo'n structuur wijzen).
function getStartAt(r) {
  return r.start_at ?? r.start_time ?? r.starts_at ?? r.startAt
    ?? r.court_booking?.start_at ?? r.court_booking?.start_time
    ?? r.slot?.start_at ?? r.slot?.start_time
    ?? null
}

function getEndAt(r) {
  return r.end_at ?? r.end_time ?? r.ends_at ?? r.endAt
    ?? r.court_booking?.end_at ?? r.court_booking?.end_time
    ?? r.slot?.end_at ?? r.slot?.end_time
    ?? null
}

async function fetchLiveReservations() {
  if (!settings.isConfigured) return
  liveLoading.value = true
  liveError.value = null
  try {
    const res = await getReservations(settings.clubId, settings.lisaToken)
    if (!res.ok) { liveError.value = `API fout ${res.status}`; return }
    const data = res.data
    const list = data?.reservations ?? data?.data ?? (Array.isArray(data) ? data : [])

    const withStart = list.filter(r => getStartAt(r))
    if (list.length > 0 && withStart.length === 0) {
      console.warn('[Dashboard] Reserveringen ontvangen maar starttijd-veld niet herkend. Voorbeeld item:', list[0])
      liveError.value = `${list.length} reservering(en) ontvangen maar veldnamen niet herkend — check console/API-log.`
    }

    liveReservations.value = withStart
      .filter(r => new Date(getStartAt(r)) >= new Date())
      .sort((a, b) => new Date(getStartAt(a)) - new Date(getStartAt(b)))
  } catch (e) { liveError.value = e.message }
  finally { liveLoading.value = false }
}

function formatLiveDate(r) {
  return new Date(getStartAt(r)).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatLiveTime(r) {
  return new Date(getStartAt(r)).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatLiveEndTime(r) {
  const end = getEndAt(r)
  return end ? new Date(end).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '?'
}

function getCourtNameFromRes(r) {
  return r.court?.name ?? r.court_name ?? r.court_booking?.court?.name
    ?? courtsStore.courts.find(c => c.id === (r.court_id ?? r.court_booking?.court_id))?.name
    ?? 'Onbekende baan'
}

function getParticipants(r) {
  return r.participants ?? r.club_members ?? r.members ?? r.court_booking?.participants ?? []
}

function getParticipantNames(r) {
  return getParticipants(r).map(m => (m.full_name ?? m.name ?? '').split(' ')[0]).filter(Boolean).join(' · ')
}

// Dit endpoint geeft ALLE reserveringen van de hele club terug (zie
// getReservations in services/knltb.js — geen lid-filter in de URL).
// We filteren hier client-side op onze eigen groep leden (Sander, Eddie,
// Lerau, Michel), zodat alleen "onze" reserveringen op het dashboard
// verschijnen. Matching gebeurt zowel op UUID als op naam, omdat de
// participant-ID's in dit endpoint niet gegarandeerd hetzelfde formaat
// hebben als clubMemberId elders in de app.
function isOwnReservation(r) {
  const participants = getParticipants(r)
  if (participants.length === 0) return null // structuur onbekend — kunnen we niet checken

  const ourIds   = membersStore.members.map(m => m.clubMemberId).filter(Boolean)
  const ourNames = membersStore.members.map(m => m.name.toLowerCase().trim())

  const matchById = participants.some(p => {
    const id = p.id ?? p.club_member_id ?? p.uuid ?? p.member_id
    return id && ourIds.includes(id)
  })
  if (matchById) return true

  const matchByName = participants.some(p => {
    const name = (p.full_name ?? p.name ?? '').toLowerCase().trim()
    if (!name) return false
    return ourNames.some(our => our === name || name.includes(our.split(' ')[0]) || our.includes(name.split(' ')[0]))
  })
  if (matchByName) return true

  console.warn('[Dashboard] Reservering matcht geen van onze leden — participants:', participants)
  return false
}

onMounted(fetchLiveReservations)

const photos = [
  { src: '/photos/padel (1).png', alt: 'Padel actie bij het net' },
  { src: '/photos/padel (2).png', alt: 'Smash boven het net' },
  { src: '/photos/padel (5).png', alt: 'Kampioenen met beker' },
  { src: '/photos/padel (4).png', alt: 'Vier spelers in actie' },
]
</script>

<template>
  <div class="space-y-6">

    <!-- Hero banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 lg:p-8">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/20 via-transparent to-transparent"></div>
      <div class="relative flex items-center justify-between gap-6">
        <div class="flex-1 min-w-0">
          <p class="text-green-400 text-xs font-semibold uppercase tracking-widest mb-2">Ready Maastricht</p>
          <h1 class="text-2xl lg:text-3xl font-bold text-white mb-1">Padel Maatjes</h1>
          <p class="text-slate-400 text-sm mb-6">Automatisch reserveren zodra de baan beschikbaar komt</p>
          <div class="flex flex-wrap gap-3">
            <RouterLink
              to="/nieuw"
              class="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-green-500/25"
            >
              <Plus class="w-4 h-4" />
              Nieuwe reservering
            </RouterLink>
            <RouterLink
              to="/wachtrij"
              class="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all backdrop-blur-sm border border-white/10"
            >
              <Target class="w-4 h-4" />
              Bekijk wachtrij
            </RouterLink>
          </div>
        </div>
        <img
          src="/logo.png"
          alt="Padel Maatjes"
          class="hidden sm:block w-28 h-28 lg:w-36 lg:h-36 rounded-full object-cover flex-shrink-0 shadow-2xl ring-4 ring-white/10"
        />
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Wachtend</span>
          <div class="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock class="w-4 h-4 text-amber-500" />
          </div>
        </div>
        <p class="text-3xl font-bold text-slate-900">{{ stats.pending }}</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Actief</span>
          <div class="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <Zap class="w-4 h-4 text-blue-500" />
          </div>
        </div>
        <p class="text-3xl font-bold text-slate-900">{{ stats.active }}</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Gereserveerd</span>
          <div class="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 class="w-4 h-4 text-green-500" />
          </div>
        </div>
        <p class="text-3xl font-bold text-slate-900">{{ stats.reserved }}</p>
      </div>
      <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Leden</span>
          <div class="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <Users class="w-4 h-4 text-violet-500" />
          </div>
        </div>
        <p class="text-3xl font-bold text-slate-900">{{ stats.members }}</p>
      </div>
    </div>

    <!-- Photo gallery -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="(photo, i) in photos"
        :key="i"
        class="relative overflow-hidden rounded-2xl aspect-square group cursor-pointer"
        :class="i === 2 ? 'col-span-2 lg:col-span-1' : ''"
      >
        <img
          :src="photo.src"
          :alt="photo.alt"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
    </div>

    <!-- Live KNLTB reserveringen -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-3">
        <h2 class="font-semibold text-slate-900">{{ showAllClub ? 'Alle clubreserveringen (KNLTB)' : 'Mijn reserveringen (KNLTB)' }}</h2>
        <div class="flex items-center gap-2">
          <button
            @click="showAllClub = !showAllClub"
            class="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors"
            :class="showAllClub ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-500 border-slate-200 hover:bg-slate-50'"
          >
            {{ showAllClub ? 'Toon alleen de mijne' : 'Toon hele club' }}
          </button>
          <button @click="fetchLiveReservations" class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" :disabled="liveLoading">
            <RefreshCw class="w-4 h-4 text-slate-400" :class="liveLoading ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>

      <!-- Not configured -->
      <div v-if="!settings.isConfigured" class="flex items-center gap-2 px-5 py-4 text-sm text-amber-700">
        <AlertCircle class="w-4 h-4 flex-shrink-0" />
        Stel eerst een token in via <RouterLink to="/instellingen" class="underline font-medium ml-1">Instellingen</RouterLink>.
      </div>

      <!-- Loading -->
      <div v-else-if="liveLoading" class="flex items-center justify-center gap-3 px-5 py-10">
        <div class="w-5 h-5 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
        <span class="text-sm text-slate-400">Ophalen…</span>
      </div>

      <!-- Error -->
      <div v-else-if="liveError" class="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100 px-5 py-3">
        <AlertCircle class="w-3.5 h-3.5 flex-shrink-0" />{{ liveError }}
      </div>

      <!-- Empty -->
      <div v-else-if="displayedReservations.length === 0" class="px-5 py-10 text-center">
        <p class="text-sm text-slate-400">
          {{ liveReservations.length > 0 && !showAllClub ? 'Geen van jullie reserveringen gevonden — klik "Toon hele club" om te controleren' : 'Geen aankomende reserveringen gevonden' }}
        </p>
      </div>

      <!-- List -->
      <div v-else class="divide-y divide-slate-50">
        <div
          v-for="r in displayedReservations"
          :key="r.id"
          class="px-5 py-4 flex items-center gap-4"
        >
          <div class="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <Calendar class="w-5 h-5 text-green-500" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-900 text-sm truncate">{{ getCourtNameFromRes(r) }}</p>
            <p class="text-sm text-slate-500">{{ formatLiveDate(r) }} · {{ formatLiveTime(r) }} – {{ formatLiveEndTime(r) }}</p>
            <p v-if="getParticipantNames(r)" class="text-xs text-slate-400 mt-0.5">{{ getParticipantNames(r) }}</p>
          </div>
          <span class="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">geboekt</span>
        </div>
      </div>
    </div>

    <!-- Upcoming (scheduler wachtrij) -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <h2 class="font-semibold text-slate-900">Aankomende reserveringen</h2>
        <RouterLink to="/wachtrij" class="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
          Alle bekijken <ChevronRight class="w-4 h-4" />
        </RouterLink>
      </div>

      <div v-if="upcoming.length === 0" class="px-5 py-14 text-center">
        <div class="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Calendar class="w-7 h-7 text-slate-300" />
        </div>
        <p class="text-sm font-semibold text-slate-500 mb-1">Geen aankomende reserveringen</p>
        <RouterLink to="/nieuw" class="text-sm text-green-600 hover:text-green-700 font-medium">Maak je eerste reservering →</RouterLink>
      </div>

      <div v-else class="divide-y divide-slate-50">
        <div
          v-for="res in upcoming"
          :key="res.id"
          class="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            :class="res.status === 'active' ? 'bg-blue-50' : 'bg-green-50'"
          >
            <Calendar class="w-5 h-5" :class="res.status === 'active' ? 'text-blue-500' : 'text-green-500'" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <p class="font-semibold text-slate-900 text-sm truncate">{{ getCourtName(res.courtId) }}</p>
              <StatusBadge :status="res.status" />
            </div>
            <p class="text-sm text-slate-500">{{ formatDate(res.date) }} · {{ res.timeSlot }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ getMemberNames(res.memberIds) }}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-xs text-slate-400">Boekt om</p>
            <p class="text-xs font-semibold text-slate-600">{{ formatTrigger(res.bookingTrigger) }}</p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
