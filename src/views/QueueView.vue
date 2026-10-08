<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import { Calendar, Clock, Users, KeyRound, Trash2, Plus, ChevronDown, ChevronUp, AlertTriangle, Ban } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { cancelScheduled } from '@/services/scheduler'
import { useCourtsStore } from '@/stores/courts'
import StatusBadge from '@/components/StatusBadge.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useReveal } from '@/composables/useReveal'
import { gsap, Flip, prefersReducedMotion } from '@/lib/motion'

const root = ref(null)
useReveal(root)

const reservationsStore = useReservationsStore()
const membersStore      = useMembersStore()
const courtsStore       = useCourtsStore()

const filterStatus    = ref('all')
const expandedLogs    = ref(new Set())
const confirmCancelId = ref(null)
const confirmDeleteId = ref(null)

const statusOptions = [
  { value: 'all',       label: 'Alle' },
  { value: 'pending',   label: 'Wachtend' },
  { value: 'active',    label: 'Actief' },
  { value: 'reserved',  label: 'Gereserveerd' },
  { value: 'failed',    label: 'Mislukt' },
  { value: 'cancelled', label: 'Geannuleerd' },
]

const list = ref(null)

// Flip: kaarten schuiven vloeiend naar hun nieuwe plek bij een filterwissel
watch(filterStatus, async () => {
  if (prefersReducedMotion() || !list.value) return
  const state = Flip.getState(list.value.querySelectorAll('[data-card]'))
  await nextTick()
  Flip.from(state, {
    duration: 0.6, ease: 'expo.out', absolute: true, nested: true,
    onEnter: els => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }),
    onLeave: els => gsap.to(els, { opacity: 0, duration: 0.25 }),
  })
})

const filtered = computed(() => {
  let list = [...reservationsStore.reservations]
  if (filterStatus.value !== 'all') list = list.filter(r => r.status === filterStatus.value)
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

function getMemberName(id) {
  return membersStore.members.find(m => m.id === id)?.name ?? 'Onbekend'
}

function getCourtName(courtId) {
  return courtsStore.courts.find(c => c.id === courtId)?.name ?? courtId
}

function formatDate(str) {
  const s = new Date(str + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTrigger(iso) {
  return new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatClock(iso) {
  return new Date(iso).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' })
}

function formatLogTime(iso) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function toggleLogs(id) {
  if (expandedLogs.value.has(id)) expandedLogs.value.delete(id)
  else expandedLogs.value.add(id)
  expandedLogs.value = new Set(expandedLogs.value)
}

function confirmCancel(id) { confirmCancelId.value = id }
function doCancel() {
  if (!confirmCancelId.value) return
  cancelScheduled(confirmCancelId.value)
  reservationsStore.cancelReservation(confirmCancelId.value)
  confirmCancelId.value = null
}

function confirmDelete(id) { confirmDeleteId.value = id }
function doDelete() {
  if (!confirmDeleteId.value) return
  reservationsStore.removeReservation(confirmDeleteId.value)
  confirmDeleteId.value = null
}
</script>

<template>
  <div ref="root" class="mx-auto max-w-4xl px-4 pb-16 pt-32 sm:px-8 sm:pt-40">

    <PageHeader
      eyebrow="Wachtrij"
      title="Reserveringen"
      :subtitle="`${reservationsStore.reservations.length} reservering${reservationsStore.reservations.length !== 1 ? 'en' : ''} — wachtend, actief of al geboekt.`"
    >
      <RouterLink v-magnetic="0.25" to="/nieuw" class="btn btn-primary"><Plus class="h-4 w-4" />Nieuw</RouterLink>
    </PageHeader>

    <!-- Filter -->
    <div data-reveal role="tablist" aria-label="Filter op status" data-lenis-prevent class="mb-6 flex gap-1 overflow-x-auto rounded-full border border-line bg-ink-800/70 p-1.5">
      <button
        v-for="opt in statusOptions" :key="opt.value"
        role="tab" :aria-selected="filterStatus === opt.value"
        @click="filterStatus = opt.value"
        class="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ease-out-expo"
        :class="filterStatus === opt.value ? 'bg-lime text-ink' : 'text-mist hover:text-fog'"
      >{{ opt.label }}</button>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" data-reveal class="panel flex flex-col items-center px-6 py-20 text-center">
      <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white/5"><Calendar class="h-7 w-7 text-mist" /></div>
      <h2 class="display text-3xl text-fog">Geen reserveringen</h2>
      <p class="mt-2 mb-6 text-sm text-mist">{{ filterStatus === 'all' ? 'Je hebt nog geen reserveringen aangemaakt.' : 'Pas de filter aan om meer te zien.' }}</p>
      <RouterLink v-if="filterStatus === 'all'" to="/nieuw" class="btn btn-primary"><Plus class="h-4 w-4" />Nieuwe reservering</RouterLink>
    </div>

    <!-- Cards -->
    <div ref="list" data-reveal-group class="space-y-4">
      <article
        v-for="res in filtered" :key="res.id"
        data-card data-reveal
        class="panel overflow-hidden transition-colors duration-500"
        :class="res.status === 'active' ? '!border-sky/40' : ''"
      >
        <div v-if="res.status === 'active'" class="h-0.5 animate-pulse bg-gradient-to-r from-transparent via-sky to-transparent"></div>

        <div class="p-6">
          <div class="flex items-start gap-5">
            <!-- datum-blok -->
            <div class="display hidden w-20 flex-shrink-0 rounded-2xl border border-line bg-ink-900 py-3 text-center leading-none sm:block">
              <span class="block text-5xl tabular" :class="res.status === 'reserved' ? 'text-lime' : 'text-fog'">{{ new Date(res.date + 'T12:00:00').getDate() }}</span>
              <span class="eyebrow mt-2 block">{{ new Date(res.date + 'T12:00:00').toLocaleDateString('nl-NL', { month: 'short' }) }}</span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="mb-3 flex flex-wrap items-center gap-2.5">
                <h2 class="truncate text-lg font-semibold text-fog">{{ getCourtName(res.courtId) }}</h2>
                <StatusBadge :status="res.status" />
                <span v-if="(res.minDuration ?? 60) > 60" class="chip !border-sky/30 !bg-sky/10 !text-sky" title="Wordt alleen geboekt als KNLTB minimaal 90 minuten geeft">min. {{ res.minDuration }} min</span>
              </div>

              <div class="space-y-2 text-sm text-mist">
                <p class="flex items-center gap-2.5"><Calendar class="h-3.5 w-3.5 flex-shrink-0" /><span>{{ formatDate(res.date) }}</span></p>
                <p class="flex items-center gap-2.5"><Clock class="h-3.5 w-3.5 flex-shrink-0" /><span><span class="font-mono text-fog">{{ res.timeSlot }}<template v-if="res.knltb?.endTime">–{{ formatClock(res.knltb.endTime) }}</template></span> · boekt op <span class="font-medium text-fog">{{ formatTrigger(res.bookingTrigger) }}</span></span></p>
                <p v-if="res.knltb?.pincode" class="flex items-center gap-2.5">
                  <KeyRound class="h-3.5 w-3.5 flex-shrink-0 text-lime" />
                  <span>Pincode baan <span class="font-mono text-base font-semibold tracking-[0.2em] text-lime">{{ res.knltb.pincode }}</span></span>
                </p>
                <div class="flex items-start gap-2.5">
                  <Users class="mt-1 h-3.5 w-3.5 flex-shrink-0" />
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="id in res.memberIds" :key="id" class="chip">{{ getMemberName(id) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-shrink-0 flex-col gap-1">
              <button v-if="['pending', 'active'].includes(res.status)" @click="confirmCancel(res.id)" class="btn-icon hover:!bg-amber/15 hover:!text-amber" aria-label="Annuleren"><Ban class="h-4 w-4" /></button>
              <button @click="confirmDelete(res.id)" class="btn-icon hover:!bg-danger/15 hover:!text-danger" aria-label="Verwijderen"><Trash2 class="h-4 w-4" /></button>
            </div>
          </div>

          <Transition enter-active-class="transition duration-300 ease-out-expo" enter-from-class="opacity-0 -translate-y-2" enter-to-class="opacity-100 translate-y-0">
            <div v-if="confirmCancelId === res.id" class="note note-amber mt-5 items-center" role="alertdialog" aria-label="Reservering annuleren?">
              <AlertTriangle class="h-4 w-4 flex-shrink-0" />
              <p class="flex-1 font-medium">Reservering annuleren?</p>
              <button @click="doCancel" class="btn btn-amber !px-4 !py-1.5 text-xs">Annuleer</button>
              <button @click="confirmCancelId = null" class="btn btn-ghost !px-4 !py-1.5 text-xs">Nee</button>
            </div>
          </Transition>

          <Transition enter-active-class="transition duration-300 ease-out-expo" enter-from-class="opacity-0 -translate-y-2" enter-to-class="opacity-100 translate-y-0">
            <div v-if="confirmDeleteId === res.id" class="note note-danger mt-5 items-center" role="alertdialog" aria-label="Definitief verwijderen?">
              <AlertTriangle class="h-4 w-4 flex-shrink-0" />
              <p class="flex-1 font-medium">Definitief verwijderen?</p>
              <button @click="doDelete" class="btn btn-danger !px-4 !py-1.5 text-xs">Verwijder</button>
              <button @click="confirmDeleteId = null" class="btn btn-ghost !px-4 !py-1.5 text-xs">Nee</button>
            </div>
          </Transition>

          <button @click="toggleLogs(res.id)" :aria-expanded="expandedLogs.has(res.id)" class="mt-5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-mist transition-colors hover:text-fog">
            <component :is="expandedLogs.has(res.id) ? ChevronUp : ChevronDown" class="h-3.5 w-3.5" />
            {{ res.logs.length }} logbericht{{ res.logs.length !== 1 ? 'en' : '' }}
          </button>
        </div>

        <Transition enter-active-class="transition duration-300 ease-out-expo" enter-from-class="opacity-0" enter-to-class="opacity-100">
          <div v-if="expandedLogs.has(res.id)" class="border-t border-line bg-ink px-6 py-5">
            <div v-if="res.logs.length === 0" class="py-3 text-center text-xs text-mist">Nog geen logberichten</div>
            <div v-else data-lenis-prevent class="max-h-52 space-y-1.5 overflow-y-auto font-mono">
              <div v-for="(log, i) in [...res.logs].reverse()" :key="i" class="flex gap-4 text-xs">
                <span class="w-20 flex-shrink-0 text-mist tabular">{{ formatLogTime(log.time) }}</span>
                <span :class="log.message.startsWith('✓') ? 'text-lime' : log.message.startsWith('✗') ? 'text-danger' : 'text-fog/80'">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </article>
    </div>

  </div>
</template>
