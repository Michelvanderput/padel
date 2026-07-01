<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MapPin, Calendar, Clock, Users, Check, AlertCircle, ChevronLeft } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { scheduleReservation } from '@/services/scheduler'
import { COURTS, LOCATION } from '@/constants/courts'

const router = useRouter()
const reservationsStore = useReservationsStore()
const membersStore = useMembersStore()

const form = ref({
  date:           '',
  timeSlot:       '09:00',
  duration:       60,
  courtId:        COURTS[0].id,
  bookingTrigger: ''
})

const selectedMemberIds = ref([])

const timeSlots = computed(() => {
  const slots = []
  for (let h = 7; h <= 22; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 22) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
})

const isValid = computed(() =>
  form.value.date &&
  form.value.timeSlot &&
  form.value.courtId &&
  form.value.bookingTrigger &&
  selectedMemberIds.value.length === 4
)

function toggleMember(id) {
  const idx = selectedMemberIds.value.indexOf(id)
  if (idx !== -1) {
    selectedMemberIds.value.splice(idx, 1)
  } else if (selectedMemberIds.value.length < 4) {
    selectedMemberIds.value.push(id)
  }
}

function getMember(id) {
  return membersStore.members.find(m => m.id === id)
}

function submit() {
  if (!isValid.value) return
  reservationsStore.addReservation({
    location:       LOCATION,
    date:           form.value.date,
    timeSlot:       form.value.timeSlot,
    duration:       form.value.duration,
    courtId:        form.value.courtId,
    bookingTrigger: form.value.bookingTrigger,
    memberIds:      [...selectedMemberIds.value]
  })
  const newRes = reservationsStore.reservations.at(-1)
  if (newRes) scheduleReservation(newRes)
  router.push('/wachtrij')
}
</script>

<template>
  <div class="max-w-2xl space-y-6">

    <!-- Header -->
    <div>
      <button
        @click="router.back()"
        class="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
      >
        <ChevronLeft class="w-4 h-4" />
        Terug
      </button>
      <h1 class="text-2xl font-bold text-gray-900">Nieuwe reservering</h1>
      <p class="text-sm text-gray-500 mt-1">Stel een reservering in om automatisch te boeken zodra de plek beschikbaar komt</p>
    </div>

    <!-- Reservation details -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <h2 class="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-400">Baangegevens</h2>

      <!-- Location (fixed) -->
      <div class="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
        <MapPin class="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div>
          <p class="text-xs text-gray-400">Locatie</p>
          <p class="text-sm font-medium text-gray-900">{{ LOCATION }}</p>
        </div>
      </div>

      <!-- Court selector -->
      <div>
        <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <MapPin class="w-4 h-4 text-gray-400" />
          Padelbaan
        </label>
        <div class="grid grid-cols-1 gap-2">
          <label
            v-for="court in COURTS"
            :key="court.id"
            class="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all text-sm"
            :class="form.courtId === court.id
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'"
          >
            <input type="radio" :value="court.id" v-model="form.courtId" class="sr-only" />
            <span
              class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              :class="form.courtId === court.id ? 'border-green-500' : 'border-gray-300'"
            >
              <span v-if="form.courtId === court.id" class="w-2 h-2 rounded-full bg-green-500"></span>
            </span>
            <span class="flex-1 font-medium" :class="form.courtId === court.id ? 'text-green-700' : 'text-gray-700'">{{ court.name }}</span>
            <span class="text-xs text-gray-400">Baan {{ court.number }}</span>
          </label>
        </div>
      </div>

      <!-- Date + Time -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <Calendar class="w-4 h-4 text-gray-400" />
            Speeldatum
          </label>
          <input
            v-model="form.date"
            type="date"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
            <Clock class="w-4 h-4 text-gray-400" />
            Tijdslot
          </label>
          <select
            v-model="form.timeSlot"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          >
            <option v-for="slot in timeSlots" :key="slot" :value="slot">{{ slot }}</option>
          </select>
        </div>
      </div>

      <!-- Duration -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Speelduur</label>
        <div class="flex gap-3">
          <label
            v-for="d in [60, 90]"
            :key="d"
            class="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm font-medium select-none"
            :class="form.duration === d
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'"
          >
            <input type="radio" :value="d" v-model="form.duration" class="sr-only" />
            <span
              class="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0"
              :class="form.duration === d ? 'border-green-500' : 'border-gray-300'"
            >
              <span v-if="form.duration === d" class="w-2 h-2 rounded-full bg-green-500"></span>
            </span>
            {{ d }} min
          </label>
        </div>
      </div>

      <!-- Booking trigger -->
      <div>
        <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
          <Clock class="w-4 h-4 text-gray-400" />
          Automatisch boeken op
        </label>
        <input
          v-model="form.bookingTrigger"
          type="datetime-local"
          class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p class="text-xs text-gray-400 mt-1.5">
          Het tijdstip waarop de baan beschikbaar komt (bijv. 7 dagen van tevoren om 07:00)
        </p>
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
    <div v-if="!isValid && (form.location || form.date || selectedMemberIds.length > 0)" class="flex items-center gap-2 text-sm text-amber-600">
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      <span>
        <template v-if="!form.location">Vul een locatie in. </template>
        <template v-if="!form.date">Kies een speeldatum. </template>
        <template v-if="!form.bookingTrigger">Stel een boektijdstip in. </template>
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
