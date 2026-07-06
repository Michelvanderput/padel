import { defineStore } from 'pinia'
import { ref } from 'vue'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const useMembersStore = defineStore('members', () => {
  const members = ref([])

  async function init() {
    try {
      const res = await fetch('/api/members')
      if (res.ok) members.value = await res.json()
    } catch (_) {}
  }

  async function addMember({ name, memberNumber, clubMemberId }) {
    const newMember = { id: crypto.randomUUID(), name, memberNumber, clubMemberId: clubMemberId || '' }
    members.value.push(newMember)
    await fetch('/api/members', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(newMember) })
  }

  async function updateMember(id, data) {
    const idx = members.value.findIndex(m => m.id === id)
    if (idx !== -1) {
      Object.assign(members.value[idx], data)
      await fetch(`/api/members/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(data) })
    }
  }

  async function removeMember(id) {
    members.value = members.value.filter(m => m.id !== id)
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
  }

  return { members, init, addMember, updateMember, removeMember }
})
