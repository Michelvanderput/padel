import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const DEFAULT_MEMBERS = [
  { id: '5331bbd0-1993-4fff-b3d8-46950b4ea031', name: 'Sander van Dijk',    memberNumber: '', clubMemberId: '5331bbd0-1993-4fff-b3d8-46950b4ea031' },
  { id: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92', name: 'Eddie van Leuven',   memberNumber: '', clubMemberId: 'e08e992d-cc5e-47e0-a5b0-59207a5b0b92' },
  { id: '7698101b-b3d6-4e49-b282-cf6a39346834', name: 'Lerau Seyben',        memberNumber: '', clubMemberId: '7698101b-b3d6-4e49-b282-cf6a39346834' },
  { id: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df', name: 'Michel van der Put', memberNumber: '', clubMemberId: 'ccbd5c98-7f9a-46ea-a6ef-b3d72e3130df' },
]

export const useMembersStore = defineStore('members', () => {
  const stored = JSON.parse(localStorage.getItem('knltb-members') || '[]')
  const members = ref(stored.length > 0 ? stored : DEFAULT_MEMBERS)

  watch(members, (val) => {
    localStorage.setItem('knltb-members', JSON.stringify(val))
  }, { deep: true })

  function addMember({ name, memberNumber, clubMemberId }) {
    members.value.push({
      id: crypto.randomUUID(),
      name,
      memberNumber,
      clubMemberId: clubMemberId || ''
    })
  }

  function updateMember(id, data) {
    const idx = members.value.findIndex(m => m.id === id)
    if (idx !== -1) Object.assign(members.value[idx], data)
  }

  function removeMember(id) {
    members.value = members.value.filter(m => m.id !== id)
  }

  return { members, addMember, updateMember, removeMember }
})
