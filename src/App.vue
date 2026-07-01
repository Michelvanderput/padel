<script setup>
import { onMounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { LayoutDashboard, Users, PlusCircle, ListOrdered, Settings, AlertTriangle } from '@lucide/vue'
import { initScheduler } from '@/services/scheduler'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const settingsStore = useSettingsStore()

const navLinks = [
  { to: '/',             label: 'Dashboard',          shortLabel: 'Home',     icon: LayoutDashboard },
  { to: '/leden',        label: 'Leden',              shortLabel: 'Leden',    icon: Users },
  { to: '/nieuw',        label: 'Nieuwe reservering', shortLabel: 'Nieuw',    icon: PlusCircle },
  { to: '/wachtrij',     label: 'Wachtrij',      shortLabel: 'Wachtrij', icon: ListOrdered },
  { to: '/instellingen', label: 'Instellingen',  shortLabel: 'Config',   icon: Settings },
]

onMounted(() => { initScheduler() })
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex">

    <!-- ── Sidebar ── -->
    <aside class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-slate-900 z-20">

      <!-- Logo -->
      <div class="flex flex-col items-center px-6 py-6 gap-3">
        <img src="/logo.png" alt="Padel Maatjes" class="w-20 h-20 rounded-full object-cover bg-white shadow-lg ring-2 ring-white/10" />
        <div class="text-center">
          <p class="font-bold text-white text-sm leading-tight tracking-wide">Padel Maatjes</p>
          <p class="text-xs text-slate-400 leading-tight">Ready Maastricht</p>
        </div>
      </div>

      <!-- Divider -->
      <div class="mx-6 h-px bg-slate-700/60 mb-3"></div>

      <!-- Nav -->
      <nav class="flex-1 px-3 space-y-0.5">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group"
          :class="route.path === link.to
            ? 'bg-green-500/15 text-green-400 shadow-sm'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'"
        >
          <component
            :is="link.icon"
            class="w-4.5 h-4.5 flex-shrink-0 transition-colors"
            :class="route.path === link.to ? 'text-green-400' : 'text-slate-500 group-hover:text-slate-300'"
          />
          {{ link.label }}
          <span
            v-if="link.to === '/instellingen' && !settingsStore.isConfigured"
            class="ml-auto w-2 h-2 rounded-full bg-amber-400"
          ></span>
        </RouterLink>
      </nav>

      <!-- Footer -->
      <div class="mx-6 my-6 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40">
        <p class="text-xs text-slate-400 font-medium">v0.1.0</p>
        <div v-if="!settingsStore.isConfigured" class="flex items-center gap-1.5 mt-1.5">
          <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
          <p class="text-xs text-amber-400">Token niet ingesteld</p>
        </div>
        <div v-else class="flex items-center gap-1.5 mt-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
          <p class="text-xs text-green-400">Geconfigureerd</p>
        </div>
      </div>
    </aside>

    <!-- ── Main ── -->
    <div class="flex-1 flex flex-col lg:ml-64 min-h-screen">

      <!-- Mobile header -->
      <header class="lg:hidden bg-slate-900 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <img src="/logo.png" alt="Padel Maatjes" class="w-8 h-8 rounded-full object-cover bg-white" />
        <p class="font-bold text-white">Padel Maatjes</p>
        <div v-if="!settingsStore.isConfigured" class="ml-auto flex items-center gap-1.5">
          <AlertTriangle class="w-4 h-4 text-amber-400" />
        </div>
      </header>

      <!-- Page -->
      <main class="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
        <RouterView />
      </main>

      <!-- Mobile bottom nav -->
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors relative"
          :class="route.path === link.to ? 'text-green-400' : 'text-slate-500'"
        >
          <component :is="link.icon" class="w-5 h-5" />
          {{ link.shortLabel }}
          <span v-if="route.path === link.to" class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-green-400"></span>
        </RouterLink>
      </nav>
    </div>
  </div>
</template>
