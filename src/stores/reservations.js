import { defineStore } from 'pinia'
import { ref } from 'vue'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const useReservationsStore = defineStore('reservations', () => {
  const reservations = ref([])

  async function init() {
    try {
      const res = await fetch('/api/reservations')
      if (res.ok) reservations.value = await res.json()
    } catch (_) {}
  }

  async function addReservation({ location, date, timeSlot, duration, courtId, bookingTrigger, memberIds }) {
    const newRes = {
      id: crypto.randomUUID(),
      location, date, timeSlot, duration, courtId, bookingTrigger, memberIds,
      status: 'pending',
      logs: [],
      createdAt: new Date().toISOString()
    }
    reservations.value.push(newRes)
    await fetch('/api/reservations', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(newRes) })
    return newRes
  }

  async function updateStatus(id, status) {
    const res = reservations.value.find(r => r.id === id)
    if (!res) return
    res.status = status
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status, logs: res.logs })
    })
  }

  function addLog(id, message) {
    const res = reservations.value.find(r => r.id === id)
    if (res) res.logs.push({ time: new Date().toISOString(), message })
  }

  async function cancelReservation(id) {
    await updateStatus(id, 'cancelled')
  }

  async function removeReservation(id) {
    reservations.value = reservations.value.filter(r => r.id !== id)
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
  }

  return { reservations, init, addReservation, updateStatus, addLog, cancelReservation, removeReservation }
})
