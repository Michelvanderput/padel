<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { prefersReducedMotion, hasFinePointer } from '@/lib/motion'
import { introReady } from '@/lib/intro'

const props = defineProps({
  mode:        { type: String,  default: 'hero' },   // 'hero' | 'showcase'
  interactive: { type: Boolean, default: true },     // rackets volgen de muis
})
const emit = defineEmits(['ready', 'fallback'])

const host   = ref(null)
const canvas = ref(null)
const shown  = ref(false)   // canvas faadt in zodra het eerste frame staat

let scene = null
let pendingProgress = 0   // voortgang kan binnenkomen voordat de scène klaar is
let raf = 0
let last = 0
let onScreen = true
let disposed = false
let ro = null
let io = null
const reduced = prefersReducedMotion()

function frame(now) {
  raf = requestAnimationFrame(frame)
  if (!onScreen || document.hidden) { last = now; return }
  const dt = Math.min((now - last) / 1000, 0.05) || 0.016
  last = now
  scene.update(dt)
  scene.render()
}

function renderOnce() {
  if (!scene) return
  scene.update(0.016)
  scene.render()
}

function onPointer(e) {
  if (!scene || !host.value) return
  const r = host.value.getBoundingClientRect()
  scene.setPointer(
    ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)),
    -((e.clientY - (r.top + r.height / 2)) / (r.height / 2)),
  )
}

onMounted(async () => {
  try {
    // Three.js (±150 kB gzip) downloaden we meteen (parallel aan de preloader), maar de
    // scène bouwen en renderen we pas ná de preloader: zo blijft de teller soepel.
    const loading = import('@/lib/racket3d')
    await introReady
    const { createRacketScene } = await loading
    if (disposed) return
    scene = await createRacketScene(canvas.value, { mode: props.mode, reduced })
    if (disposed) { scene.dispose(); scene = null; return }   // pagina al verlaten tijdens het compileren
  } catch (err) {
    console.warn('[RacketScene] WebGL niet beschikbaar, statische weergave', err)
    emit('fallback')
    return
  }

  ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    scene.resize(width, height)
    if (reduced) renderOnce()
  })
  ro.observe(host.value)

  io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting })
  io.observe(host.value)

  scene.setProgress(pendingProgress)

  if (reduced) {
    renderOnce()
  } else {
    raf = requestAnimationFrame(frame)
    if (props.interactive && hasFinePointer()) window.addEventListener('pointermove', onPointer, { passive: true })
  }
  requestAnimationFrame(() => { shown.value = true })
  emit('ready')
})

// Scrollvoortgang gaat rechtstreeks naar de scène (geen Vue-reactiviteit = geen herrender per scrollstap)
function setProgress(v) {
  pendingProgress = v
  if (!scene) return
  scene.setProgress(v)
  if (reduced) renderOnce()
}
defineExpose({ setProgress })

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  window.removeEventListener('pointermove', onPointer)
  ro?.disconnect()
  io?.disconnect()
  scene?.dispose()
  scene = null
})
</script>

<template>
  <div ref="host" class="absolute inset-0" aria-hidden="true">
    <canvas ref="canvas" class="block h-full w-full transition-opacity duration-[1200ms] ease-out-expo" :class="shown ? 'opacity-100' : 'opacity-0'"></canvas>
  </div>
</template>
