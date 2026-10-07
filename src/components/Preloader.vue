<script setup>
import { ref, onMounted } from 'vue'
import { gsap } from '@/lib/motion'
import CourtLines from '@/components/CourtLines.vue'

const emit = defineEmits(['done'])

const root    = ref(null)
const counter = ref(null)
const court   = ref(null)

onMounted(() => {
  const lines = court.value.querySelectorAll('.court-line')
  const num = { v: 0 }

  const tl = gsap.timeline({ onComplete: () => emit('done') })
  tl.from(lines, { drawSVG: '0%', duration: 1.1, ease: 'power2.inOut', stagger: 0.12 }, 0)
    .to(num, {
      v: 100, duration: 1.3, ease: 'power2.inOut',
      onUpdate: () => { counter.value.textContent = String(Math.round(num.v)).padStart(3, '0') },
    }, 0)
    .from('[data-pre-word]', { yPercent: 110, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, 0.15)
    .to(court.value, { scale: 1.08, duration: 0.5, ease: 'power2.in' }, 1.2)
    .to('[data-pre-word]', { yPercent: -110, duration: 0.5, ease: 'expo.in', stagger: 0.05 }, 1.3)
    .to(root.value, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 1.5)

  // Vangnet: op een traag apparaat nooit langer dan 5 s blokkeren.
  setTimeout(() => tl.progress(1), 5000)
})
</script>

<template>
  <div ref="root" class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink" role="status" aria-label="Padel Maatjes wordt geladen">
    <div ref="court" class="absolute inset-0 flex items-center justify-center text-lime/70">
      <CourtLines class="h-[78vh] max-h-[760px]" />
    </div>

    <div class="relative flex flex-col items-center gap-3">
      <div class="overflow-hidden"><p data-pre-word class="display text-[clamp(2.6rem,9vw,6rem)] text-fog">Padel</p></div>
      <div class="overflow-hidden"><p data-pre-word class="display text-[clamp(2.6rem,9vw,6rem)] text-lime">Maatjes</p></div>
    </div>

    <p ref="counter" class="absolute bottom-8 right-8 font-mono text-sm tracking-[0.2em] text-mist tabular">000</p>
    <p class="absolute bottom-8 left-8 eyebrow">Ready Maastricht</p>
  </div>
</template>
