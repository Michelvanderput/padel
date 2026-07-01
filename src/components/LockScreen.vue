<script setup>
import { ref } from 'vue'
import { Trophy, Lock, Eye, EyeOff } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits(['unlocked'])
const settings = useSettingsStore()

const input     = ref('')
const showPw    = ref(false)
const error     = ref(false)
const shaking   = ref(false)

function attempt() {
  if (input.value === settings.appPassword) {
    sessionStorage.setItem('padel-unlocked', '1')
    emit('unlocked')
  } else {
    error.value   = true
    shaking.value = true
    input.value   = ''
    setTimeout(() => { shaking.value = false }, 500)
    setTimeout(() => { error.value   = false }, 2000)
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">

    <!-- Radial glow -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/30 via-transparent to-transparent pointer-events-none"></div>

    <div
      class="relative w-full max-w-sm"
      :class="shaking ? 'animate-bounce' : ''"
    >
      <!-- Logo -->
      <div class="flex flex-col items-center mb-10">
        <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30 mb-4">
          <Trophy class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-2xl font-bold text-white">Padel Booker</h1>
        <p class="text-slate-400 text-sm mt-1">Ready Maastricht</p>
      </div>

      <!-- Card -->
      <div class="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
        <div class="flex items-center gap-2 mb-5">
          <Lock class="w-4 h-4 text-slate-400" />
          <p class="text-sm font-medium text-slate-300">Voer wachtwoord in</p>
        </div>

        <!-- Input -->
        <div class="relative mb-4">
          <input
            v-model="input"
            :type="showPw ? 'text' : 'password'"
            placeholder="••••••••"
            autofocus
            @keyup.enter="attempt"
            class="w-full px-4 py-3 pr-12 rounded-xl text-white placeholder-slate-600 text-sm font-medium transition-all outline-none border"
            :class="error
              ? 'bg-red-950/40 border-red-500/60 focus:border-red-400'
              : 'bg-slate-800 border-slate-700 focus:border-green-500/60'"
          />
          <button
            @click="showPw = !showPw"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            tabindex="-1"
          >
            <component :is="showPw ? EyeOff : Eye" class="w-4 h-4" />
          </button>
        </div>

        <!-- Error message -->
        <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0">
          <p v-if="error" class="text-xs text-red-400 mb-4 font-medium">Onjuist wachtwoord. Probeer opnieuw.</p>
        </Transition>

        <!-- Button -->
        <button
          @click="attempt"
          class="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-all shadow-lg shadow-green-500/25 active:scale-95"
        >
          Inloggen
        </button>
      </div>

      <p class="text-center text-xs text-slate-600 mt-5">Standaard wachtwoord: <span class="text-slate-500 font-mono">padel2026</span></p>
    </div>
  </div>
</template>
