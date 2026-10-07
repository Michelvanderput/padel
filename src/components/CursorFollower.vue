<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, prefersReducedMotion, hasFinePointer } from '@/lib/motion'

const ring = ref(null)
const enabled = ref(false)
let cleanup = () => {}

onMounted(() => {
  if (prefersReducedMotion() || !hasFinePointer()) return
  enabled.value = true

  requestAnimationFrame(() => {
    const el = ring.value
    if (!el) return
    gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0 })
    const x = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' })

    const move = e => { gsap.to(el, { opacity: 1, duration: 0.3, overwrite: 'auto' }); x(e.clientX); y(e.clientY) }
    const over = e => {
      const hot = e.target.closest?.('a, button, [role="button"], label, input, textarea, select')
      gsap.to(el, { scale: hot ? 2.2 : 1, backgroundColor: hot ? 'rgba(205,255,46,0.15)' : 'rgba(205,255,46,0)', duration: 0.35, ease: 'expo.out', overwrite: 'auto' })
    }
    const leave = () => gsap.to(el, { opacity: 0, duration: 0.3 })

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  })
})

onBeforeUnmount(() => cleanup())
</script>

<template>
  <div v-if="enabled" ref="ring" class="pointer-events-none fixed left-0 top-0 z-[95] h-8 w-8 rounded-full border border-lime/80" aria-hidden="true"></div>
</template>
