<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Plus, Users, Trash2, Pencil, Check, X, Search, Loader2, AlertCircle, Link2 } from '@lucide/vue'
import { useMembersStore } from '@/stores/members'
import { useSettingsStore } from '@/stores/settings'
import { searchMembers } from '@/services/knltb'
import PageHeader from '@/components/PageHeader.vue'
import { useReveal } from '@/composables/useReveal'
import { gsap, Flip, prefersReducedMotion } from '@/lib/motion'

const store    = useMembersStore()
const settings = useSettingsStore()

const root = ref(null)
useReveal(root)

const showAddForm = ref(false)
const newName     = ref('')
const newNumber   = ref('')
const newUuid     = ref('')

const searchQuery = ref('')
const editingId   = ref(null)
const editName    = ref('')
const editNumber  = ref('')
const editUuid    = ref('')

// ── KNLTB ledenzoeker ────────────────────────────────────────
const knltbQuery   = ref('')
const knltbLoading = ref(false)
const knltbError   = ref(null)
const knltbResults = ref([])
let knltbDebounce = null

function onKnltbInput() {
  clearTimeout(knltbDebounce)
  knltbError.value = null
  if (knltbQuery.value.trim().length < 2) { knltbSeq++; knltbLoading.value = false; knltbResults.value = []; return }
  knltbDebounce = setTimeout(runKnltbSearch, 350)
}

// De KNLTB-API geeft { club_members: [{ club_member: {...} }] } terug;
// oudere/andere vormen blijven ondersteund.
function knltbList(data) {
  const raw = data?.club_members ?? data?.members ?? data?.data ?? (Array.isArray(data) ? data : [])
  return raw.map(m => m?.club_member ?? m).filter(Boolean)
}

function knltbNumber(m) {
  const n = m.federation_membership_number || m.member_number || m.knltb_number || m.club_membership_number
  return n ? String(n) : ''
}

let knltbSeq = 0

async function runKnltbSearch() {
  if (!settings.isConfigured) { knltbError.value = 'Stel eerst een token in via Instellingen.'; return }
  const query = knltbQuery.value.trim()
  if (query.length < 2) return
  // Alleen het antwoord op de laatste zoekopdracht telt; tragere oudere antwoorden negeren.
  const seq = ++knltbSeq
  knltbLoading.value = true
  knltbError.value = null
  try {
    const res = await searchMembers(settings.clubId, query, settings.lisaToken)
    if (seq !== knltbSeq) return
    if (!res.ok) { knltbError.value = `API fout ${res.status}`; knltbResults.value = []; return }
    knltbResults.value = knltbList(res.data)
    if (!knltbResults.value.length) knltbError.value = `Geen leden gevonden voor "${query}".`
  } catch (e) {
    if (seq === knltbSeq) knltbError.value = e.message
  } finally {
    if (seq === knltbSeq) knltbLoading.value = false
  }
}

function pickKnltbResult(m) {
  newName.value   = knltbName(m)
  newNumber.value = knltbNumber(m)
  newUuid.value   = m.id ?? m.club_member_id ?? ''
  knltbSeq++
  knltbQuery.value   = ''
  knltbResults.value = []
}

// ── UUID koppelen voor leden die alleen een lidnummer hebben ──
const linkingId  = ref(null)
const linkErrors = ref({})

function knltbName(m) {
  return m.full_name ?? [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')
}
const normName = s => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

async function linkMember(member) {
  linkErrors.value = { ...linkErrors.value, [member.id]: '' }
  if (!settings.isConfigured) {
    linkErrors.value[member.id] = 'Stel eerst een token in via Instellingen.'
    return
  }
  linkingId.value = member.id
  try {
    const res = await searchMembers(settings.clubId, member.name, settings.lisaToken)
    if (!res.ok) throw new Error(`API fout ${res.status}`)
    const list = knltbList(res.data)
    const sameNumber = list.find(m => member.memberNumber && knltbNumber(m) === String(member.memberNumber).trim())
    const sameName   = list.find(m => normName(knltbName(m)) === normName(member.name)
      || normName(`${m.first_name} ${m.last_name}`) === normName(member.name))
    const hit = sameNumber ?? sameName ?? (list.length === 1 ? list[0] : null)
    const uuid = hit?.id ?? hit?.club_member_id
    if (!uuid) throw new Error('Geen duidelijke match — gebruik de zoeker bij "Lid toevoegen" of vul de UUID handmatig in.')
    await store.updateMember(member.id, { clubMemberId: uuid })
  } catch (e) {
    linkErrors.value[member.id] = e.message
  } finally {
    linkingId.value = null
  }
}

// ── Lijst + zoeken (Flip animeert het herschikken) ─────────────
const missingUuid = computed(() => store.members.filter(m => !m.clubMemberId).length)

// Accent- en hoofdletterongevoelig; elk woord moet ergens in naam of lidnummer voorkomen,
// zodat "douven sabien" ook "Sabien Douven" vindt.
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function matches(m) {
  const terms = fold(searchQuery.value).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = `${fold(m.name)} ${fold(m.memberNumber)}`
  return terms.every(t => haystack.includes(t))
}
const visibleCount = computed(() => store.members.filter(matches).length)

const grid = ref(null)
let flip = null
watch(searchQuery, async () => {
  if (prefersReducedMotion() || !grid.value) return
  // Een lopende Flip eerst afronden, anders blijven kaarten absoluut gepositioneerd hangen.
  flip?.progress(1).kill()
  const state = Flip.getState(grid.value.querySelectorAll('[data-member]'))
  await nextTick()
  flip = Flip.from(state, {
    duration: 0.6, ease: 'expo.out', absolute: true, nested: true,
    // autoAlpha i.p.v. opacity: kaarten die de scroll-reveal nog niet hadden gehad staan op visibility:hidden.
    onEnter: els => gsap.fromTo(els, { autoAlpha: 0, y: 0, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out' }),
    onLeave: els => gsap.to(els, { autoAlpha: 0, scale: 0.92, duration: 0.3 }),
    onComplete: () => { flip = null },
  })
})

const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

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
  <div ref="root" class="mx-auto max-w-6xl px-4 pb-16 pt-32 sm:px-8 sm:pt-40">

    <PageHeader
      eyebrow="Maatjes"
      title="Leden"
      :subtitle="`${store.members.length} KNLTB lidnummer${store.members.length !== 1 ? 's' : ''} — kies er vier per reservering.`"
    >
      <button v-magnetic="0.25" class="btn btn-primary" @click="showAddForm = !showAddForm" :aria-expanded="showAddForm">
        <Plus class="h-4 w-4 transition-transform duration-300" :class="showAddForm ? 'rotate-45' : ''" />
        Lid toevoegen
      </button>
    </PageHeader>

    <!-- Waarschuwing: leden zonder UUID kunnen niet geboekt worden -->
    <div v-if="missingUuid > 0" data-reveal class="note note-amber mb-6">
      <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>
        <strong>{{ missingUuid }} lid{{ missingUuid !== 1 ? 'en' : '' }}</strong> heb{{ missingUuid !== 1 ? 'ben' : 't' }} nog geen club-UUID en
        {{ missingUuid !== 1 ? 'kunnen' : 'kan' }} niet geboekt worden. Klik op <em>Koppel via KNLTB</em> bij het lid.
      </p>
    </div>

    <!-- Add form -->
    <Transition
      enter-active-class="transition duration-500 ease-out-expo"
      enter-from-class="opacity-0 -translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-3"
    >
      <div v-if="showAddForm" class="panel mb-8 p-6 sm:p-8">
        <h2 class="display mb-6 text-3xl text-fog">Nieuw lid</h2>

        <!-- KNLTB ledenzoeker -->
        <div class="mb-8 border-b border-line pb-8">
          <label class="label" for="knltb-search">
            Zoek in KNLTB ledenbestand <span class="normal-case tracking-normal text-mist/80">— vult naam, lidnummer &amp; UUID in</span>
          </label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <input
              id="knltb-search" v-model="knltbQuery" @input="onKnltbInput" type="text" placeholder="Typ een naam..."
              class="input !pl-11 !pr-11"
            />
            <Loader2 v-if="knltbLoading" class="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-mist" />
          </div>

          <div v-if="knltbError" class="note note-amber mt-3">
            <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />{{ knltbError }}
          </div>

          <ul v-if="knltbResults.length > 0" data-lenis-prevent class="mt-3 max-h-60 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-ink-900">
            <li v-for="m in knltbResults" :key="m.id ?? m.club_member_id">
              <button type="button" @click="pickKnltbResult(m)" class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-lime/10">
                <span class="text-sm font-medium text-fog">{{ knltbName(m) }}</span>
                <span class="font-mono text-xs text-mist">{{ knltbNumber(m) }}</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="label" for="new-name">Naam</label>
            <input id="new-name" v-model="newName" type="text" placeholder="Jan de Vries" class="input" @keyup.enter="submitAdd" />
          </div>
          <div>
            <label class="label" for="new-number">KNLTB lidnummer</label>
            <input id="new-number" v-model="newNumber" type="text" inputmode="numeric" placeholder="12345678" class="input font-mono" @keyup.enter="submitAdd" />
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="new-uuid">
              Club member UUID <span class="normal-case tracking-normal text-mist/80">— nodig om te boeken, mag ook later</span>
            </label>
            <input id="new-uuid" v-model="newUuid" type="text" placeholder="5331bbd0-1993-4fff-b3d8-46950b4ea031" class="input font-mono" @keyup.enter="submitAdd" />
          </div>
        </div>

        <div class="mt-7 flex flex-wrap gap-3">
          <button @click="submitAdd" class="btn btn-primary"><Check class="h-4 w-4" />Toevoegen</button>
          <button @click="showAddForm = false; newName = ''; newNumber = ''; newUuid = ''" class="btn btn-ghost"><X class="h-4 w-4" />Annuleren</button>
        </div>
      </div>
    </Transition>

    <!-- Empty state -->
    <div v-if="store.members.length === 0" data-reveal class="panel flex flex-col items-center px-6 py-20 text-center">
      <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white/5">
        <Users class="h-7 w-7 text-mist" />
      </div>
      <h2 class="display text-3xl text-fog">Nog geen leden</h2>
      <p class="mt-2 mb-6 text-sm text-mist">Voeg KNLTB lidnummers toe om reserveringen te kunnen maken.</p>
      <button @click="showAddForm = true" class="btn btn-primary"><Plus class="h-4 w-4" />Voeg je eerste lid toe</button>
    </div>

    <template v-else>
      <!-- Search -->
      <div data-reveal class="relative mb-6 max-w-md">
        <label for="member-search" class="sr-only">Zoek op naam of lidnummer</label>
        <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
        <input id="member-search" v-model="searchQuery" type="text" placeholder="Zoek op naam of lidnummer..." class="input !rounded-full !pl-11" />
      </div>

      <!-- Grid -->
      <div ref="grid" data-reveal-group class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="member in store.members"
          v-show="matches(member)"
          :key="member.id"
          v-tilt="4"
          data-member
          data-reveal
          class="panel spotlight p-5"
        >
          <!-- Edit mode -->
          <template v-if="editingId === member.id">
            <div class="space-y-2.5">
              <input v-model="editName" type="text" placeholder="Naam" aria-label="Naam" class="input !py-2.5" />
              <input v-model="editNumber" type="text" placeholder="Lidnummer" aria-label="Lidnummer" class="input !py-2.5 font-mono" />
              <input v-model="editUuid" type="text" placeholder="Club member UUID" aria-label="Club member UUID" class="input !py-2.5 font-mono" />
              <div class="flex gap-2 pt-1">
                <button @click="submitEdit" class="btn btn-primary flex-1 !py-2.5"><Check class="h-4 w-4" />Opslaan</button>
                <button @click="cancelEdit" class="btn btn-ghost flex-1 !py-2.5"><X class="h-4 w-4" />Annuleren</button>
              </div>
            </div>
          </template>

          <!-- View mode -->
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-4">
                <div
                  class="display flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl"
                  :class="member.clubMemberId ? 'bg-lime text-ink' : 'border border-amber/50 bg-amber/10 text-amber'"
                  aria-hidden="true"
                >{{ initials(member.name) }}</div>
                <div class="min-w-0">
                  <h3 class="line-clamp-2 text-lg font-semibold leading-tight text-fog">{{ member.name }}</h3>
                  <p v-if="member.memberNumber" class="mt-0.5 font-mono text-sm text-mist">{{ member.memberNumber }}</p>
                  <p v-else class="mt-0.5 whitespace-nowrap font-mono text-xs text-amber">geen lidnummer</p>
                </div>
              </div>
              <div class="flex flex-shrink-0">
                <button @click="startEdit(member)" class="btn-icon" :aria-label="`${member.name} bewerken`"><Pencil class="h-4 w-4" /></button>
                <button @click="deleteMember(member.id)" class="btn-icon hover:!bg-danger/15 hover:!text-danger" :aria-label="`${member.name} verwijderen`"><Trash2 class="h-4 w-4" /></button>
              </div>
            </div>

            <div class="mt-5 border-t border-line pt-4">
              <p v-if="member.clubMemberId" class="truncate font-mono text-[11px] text-mist" :title="member.clubMemberId">UUID {{ member.clubMemberId }}</p>
              <template v-else>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm text-amber">UUID ontbreekt — kan niet boeken</p>
                  <button
                    @click="linkMember(member)" :disabled="linkingId === member.id"
                    class="btn btn-ghost flex-shrink-0 !px-3.5 !py-1.5 text-xs"
                  >
                    <Loader2 v-if="linkingId === member.id" class="h-3.5 w-3.5 animate-spin" />
                    <Link2 v-else class="h-3.5 w-3.5" />
                    Koppel via KNLTB
                  </button>
                </div>
                <p v-if="linkErrors[member.id]" class="mt-2 text-xs leading-relaxed text-danger">{{ linkErrors[member.id] }}</p>
              </template>
            </div>
          </template>
        </article>
      </div>

      <p v-if="visibleCount === 0 && searchQuery" class="py-12 text-center text-mist">
        Geen leden gevonden voor "<strong class="text-fog">{{ searchQuery }}</strong>"
      </p>
    </template>

  </div>
</template>
