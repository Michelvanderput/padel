<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Calendar, Clock, Users, Trash2, XCircle, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Ban } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { cancelScheduled } from '@/services/scheduler'
import { useCourtsStore } from '@/stores/courts'
import StatusBadge from '@/components/StatusBadge.vue'

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
  return new Date(str + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTrigger(iso) {
  return new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Wachtrij</h1>
        <p class="text-sm text-slate-400 mt-0.5">{{ reservationsStore.reservations.length }} reservering{{ reservationsStore.reservations.length !== 1 ? 'en' : '' }}</p>
      </div>
      <RouterLink
        to="/nieuw"
        class="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-green-500/20"
      >
        <Plus class="w-4 h-4" />
        Nieuw
      </RouterLink>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        @click="filterStatus = opt.value"
        class="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
        :class="filterStatus === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" class="bg-white rounded-2xl border border-slate-100 shadow-sm p-14 text-center">
      <div class="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Calendar class="w-7 h-7 text-slate-300" />
      </div>
      <h3 class="font-semibold text-slate-900 mb-1">Geen reserveringen</h3>
      <p class="text-sm text-slate-400 mb-5">{{ filterStatus === 'all' ? 'Je hebt nog geen reserveringen aangemaakt' : 'Pas de filter aan' }}</p>
      <RouterLink v-if="filterStatus === 'all'" to="/nieuw" class="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
        <Plus class="w-4 h-4" /> Nieuwe reservering
      </RouterLink>
    </div>

    <!-- Cards -->
    <div class="space-y-3">
      <div
        v-for="res in filtered"
        :key="res.id"
        class="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all"
        :class="res.status === 'active' ? 'border-blue-200 shadow-blue-100' : 'border-slate-100'"
      >
        <!-- Active pulse bar -->
        <div v-if="res.status === 'active'" class="h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 animate-pulse"></div>

        <!-- Card body -->
        <div class="p-5">
          <div class="flex items-start gap-4">
            <div class="flex-1 min-w-0">

              <!-- Title + badge -->
              <div class="flex items-center gap-2 mb-3 flex-wrap">
                <h3 class="font-bold text-slate-900 truncate">{{ getCourtName(res.courtId) }}</h3>
                <StatusBadge :status="res.status" />
              </div>

              <!-- Meta -->
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar class="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span>{{ formatDate(res.date) }}</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-slate-500">
                  <Clock class="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span>{{ res.timeSlot }} · boekt op <span class="font-medium text-slate-700">{{ formatTrigger(res.bookingTrigger) }}</span></span>
                </div>
                <div class="flex items-start gap-2 text-sm text-slate-500">
                  <Users class="w-3.5 h-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                  <div class="flex flex-wrap gap-1">
                    <span v-for="id in res.memberIds" :key="id" class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                      {{ getMemberName(id) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-1 flex-shrink-0">
              <button
                v-if="['pending', 'active'].includes(res.status)"
                @click="confirmCancel(res.id)"
                class="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                title="Annuleren"
              >
                <Ban class="w-4 h-4" />
              </button>
              <button
                @click="confirmDelete(res.id)"
                class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Verwijderen"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Inline cancel confirm -->
          <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100">
            <div v-if="confirmCancelId === res.id" class="mt-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle class="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p class="text-sm text-amber-800 flex-1 font-medium">Reservering annuleren?</p>
              <button @click="doCancel" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-lg transition-colors">Annuleer</button>
              <button @click="confirmCancelId = null" class="px-3 py-1.5 text-amber-700 hover:bg-amber-100 text-xs font-medium rounded-lg transition-colors">Nee</button>
            </div>
          </Transition>

          <!-- Inline delete confirm -->
          <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100">
            <div v-if="confirmDeleteId === res.id" class="mt-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle class="w-4 h-4 text-red-500 flex-shrink-0" />
              <p class="text-sm text-red-800 flex-1 font-medium">Definitief verwijderen?</p>
              <button @click="doDelete" class="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors">Verwijder</button>
              <button @click="confirmDeleteId = null" class="px-3 py-1.5 text-red-700 hover:bg-red-100 text-xs font-medium rounded-lg transition-colors">Nee</button>
            </div>
          </Transition>

          <!-- Log toggle -->
          <button @click="toggleLogs(res.id)" class="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
            <component :is="expandedLogs.has(res.id) ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
            {{ res.logs.length }} logbericht{{ res.logs.length !== 1 ? 'en' : '' }}
          </button>
        </div>

        <!-- Logs panel -->
        <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100">
          <div v-if="expandedLogs.has(res.id)" class="border-t border-slate-100 bg-slate-950 px-5 py-4">
            <div v-if="res.logs.length === 0" class="text-xs text-slate-500 text-center py-3">
              Nog geen logberichten
            </div>
            <div v-else class="space-y-1.5 max-h-52 overflow-y-auto font-mono">
              <div v-for="(log, i) in [...res.logs].reverse()" :key="i" class="flex gap-3 text-xs">
                <span class="text-slate-500 flex-shrink-0 w-20">{{ formatLogTime(log.time) }}</span>
                <span :class="log.message.startsWith('✓') ? 'text-green-400' : log.message.startsWith('✗') ? 'text-red-400' : 'text-slate-300'">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </Transition>

      </div>
    </div>

  </div>
</template>
