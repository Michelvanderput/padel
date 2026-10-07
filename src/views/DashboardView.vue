<script setup>
import { computed, ref, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, Calendar, CalendarDays, Users } from '@lucide/vue'
import { useReservationsStore } from '@/stores/reservations'
import { useMembersStore } from '@/stores/members'
import { useCourtsStore } from '@/stores/courts'
import StatusBadge from '@/components/StatusBadge.vue'
import CourtLines from '@/components/CourtLines.vue'
import { useReveal } from '@/composables/useReveal'
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion'

// Three.js laadt pas nadat de pagina staat
const RacketScene = defineAsyncComponent(() => import('@/components/RacketScene.vue'))

const reservationsStore = useReservationsStore()
const membersStore = useMembersStore()
const courtsStore = useCourtsStore()

const root = ref(null)
useReveal(root)

const stats = computed(() => ({
  pending:  reservationsStore.reservations.filter(r => r.status === 'pending').length,
  active:   reservationsStore.reservations.filter(r => r.status === 'active').length,
  reserved: reservationsStore.reservations.filter(r => r.status === 'reserved').length,
  members:  membersStore.members.length,
}))

const upcoming = computed(() =>
  [...reservationsStore.reservations]
    .filter(r => ['pending', 'active'].includes(r.status))
    .sort((a, b) => new Date(a.bookingTrigger) - new Date(b.bookingTrigger))
    .slice(0, 5)
)

function getCourtName(id) {
  return courtsStore.courts.find(c => c.id === id)?.name ?? 'Onbekende baan'
}
function getMemberNames(ids) {
  return ids
    .map(id => membersStore.members.find(m => m.id === id))
    .filter(Boolean)
    .map(m => m.name.split(' ')[0])
    .join(' · ')
}
function formatDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTrigger(iso) {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const photos = [
  { src: '/photos/padel-1.webp', alt: 'Padel actie bij het net',  cls: 'lg:col-span-5 lg:mt-0' },
  { src: '/photos/padel-2.webp', alt: 'Smash boven het net',      cls: 'lg:col-span-3 lg:mt-24' },
  { src: '/photos/padel-5.webp', alt: 'Kampioenen met beker',     cls: 'lg:col-span-4 lg:mt-8' },
  { src: '/photos/padel-4.webp', alt: 'Vier spelers in actie',    cls: 'lg:col-span-5 lg:col-start-4 lg:-mt-6' },
]

const steps = [
  { n: '01', title: 'Kies je baan', text: 'Datum, tijdslot en vier maatjes. Beschikbaarheid komt live uit het KNLTB-systeem.' },
  { n: '02', title: 'Wij tellen af', text: 'Precies 72 uur (min twee minuten) voor de speeltijd gaat de wachtrij af. Ook als jouw tab dicht staat.' },
  { n: '03', title: 'Baan is van jullie', text: 'Reservering geplaatst op de milliseconde. Jij hoeft alleen nog te komen.' },
]

// ── 3D-scène ───────────────────────────────────────────────────
const heroEl = ref(null)
const heroScene = ref(null)
const showcaseEl = ref(null)
const showcaseScene = ref(null)
const activeStep = ref(0)   // alleen bijwerken als de stap wisselt
const heroFallback = ref(false)

let ctx = null
let marqueeTick = null
onMounted(() => {
  if (prefersReducedMotion()) return
  ctx = gsap.context(() => {
    ScrollTrigger.create({
      trigger: heroEl.value, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: self => heroScene.value?.setProgress(self.progress),
    })
    ScrollTrigger.create({
      trigger: showcaseEl.value, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: self => {
        showcaseScene.value?.setProgress(self.progress)
        const step = Math.min(2, Math.floor(self.progress * 3))
        if (step !== activeStep.value) activeStep.value = step
      },
    })

    // Hero-tekst schuift iets sneller weg dan de pagina (parallax)
    gsap.to('[data-hero-text]', {
      yPercent: -18, ease: 'none',
      scrollTrigger: { trigger: heroEl.value, start: 'top top', end: 'bottom top', scrub: true },
    })

    // Marquee: loopt altijd, versnelt met de scrollsnelheid en keert mee met de scrollrichting
    const track = root.value.querySelector('[data-marquee]')
    const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 })
    let vel = 0, dir = 1
    ScrollTrigger.create({
      onUpdate: self => { vel = self.getVelocity(); if (vel) dir = vel > 0 ? 1 : -1 },
    })
    marqueeTick = () => {
      vel *= 0.92
      loop.timeScale(dir * (1 + Math.min(Math.abs(vel) / 250, 5)))
    }
    gsap.ticker.add(marqueeTick)

    // Foto's: clip-path reveal + parallax
    root.value.querySelectorAll('[data-photo]').forEach(el => {
      const img = el.querySelector('img')
      gsap.fromTo(el, { clipPath: 'inset(14% 14% 14% 14% round 28px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 45%', scrub: true },
      })
      gsap.fromTo(img, { yPercent: -8, scale: 1.18 }, {
        yPercent: 8, scale: 1.18, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      })
    })
  }, root.value)
})

onBeforeUnmount(() => {
  if (marqueeTick) gsap.ticker.remove(marqueeTick)
  ctx?.revert()
})
</script>

<template>
  <div ref="root">

    <!-- ══ HERO ══════════════════════════════════════════════ -->
    <section ref="heroEl" class="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-4 pb-10 pt-[46svh] sm:px-8 lg:pt-28">
      <!-- glow + baanlijnen -->
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -right-[10%] top-[8%] h-[70vmin] w-[70vmin] rounded-full bg-lime/[0.12] blur-[120px]"></div>
        <div class="absolute -left-[20%] bottom-0 h-[60vmin] w-[60vmin] rounded-full bg-clay/[0.10] blur-[140px]"></div>
        <CourtLines class="absolute -right-[6%] top-1/2 h-[135vh] -translate-y-1/2 rotate-[14deg] text-white/[0.06]" :stroke-width="0.9" />
      </div>

      <!-- 3D rackets (mobiel: eigen vak boven de tekst) -->
      <div class="absolute inset-x-0 top-0 h-[46svh] lg:inset-0 lg:h-auto">
        <RacketScene v-if="!heroFallback" ref="heroScene" mode="hero" @fallback="heroFallback = true" />
        <img v-else src="/logo.svg" alt="" class="absolute right-[10%] top-1/2 aspect-square h-[40vh] -translate-y-1/2 opacity-90 lg:h-[52vh]" />
      </div>

      <!-- tekst -->
      <div data-hero-text class="pointer-events-none relative z-10 mx-auto w-full max-w-[1500px]">
        <p data-reveal class="eyebrow eyebrow-lime mb-6 flex items-center gap-3">
          <span class="h-px w-10 bg-lime"></span>Ready Maastricht · Automatisch reserveren
        </p>
        <h1 data-split class="display title-xl text-fog">
          Padel<br /><span class="text-lime">Maatjes</span>
        </h1>

        <div class="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p data-reveal class="max-w-md text-lg leading-snug text-mist">
            De baan is van jullie zodra hij vrijkomt. Wij boeken 72 uur vooruit,
            op de milliseconde &mdash; jij speelt gewoon.
          </p>
          <div data-reveal class="pointer-events-auto flex flex-wrap gap-3">
            <RouterLink v-magnetic="0.25" to="/nieuw" class="btn btn-primary !px-7 !py-4 text-base">
              Nieuwe reservering <ArrowUpRight class="h-4 w-4" />
            </RouterLink>
            <RouterLink v-magnetic="0.25" to="/wachtrij" class="btn btn-ghost !px-7 !py-4 text-base">
              Bekijk wachtrij
            </RouterLink>
          </div>
        </div>

        <!-- live stats -->
        <dl data-reveal-group class="pointer-events-auto mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-4">
          <div v-for="s in [
            { k: 'Wachtend', v: stats.pending, c: 'text-amber' },
            { k: 'Actief', v: stats.active, c: 'text-sky' },
            { k: 'Gereserveerd', v: stats.reserved, c: 'text-lime' },
            { k: 'Leden', v: stats.members, c: 'text-fog' },
          ]" :key="s.k" data-reveal class="bg-ink/85 px-5 py-4">
            <dt class="eyebrow">{{ s.k }}</dt>
            <dd class="display mt-1 text-5xl tabular" :class="s.c">{{ s.v }}</dd>
          </div>
        </dl>
      </div>

    </section>

    <!-- ══ MARQUEE ═══════════════════════════════════════════ -->
    <section id="marquee" class="relative overflow-hidden border-y border-line bg-ink-900 py-6" aria-hidden="true">
      <div data-marquee class="flex w-max whitespace-nowrap will-change-transform">
        <div v-for="n in 2" :key="n" class="flex items-center">
          <template v-for="(w, i) in ['72 uur vooruit', 'Op de milliseconde', 'Vier maatjes', 'Ready Maastricht', 'Baan geregeld']" :key="i">
            <span class="display px-8 text-[clamp(2.2rem,5vw,4.5rem)]" :class="i % 2 ? 'text-outline' : 'text-fog'">{{ w }}</span>
            <span class="h-3 w-3 rotate-45 bg-lime"></span>
          </template>
        </div>
      </div>
    </section>

    <!-- ══ SHOWCASE (sticky 3D-racket) ═══════════════════════ -->
    <section ref="showcaseEl" class="relative h-[320vh]" aria-labelledby="how-title">
      <div class="sticky top-0 flex h-screen items-end overflow-hidden px-4 pb-24 sm:px-8 lg:items-center lg:pb-0">
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime/[0.07] blur-[100px]"></div>
        </div>

        <div class="absolute inset-x-0 top-0 h-[52%] lg:inset-0 lg:left-[30%] lg:h-auto">
          <RacketScene v-if="!heroFallback" ref="showcaseScene" mode="showcase" :interactive="false" />
        </div>

        <div class="relative z-10 mx-auto w-full max-w-6xl">
          <p class="eyebrow eyebrow-lime mb-4">Zo werkt het</p>
          <h2 id="how-title" data-split class="display title-lg max-w-3xl text-fog">Drie stappen,<br />nul gedoe.</h2>

          <ol class="mt-6 max-w-md space-y-3 lg:mt-10">
            <li
              v-for="(s, i) in steps" :key="s.n"
              class="panel p-5 transition-[opacity,transform,border-color] duration-500 ease-out-expo"
              :class="activeStep === i ? 'border-lime/40 opacity-100' : 'hidden opacity-35 lg:block'"
            >
              <div class="flex items-baseline gap-4">
                <span class="font-mono text-sm text-lime">{{ s.n }}</span>
                <div>
                  <h3 class="display text-2xl text-fog">{{ s.title }}</h3>
                  <p class="mt-1.5 text-sm leading-relaxed text-mist">{{ s.text }}</p>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <!-- ══ AANKOMEND + BENTO ═════════════════════════════════ -->
    <section class="mx-auto max-w-6xl px-4 py-20 sm:px-8">
      <div class="mb-10 flex items-end justify-between gap-6">
        <div>
          <p data-reveal class="eyebrow eyebrow-lime mb-3">In de wachtrij</p>
          <h2 data-split class="display title-md text-fog">Aankomende<br />reserveringen</h2>
        </div>
        <RouterLink data-reveal to="/wachtrij" class="btn btn-ghost hidden sm:inline-flex">Alles bekijken <ArrowUpRight class="h-4 w-4" /></RouterLink>
      </div>

      <div data-reveal-group class="grid gap-4 lg:grid-cols-3">
        <!-- lijst -->
        <div data-reveal class="panel overflow-hidden lg:col-span-2">
          <div v-if="upcoming.length === 0" class="flex flex-col items-center px-6 py-20 text-center">
            <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white/5">
              <Calendar class="h-7 w-7 text-mist" />
            </div>
            <p class="display text-2xl text-fog">Geen aankomende reserveringen</p>
            <p class="mt-2 text-sm text-mist">Plan je eerste potje en laat de rest aan ons.</p>
            <RouterLink to="/nieuw" class="btn btn-primary mt-6">Maak je eerste reservering <ArrowUpRight class="h-4 w-4" /></RouterLink>
          </div>

          <ul v-else class="divide-y divide-line">
            <li v-for="res in upcoming" :key="res.id" class="group flex items-center gap-4 px-5 py-5 transition-colors duration-300 hover:bg-white/[0.03] sm:px-6">
              <div class="display w-16 flex-shrink-0 text-center leading-none">
                <span class="block text-4xl text-lime tabular">{{ new Date(res.date + 'T12:00:00').getDate() }}</span>
                <span class="eyebrow mt-1 block">{{ new Date(res.date + 'T12:00:00').toLocaleDateString('nl-NL', { month: 'short' }) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex flex-wrap items-center gap-2">
                  <p class="truncate text-base font-semibold text-fog">{{ getCourtName(res.courtId) }}</p>
                  <StatusBadge :status="res.status" />
                </div>
                <p class="text-sm text-mist">{{ formatDate(res.date) }} · {{ res.timeSlot }} · {{ getMemberNames(res.memberIds) }}</p>
              </div>
              <div class="hidden flex-shrink-0 text-right sm:block">
                <p class="eyebrow">Boekt om</p>
                <p class="mt-1 font-mono text-sm text-fog">{{ formatTrigger(res.bookingTrigger) }}</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- bento-tegels -->
        <div class="grid gap-4">
          <RouterLink v-tilt="5" data-reveal to="/leden" class="panel spotlight group flex flex-col justify-between p-6">
            <div class="flex items-start justify-between">
              <Users class="h-6 w-6 text-lime" />
              <ArrowUpRight class="h-5 w-5 text-mist transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime" />
            </div>
            <div class="mt-10">
              <p class="display text-6xl text-fog tabular">{{ stats.members }}</p>
              <p class="mt-1 text-sm text-mist">maatjes met een lidnummer</p>
            </div>
          </RouterLink>
          <RouterLink v-tilt="5" data-reveal to="/beschikbaarheid" class="panel spotlight group flex flex-col justify-between p-6">
            <div class="flex items-start justify-between">
              <CalendarDays class="h-6 w-6 text-lime" />
              <ArrowUpRight class="h-5 w-5 text-mist transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime" />
            </div>
            <div class="mt-10">
              <p class="display text-3xl text-fog">Wie is er vrij?</p>
              <p class="mt-1 text-sm text-mist">Bekijk alle banen per dag</p>
            </div>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- ══ GALERIJ ═══════════════════════════════════════════ -->
    <section class="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
      <p data-reveal class="eyebrow eyebrow-lime mb-3">De maatjes</p>
      <h2 data-split class="display title-lg mb-12 text-fog">Zo ziet<br />het eruit.</h2>

      <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-9">
        <figure v-for="(p, i) in photos" :key="i" data-photo class="group relative aspect-[6/7] overflow-hidden rounded-[28px] bg-ink-700 lg:col-span-3" :class="p.cls">
          <img :src="p.src" :alt="p.alt" loading="lazy" width="800" height="933" class="h-full w-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
          <figcaption class="eyebrow absolute bottom-4 left-4 translate-y-2 !text-fog opacity-0 transition-all duration-500 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100">{{ p.alt }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- ══ CTA ═══════════════════════════════════════════════ -->
    <section class="relative overflow-hidden border-t border-line px-4 py-28 sm:px-8">
      <div class="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-lime/[0.08] to-transparent"></div>
      <div class="relative mx-auto max-w-6xl text-center">
        <h2 data-split class="display title-xl text-fog">Tijd voor<br /><span class="text-lime">een potje?</span></h2>
        <div data-reveal class="mt-12">
          <RouterLink v-magnetic="0.3" to="/nieuw" class="btn btn-primary !px-10 !py-5 text-lg">
            Nieuwe reservering <ArrowUpRight class="h-5 w-5" />
          </RouterLink>
        </div>
      </div>
    </section>

  </div>
</template>
