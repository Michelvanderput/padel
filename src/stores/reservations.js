import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useReservationsStore = defineStore('reservations', () => {
  const reservations = ref(JSON.parse(localStorage.getItem('knltb-reservations') || '[]'))

  watch(reservations, (val) => {
    localStorage.setItem('knltb-reservations', JSON.stringify(val))
  }, { deep: true })

  function addReservation({ location, date, timeSlot, duration, courtId, bookingTrigger, memberIds }) {
    reservations.value.push({
      id: crypto.randomUUID(),
      location,
      date,
      timeSlot,
      duration,
      courtId,
      bookingTrigger,
      memberIds,
      status: 'pending',
      logs: [],
      createdAt: new Date().toISOString()
    })
  }

  function updateStatus(id, status) {
    const res = reservations.value.find(r => r.id === id)
    if (res) res.status = status
  }

  function addLog(id, message) {
    const res = reservations.value.find(r => r.id === id)
    if (res) res.logs.push({ time: new Date().toISOString(), message })
  }

  function cancelReservation(id) {
    updateStatus(id, 'cancelled')
  }

  function removeReservation(id) {
    reservations.value = reservations.value.filter(r => r.id !== id)
  }

  return { reservations, addReservation, updateStatus, addLog, cancelReservation, removeReservation }
})
