<script setup>
import { ref, computed } from 'vue'
import { Plus, User, Users, Trash2, Pencil, Check, X, Search } from '@lucide/vue'
import { useMembersStore } from '@/stores/members'

const store = useMembersStore()

const showAddForm = ref(false)
const newName     = ref('')
const newNumber   = ref('')
const newUuid     = ref('')

const searchQuery = ref('')
const editingId   = ref(null)
const editName    = ref('')
const editNumber  = ref('')
const editUuid    = ref('')

const filteredMembers = computed(() =>
  store.members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    m.memberNumber.includes(searchQuery.value)
  )
)

function submitAdd() {
  if (!newName.value.trim() || !newNumber.value.trim()) return
  store.addMember({
    name: newName.value.trim(),
    memberNumber: newNumber.value.trim(),
    clubMemberId: newUuid.value.trim()
  })
  newName.value   = ''
  newNumber.value = ''
  newUuid.value   = ''
  showAddForm.value = false
}

function startEdit(member) {
  editingId.value  = member.id
  editName.value   = member.name
  editNumber.value = member.memberNumber
  editUuid.value   = member.clubMemberId || ''
}

function submitEdit() {
  if (!editName.value.trim() || !editNumber.value.trim()) return
  store.updateMember(editingId.value, {
    name: editName.value.trim(),
    memberNumber: editNumber.value.trim(),
    clubMemberId: editUuid.value.trim()
  })
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function deleteMember(id) {
  if (confirm('Weet je zeker dat je dit lid wilt verwijderen?')) {
    store.removeMember(id)
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Leden</h1>
        <p class="text-sm text-gray-500 mt-1">{{ store.members.length }} KNLTB lidnummer{{ store.members.length !== 1 ? 's' : '' }}</p>
      </div>
      <button
        @click="showAddForm = !showAddForm"
        class="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-green-500/20"
      >
        <Plus class="w-4 h-4" />
        Lid toevoegen
      </button>
    </div>

    <!-- Add form -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="showAddForm" class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-900 mb-4">Nieuw lid toevoegen</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1.5">Naam</label>
            <input
              v-model="newName"
              type="text"
              placeholder="Jan de Vries"
              class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              @keyup.enter="submitAdd"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1.5">KNLTB Lidnummer</label>
            <input
              v-model="newNumber"
              type="text"
              placeholder="12345678"
              class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              @keyup.enter="submitAdd"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-medium text-slate-700 mb-1.5">
              Club Member UUID
              <span class="ml-1 text-slate-400 font-normal">(voor boeken — vind in Proxyman onder <code class="bg-slate-100 px-1 rounded">club_member_ids</code>)</span>
            </label>
            <input
              v-model="newUuid"
              type="text"
              placeholder="5331bbd0-1993-4fff-b3d8-46950b4ea031"
              class="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              @keyup.enter="submitAdd"
            />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button
            @click="submitAdd"
            class="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          >
            <Check class="w-4 h-4" />
            Toevoegen
          </button>
          <button
            @click="showAddForm = false; newName = ''; newNumber = ''; newUuid = ''"
            class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:bg-slate-50"
          >
            <X class="w-4 h-4" />
            Annuleren
          </button>
        </div>
      </div>
    </Transition>

    <!-- Empty state -->
    <div v-if="store.members.length === 0" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Users class="w-7 h-7 text-gray-300" />
      </div>
      <h3 class="font-semibold text-gray-900 mb-1">Nog geen leden</h3>
      <p class="text-sm text-slate-400 mb-4">Voeg KNLTB lidnummers toe om reserveringen te kunnen maken</p>
      <button
        @click="showAddForm = true"
        class="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
      >
        <Plus class="w-4 h-4" />
        Voeg je eerste lid toe
      </button>
    </div>

    <template v-else>
      <!-- Search -->
      <div class="relative">
        <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Zoek op naam of lidnummer..."
          class="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
        />
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="member in filteredMembers"
          :key="member.id"
          class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"
        >
          <!-- Edit mode -->
          <template v-if="editingId === member.id">
            <div class="space-y-2">
              <input
                v-model="editName"
                type="text"
                placeholder="Naam"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                v-model="editNumber"
                type="text"
                placeholder="Lidnummer"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                v-model="editUuid"
                type="text"
                placeholder="Club Member UUID"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <div class="flex gap-2 pt-1">
                <button
                  @click="submitEdit"
                  class="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 text-white py-2 rounded-lg text-sm font-medium transition-all"
                >
                  <Check class="w-3.5 h-3.5" />
                  Opslaan
                </button>
                <button
                  @click="cancelEdit"
                  class="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <X class="w-3.5 h-3.5" />
                  Annuleren
                </button>
              </div>
            </div>
          </template>

          <!-- View mode -->
          <template v-else>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  :class="member.clubMemberId ? 'bg-green-50' : 'bg-amber-50'"
                >
                  <User class="w-5 h-5" :class="member.clubMemberId ? 'text-green-600' : 'text-amber-500'" />
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 truncate">{{ member.name }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ member.memberNumber }}</p>
                  <p v-if="member.clubMemberId" class="text-xs text-slate-400 font-mono truncate">{{ member.clubMemberId }}</p>
                  <p v-else class="text-xs text-amber-500 font-medium">UUID ontbreekt — kan niet boeken</p>
                </div>
              </div>
              <div class="flex gap-0.5 flex-shrink-0">
                <button
                  @click="startEdit(member)"
                  class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Bewerken"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  @click="deleteMember(member.id)"
                  class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Verwijderen"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- No results -->
        <div
          v-if="filteredMembers.length === 0 && searchQuery"
          class="sm:col-span-2 lg:col-span-3 py-8 text-center text-sm text-gray-500"
        >
          Geen leden gevonden voor "<strong>{{ searchQuery }}</strong>"
        </div>
      </div>
    </template>

  </div>
</template>
