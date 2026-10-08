import { defineStore } from 'pinia'
import { ref } from 'vue'

import { upsertLog as upsertLogEntry } from '../../server/bookingLog.js'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const FLUSH_MS = 8000   // logregels worden gebundeld opgeslagen (elke PATCH kost een volledige lijst-write)

export const useReservationsStore = defineStore('reservations', () => {
  const reservations = ref([])
  const flushTimers = {}

  async function init() {
    try {
      const res = await fetch('/api/reservations')
      if (res.ok) {
        const fresh = await res.json()
        // Lokale logregels die nog niet zijn weggeschreven mogen niet door een refresh verdwijnen.
        for (const r of fresh) {
          if (!flushTimers[r.id]) continue
          const local = reservations.value.find(l => l.id === r.id)
          if (local) r.logs = local.logs
        }
        reservations.value = fresh
      }
    } catch (_) {}
  }

  async function flushLogs(id) {
    clearTimeout(flushTimers[id]); delete flushTimers[id]
    const res = reservations.value.find(r => r.id === id)
    if (!res) return
    try {
      await fetch(`/api/reservations/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ logs: res.logs }) })
    } catch (_) {}
  }
  const scheduleFlush = id => { if (!flushTimers[id]) flushTimers[id] = setTimeout(() => flushLogs(id), FLUSH_MS) }

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
    clearTimeout(flushTimers[id]); delete flushTimers[id]   // deze PATCH bevat de logs al
    res.status = status
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ status, logs: res.logs })
    })
  }

  function addLog(id, message) {
    const res = reservations.value.find(r => r.id === id)
    if (!res) return
    res.logs.push({ time: new Date().toISOString(), message })
    scheduleFlush(id)
  }

  // Eén meelopende regel (bv. "wacht op het boekvenster") i.p.v. een regel per poging
  function upsertLog(id, key, message) {
    const res = reservations.value.find(r => r.id === id)
    if (!res) return
    upsertLogEntry(res.logs, key, message)
    scheduleFlush(id)
  }

  async function cancelReservation(id) {
    await updateStatus(id, 'cancelled')
  }

  async function removeReservation(id) {
    reservations.value = reservations.value.filter(r => r.id !== id)
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
  }

  return { reservations, init, addReservation, updateStatus, addLog, upsertLog, flushLogs, cancelReservation, removeReservation }
})
