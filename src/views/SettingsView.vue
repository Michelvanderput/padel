<script setup>
import { ref } from 'vue'
import { Key, Hash, Check, AlertCircle, Terminal, Trash2, ChevronDown, ChevronUp } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { apiLog, clearApiLog } from '@/services/logger'

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
  <div class="max-w-2xl space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Instellingen</h1>
      <p class="text-sm text-slate-400 mt-1">KNLTB API-configuratie voor automatisch boeken</p>
    </div>

    <!-- Auth token -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <div class="flex items-center gap-2">
        <Key class="w-4 h-4 text-slate-400" />
        <h2 class="font-semibold text-slate-900">Authenticatie</h2>
        <span v-if="store.isConfigured" class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Geconfigureerd
        </span>
        <span v-else class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Niet ingesteld
        </span>
      </div>

      <div class="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm">
        <AlertCircle class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div class="text-blue-800">
          <p class="font-semibold mb-1">Hoe krijg je je Lisa Auth Token?</p>
          <ol class="list-decimal list-inside space-y-0.5 text-blue-700">
            <li>Open <strong>Proxyman</strong> op je Mac/iPhone</li>
            <li>Start de KNLTB app en open de reserveringspagina</li>
            <li>Zoek een call naar <code class="bg-blue-100 px-1 rounded">api.knltb.club</code></li>
            <li>Kopieer de header <code class="bg-blue-100 px-1 rounded">x-lisa-auth-token</code></li>
          </ol>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1.5">x-lisa-auth-token</label>
        <textarea
          v-model="token"
          rows="3"
          placeholder="pRBYZW5NuaF9GXaxwHxmXA=="
          class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none leading-relaxed"
        />
        <p class="text-xs text-slate-400 mt-1.5">Tokens verlopen — pas bij zodra de app niet meer boekt</p>
      </div>
    </div>

    <!-- Club ID -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div class="flex items-center gap-2">
        <Hash class="w-4 h-4 text-slate-400" />
        <h2 class="font-semibold text-slate-900">Club ID</h2>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-600 mb-1.5">KNLTB Club UUID</label>
        <input
          v-model="clubId"
          type="text"
          placeholder="568d56ef-ba65-405d-b2e1-82453a182de1"
          class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
        />
      </div>
    </div>

    <!-- Save -->
    <button
      @click="save"
      class="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all"
      :class="saved
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25'"
    >
      <Check class="w-4 h-4" />
      {{ saved ? 'Opgeslagen!' : 'Instellingen opslaan' }}
    </button>

    <!-- Warning -->
    <div v-if="!store.isConfigured" class="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
      <AlertCircle class="w-5 h-5 text-amber-500 flex-shrink-0" />
      <p class="text-sm text-amber-800">
        Zonder token worden reserveringen <strong>niet automatisch geboekt</strong>. De wachtrij werkt wel.
      </p>
    </div>

    <!-- API debug log -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Terminal class="w-4 h-4 text-slate-400" />
          <h2 class="font-semibold text-slate-900">API-log</h2>
          <span class="text-xs text-slate-400">({{ apiLog.length }})</span>
        </div>
        <button @click="clearApiLog" class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Wissen">
          <Trash2 class="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <p class="px-6 py-3 text-xs text-slate-400 border-b border-slate-50">
        Laatste calls naar api.knltb.club — handig om te zien waar een boeking misgaat. Klik op een regel voor de volledige response.
      </p>

      <div v-if="apiLog.length === 0" class="px-6 py-8 text-center text-sm text-slate-400">
        Nog geen API calls gelogd.
      </div>

      <div v-else class="max-h-96 overflow-y-auto divide-y divide-slate-50">
        <div v-for="(entry, i) in apiLog" :key="i">
          <button
            @click="toggleLog(i)"
            class="w-full flex items-center gap-2 px-6 py-2.5 text-left hover:bg-slate-50 transition-colors"
          >
            <component :is="expandedLog.has(i) ? ChevronUp : ChevronDown" class="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
            <span class="text-xs text-slate-400 font-mono flex-shrink-0 w-20">{{ formatLogTime(entry.time) }}</span>
            <span
              class="text-xs font-bold flex-shrink-0 w-10"
              :class="entry.error ? 'text-red-500' : entry.ok ? 'text-green-600' : 'text-amber-600'"
            >{{ entry.status || 'ERR' }}</span>
            <span class="text-xs font-mono text-slate-600 truncate">{{ entry.method }} {{ entry.path }}</span>
          </button>
          <pre
            v-if="expandedLog.has(i)"
            class="mx-6 mb-3 p-3 bg-slate-950 text-slate-300 rounded-lg text-[11px] overflow-x-auto"
          >{{ JSON.stringify(entry.error ?? entry.data, null, 2) }}</pre>
        </div>
      </div>
    </div>

  </div>
</template>
