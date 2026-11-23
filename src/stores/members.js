import { defineStore } from 'pinia'
import { ref } from 'vue'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
  const error = ref('')

  async function init() {
    try {
      const res = await fetch('/api/members')
      if (res.ok) members.value = await res.json()
    } catch (_) {}
  }

  // Verstuur een wijziging. Slaat de server hem niet op, dan zou het scherm iets tonen dat bij de
  // volgende keer laden "terugspringt": toon de fout en haal de echte lijst opnieuw op.
  async function save(url, options, { okStatuses = [] } = {}) {
    try {
      const res = await fetch(url, options)
      if (res.ok || okStatuses.includes(res.status)) { error.value = ''; return true }
      error.value = `Opslaan mislukt (HTTP ${res.status}). De lijst is opnieuw geladen.`
    } catch (e) {
      error.value = `Opslaan mislukt: ${e.message}. De lijst is opnieuw geladen.`
    }
    await init()
    return false
  }

  async function addMember({ name, memberNumber, clubMemberId }) {
    const newMember = { id: crypto.randomUUID(), name, memberNumber, clubMemberId: clubMemberId || '' }
    members.value.push(newMember)
    return save('/api/members', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(newMember) })
  }

  async function updateMember(id, data) {
    const idx = members.value.findIndex(m => m.id === id)
    if (idx === -1) return false
    Object.assign(members.value[idx], data)
    return save(`/api/members/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) })
  }

  async function removeMember(id) {
    members.value = members.value.filter(m => m.id !== id)
    // 404 = stond er al niet meer: dan is het resultaat wat we wilden.
    return save(`/api/members/${id}`, { method: 'DELETE' }, { okStatuses: [404] })
  }

  return { members, error, init, addMember, updateMember, removeMember }
})
