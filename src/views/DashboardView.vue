<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Clock, Zap, CheckCircle2, Users, Plus, ChevronRight, Calendar, Target } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { COURTS } from '@/constants/courts'
import StatusBadge from '@/components/StatusBadge.vue'

const reservationsStore = useReservationsStore()
const membersStore = useMembersStore()

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
  return COURTS.find(c => c.id === id)?.name ?? 'Onbekende baan'
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

const photos = [
  { src: '/photos/padel (1).png', alt: 'Padel actie bij het net' },
  { src: '/photos/padel (2).png', alt: 'Smash boven het net' },
  { src: '/photos/padel (3).png', alt: 'Kampioenen met beker' },
  { src: '/photos/padel (4).png', alt: 'Vier spelers in actie' },
]
</script>

<template>
  <div class="space-y-6">

    <!-- Hero banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 lg:p-8">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/20 via-transparent to-transparent"></div>
      <div class="relative">
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

    <!-- Upcoming -->
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
