<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Users, PlusCircle, ListOrdered, Settings } from '@lucide/vue'
import { initScheduler } from '@/services/scheduler'
import { useSettingsStore } from '@/stores/settings'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { useCourtsStore } from '@/stores/courts'
import { prefersReducedMotion } from '@/lib/motion'
import { installPageTransition } from '@/lib/pageTransition'
import { finishIntro } from '@/lib/intro'
import { startSmoothScroll, stopSmoothScroll } from '@/composables/useSmoothScroll'
import Preloader from '@/components/Preloader.vue'
import CursorFollower from '@/components/CursorFollower.vue'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const navLinks = [
  { to: '/',             label: 'Home',      icon: LayoutDashboard },
  { to: '/leden',        label: 'Leden',     icon: Users },
  { to: '/nieuw',        label: 'Nieuw',     icon: PlusCircle },
  { to: '/wachtrij',     label: 'Wachtrij',  icon: ListOrdered },
  { to: '/instellingen', label: 'Config',    icon: Settings },
]

// ── Preloader: alleen de eerste keer per sessie ────────────────
function shouldPlayIntro() {
  if (prefersReducedMotion()) return false
  try { return !sessionStorage.getItem('pm-intro') } catch (_) { return true }
}
const showIntro = ref(shouldPlayIntro())
if (!showIntro.value) finishIntro()

function onIntroDone() {
  try { sessionStorage.setItem('pm-intro', '1') } catch (_) {}
  showIntro.value = false
  finishIntro()
}

// ── Actieve pil in de navigatie ────────────────────────────────
const pillNav = ref(null)
const pill = ref({ x: 0, w: 0, show: false })

function movePill() {
  const el = pillNav.value?.querySelector('[data-active="true"]')
  if (!el) { pill.value = { ...pill.value, show: false }; return }
  pill.value = { x: el.offsetLeft, w: el.offsetWidth, show: true }
}
watch(() => route.path, () => nextTick(movePill))

// ── Paginawissel: limoenen gordijn (zie lib/pageTransition.js) ─
const curtain = ref(null)
let removePageTransition = () => {}

// ── Data + scheduler (ongewijzigd) ─────────────────────────────
let refreshInterval = null

onMounted(async () => {
  startSmoothScroll()
  removePageTransition = installPageTransition(router, curtain.value)
  document.fonts?.ready.then(() => nextTick(movePill))
  window.addEventListener('resize', movePill)
  nextTick(movePill)

  const reservationsStore = useReservationsStore()
  const membersStore = useMembersStore()
  const courtsStore = useCourtsStore()
  await Promise.all([reservationsStore.init(), membersStore.init(), settingsStore.init()])
  initScheduler()
  if (settingsStore.isConfigured) {
    courtsStore.fetchCourts(settingsStore.clubId, settingsStore.lisaToken)
  }

  // Server-side cron-worker kan reserveringen boeken zonder dat deze tab open staat —
  // periodiek verversen zorgt dat de UI die wijzigingen (bijna) live laat zien.
  refreshInterval = setInterval(() => reservationsStore.init(), 10_000)
})

onBeforeUnmount(() => {
  clearInterval(refreshInterval)
  removePageTransition()
  window.removeEventListener('resize', movePill)
  stopSmoothScroll()
})
</script>

<template>
  <div class="relative min-h-screen overflow-x-clip bg-ink">
    <a href="#main" class="sr-only z-[110] rounded-full bg-lime px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Naar de inhoud</a>

    <Preloader v-if="showIntro" @done="onIntroDone" />
    <CursorFollower />

    <!-- Paginawissel-gordijn -->
    <div ref="curtain" class="pointer-events-none invisible fixed inset-0 z-[85] bg-lime" aria-hidden="true"></div>

    <!-- ── Topbalk ── -->
    <div class="pointer-events-none fixed inset-x-0 top-0 z-40 h-28 bg-gradient-to-b from-ink/90 via-ink/50 to-transparent" aria-hidden="true"></div>
    <header class="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-4 sm:px-8 sm:pt-6">
      <RouterLink to="/" class="pointer-events-auto flex items-center gap-3 rounded-full" aria-label="Padel Maatjes, naar home">
        <img src="/logo.webp" alt="" width="40" height="40" class="h-10 w-10 rounded-full bg-white object-cover ring-1 ring-white/20" />
        <span class="hidden leading-none sm:block">
          <span class="display block text-[1.15rem] text-fog">Padel Maatjes</span>
          <span class="eyebrow mt-1 block">Ready Maastricht</span>
        </span>
      </RouterLink>

      <!-- Zwevende pil-navigatie (desktop) -->
      <nav
        ref="pillNav"
        aria-label="Hoofdnavigatie"
        class="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border border-line bg-ink/60 p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl lg:flex"
      >
        <span
          class="absolute bottom-1.5 left-0 top-1.5 rounded-full bg-lime transition-[transform,width,opacity] duration-500 ease-out-expo"
          :class="pill.show ? 'opacity-100' : 'opacity-0'"
          :style="{ width: pill.w + 'px', transform: `translateX(${pill.x}px)` }"
          aria-hidden="true"
        ></span>
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          :data-active="route.path === link.to"
          :aria-current="route.path === link.to ? 'page' : undefined"
          class="relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300"
          :class="route.path === link.to ? 'text-ink' : 'text-mist hover:text-fog'"
        >
          {{ link.label }}
          <span v-if="link.to === '/instellingen' && !settingsStore.isConfigured" class="h-1.5 w-1.5 rounded-full bg-amber" aria-label="Token niet ingesteld"></span>
        </RouterLink>
      </nav>

      <!-- Status -->
      <RouterLink
        to="/instellingen"
        class="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-ink/60 px-3.5 py-2 backdrop-blur-xl"
      >
        <span class="relative flex h-2 w-2">
          <span v-if="settingsStore.isConfigured" class="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-lime"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full" :class="settingsStore.isConfigured ? 'bg-lime' : 'bg-amber'"></span>
        </span>
        <span class="eyebrow !text-fog">{{ settingsStore.isConfigured ? 'Live' : 'Token mist' }}</span>
      </RouterLink>
    </header>

    <!-- ── Pagina ── -->
    <main id="main" class="relative">
      <RouterView />
    </main>

    <footer class="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 pb-32 pt-10 text-mist sm:px-8 lg:flex-row lg:items-center lg:pb-10">
      <p class="eyebrow">Padel Maatjes · Ready Maastricht</p>
      <p class="eyebrow">Boekt 72 uur vooruit — op de milliseconde</p>
    </footer>

    <!-- ── Mobiele tabbalk ── -->
    <nav
      aria-label="Hoofdnavigatie"
      class="fixed inset-x-3 bottom-3 z-50 flex rounded-full border border-line bg-ink/75 p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden"
      style="padding-bottom: max(0.375rem, env(safe-area-inset-bottom))"
    >
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        :aria-current="route.path === link.to ? 'page' : undefined"
        class="relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition-all duration-300 ease-out-expo"
        :class="route.path === link.to ? 'bg-lime text-ink' : 'text-mist'"
      >
        <component :is="link.icon" class="h-[18px] w-[18px]" />
        {{ link.label }}
        <span v-if="link.to === '/instellingen' && !settingsStore.isConfigured" class="absolute right-3 top-1.5 h-1.5 w-1.5 rounded-full bg-amber"></span>
      </RouterLink>
    </nav>
  </div>
</template>
