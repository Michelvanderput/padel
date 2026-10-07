<script setup>
import { ref } from 'vue'
import { Key, Hash, Check, AlertCircle, Terminal, Trash2, ChevronDown, ChevronUp } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { apiLog, clearApiLog } from '@/services/logger'
import PageHeader from '@/components/PageHeader.vue'
import { useReveal } from '@/composables/useReveal'

const root = ref(null)
useReveal(root)

const store    = useSettingsStore()
const saved    = ref(false)
const token    = ref(store.lisaToken)
const clubId   = ref(store.clubId)

function save() {
  store.lisaToken   = token.value.trim()
  store.clubId      = clubId.value.trim()
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

const expandedLog = ref(new Set())
function toggleLog(i) {
  if (expandedLog.value.has(i)) expandedLog.value.delete(i)
  else expandedLog.value.add(i)
  expandedLog.value = new Set(expandedLog.value)
}
function formatLogTime(iso) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<template>
  <div ref="root" class="mx-auto max-w-3xl px-4 pb-16 pt-32 sm:px-8 sm:pt-40">

    <PageHeader eyebrow="Configuratie" title="Instellingen" subtitle="KNLTB API-configuratie voor automatisch boeken." />

    <div class="space-y-5">

      <!-- Auth token -->
      <section data-reveal class="panel space-y-6 p-6 sm:p-8" aria-labelledby="auth-title">
        <div class="flex items-center gap-3">
          <Key class="h-4 w-4 text-lime" />
          <h2 id="auth-title" class="display text-2xl text-fog">Authenticatie</h2>
          <span
            class="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em]"
            :class="store.isConfigured ? 'border-lime/30 bg-lime/10 text-lime' : 'border-amber/30 bg-amber/10 text-amber'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="store.isConfigured ? 'bg-lime' : 'bg-amber'"></span>
            {{ store.isConfigured ? 'Geconfigureerd' : 'Niet ingesteld' }}
          </span>
        </div>

        <div class="note note-sky">
          <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div class="text-fog/90">
            <p class="mb-1.5 font-semibold text-sky">Hoe krijg je je Lisa Auth Token?</p>
            <ol class="list-inside list-decimal space-y-1 text-mist">
              <li>Open <strong class="text-fog">Proxyman</strong> op je Mac/iPhone</li>
              <li>Start de KNLTB app en open de reserveringspagina</li>
              <li>Zoek een call naar <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-fog">api.knltb.club</code></li>
              <li>Kopieer de header <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-fog">x-lisa-auth-token</code></li>
            </ol>
          </div>
        </div>

        <div>
          <label for="token" class="label">x-lisa-auth-token</label>
          <textarea id="token" v-model="token" rows="3" placeholder="pRBYZW5NuaF9GXaxwHxmXA==" class="input resize-none font-mono leading-relaxed"></textarea>
          <p class="mt-2 text-xs text-mist">Tokens verlopen — pas bij zodra de app niet meer boekt.</p>
        </div>
      </section>

      <!-- Club ID -->
      <section data-reveal class="panel space-y-5 p-6 sm:p-8" aria-labelledby="club-title">
        <div class="flex items-center gap-3">
          <Hash class="h-4 w-4 text-lime" />
          <h2 id="club-title" class="display text-2xl text-fog">Club ID</h2>
        </div>
        <div>
          <label for="club" class="label">KNLTB club UUID</label>
          <input id="club" v-model="clubId" type="text" placeholder="568d56ef-ba65-405d-b2e1-82453a182de1" class="input font-mono" />
        </div>
      </section>

      <div data-reveal>
        <button @click="save" class="btn w-full !py-4 text-base" :class="saved ? 'border border-lime/40 bg-lime/10 text-lime' : 'btn-primary'">
          <Check class="h-4 w-4" />{{ saved ? 'Opgeslagen!' : 'Instellingen opslaan' }}
        </button>
      </div>

      <div v-if="!store.isConfigured" data-reveal class="note note-amber items-center">
        <AlertCircle class="h-5 w-5 flex-shrink-0" />
        <p>Zonder token worden reserveringen <strong>niet automatisch geboekt</strong>. De wachtrij werkt wel.</p>
      </div>

      <!-- API debug log -->
      <section data-reveal class="panel overflow-hidden" aria-labelledby="log-title">
        <div class="flex items-center justify-between border-b border-line px-6 py-5">
          <div class="flex items-center gap-3">
            <Terminal class="h-4 w-4 text-lime" />
            <h2 id="log-title" class="display text-2xl text-fog">API-log</h2>
            <span class="font-mono text-xs text-mist">({{ apiLog.length }})</span>
          </div>
          <button @click="clearApiLog" class="btn-icon hover:!bg-danger/15 hover:!text-danger" aria-label="Log wissen"><Trash2 class="h-4 w-4" /></button>
        </div>

        <p class="border-b border-line px-6 py-3 text-xs leading-relaxed text-mist">
          Laatste calls naar api.knltb.club — handig om te zien waar een boeking misgaat. Klik op een regel voor de volledige response.
        </p>

        <div v-if="apiLog.length === 0" class="px-6 py-10 text-center text-sm text-mist">Nog geen API calls gelogd.</div>

        <div v-else data-lenis-prevent class="max-h-96 divide-y divide-line overflow-y-auto">
          <div v-for="(entry, i) in apiLog" :key="i">
            <button @click="toggleLog(i)" :aria-expanded="expandedLog.has(i)" class="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/[0.03]">
              <component :is="expandedLog.has(i) ? ChevronUp : ChevronDown" class="h-3.5 w-3.5 flex-shrink-0 text-mist" />
              <span class="w-20 flex-shrink-0 font-mono text-xs text-mist tabular">{{ formatLogTime(entry.time) }}</span>
              <span class="w-10 flex-shrink-0 font-mono text-xs font-bold" :class="entry.error ? 'text-danger' : entry.ok ? 'text-lime' : 'text-amber'">{{ entry.status || 'ERR' }}</span>
              <span class="truncate font-mono text-xs text-fog/80">{{ entry.method }} {{ entry.path }}</span>
            </button>
            <pre v-if="expandedLog.has(i)" class="mx-6 mb-3 overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-[11px] text-fog/80">{{ JSON.stringify(entry.error ?? entry.data, null, 2) }}</pre>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
