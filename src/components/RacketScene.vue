<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { prefersReducedMotion, hasFinePointer } from '@/lib/motion'

const props = defineProps({
  mode:        { type: String,  default: 'hero' },   // 'hero' | 'showcase'
  progress:    { type: Number,  default: 0 },        // 0..1, door de pagina gestuurd
  interactive: { type: Boolean, default: true },     // rackets volgen de muis
})
const emit = defineEmits(['ready', 'fallback'])

const host   = ref(null)
const canvas = ref(null)

let scene = null
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
    // Three.js (±180 kB gzip) pas laden als de pagina al staat.
    const { createRacketScene } = await import('@/lib/racket3d')
    if (disposed) return
    scene = createRacketScene(canvas.value, { mode: props.mode, reduced })
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

  scene.setProgress(props.progress)

  if (reduced) {
    renderOnce()
  } else {
    raf = requestAnimationFrame(frame)
    if (props.interactive && hasFinePointer()) window.addEventListener('pointermove', onPointer, { passive: true })
  }
  emit('ready')
})

watch(() => props.progress, v => {
  if (!scene) return
  scene.setProgress(v)
  if (reduced) renderOnce()
})

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
    <canvas ref="canvas" class="block h-full w-full"></canvas>
  </div>
</template>
