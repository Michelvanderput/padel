<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, SplitText } from '@/lib/motion'
import CourtLines from '@/components/CourtLines.vue'

const emit = defineEmits(['reveal', 'done'])   // reveal: pagina mag beginnen met animeren

const root    = ref(null)
const content = ref(null)
const top     = ref(null)
const bottom  = ref(null)
const court   = ref(null)
const counter = ref(null)
const bar     = ref(null)
const ball    = ref(null)
const shadow  = ref(null)
const ring    = ref(null)

let tl = null
let split = null
let failsafe = null

// Het font moet er zijn vóór we de tekst splitsen, anders klopt de breedte niet en
// springt de tekst. Maximaal 700 ms wachten.
const fontsReady = () => Promise.race([
  Promise.all([
    document.fonts.load('800 64px "Bricolage Grotesque Variable"'),
    document.fonts.load('12px "Geist Mono Variable"'),
  ]),
  new Promise(r => setTimeout(r, 700)),
]).catch(() => {})

onMounted(async () => {
  await fontsReady()
  if (!root.value) return

  const lines = court.value.querySelectorAll('.court-line')
  split = SplitText.create('[data-pre-word]', { type: 'chars', mask: 'chars', charsClass: 'pre-char' })

  const num = { v: 0 }
  // De bal stuitert in 3 hoppen van de achterlijn naar het net; shadow en schaal lopen mee.
  const path = { t: 0 }
  const placeBall = () => {
    const t = path.t
    const y = 192 - 92 * t                                   // 192 → 100 (het net)
    const hop = Math.abs(Math.sin(t * Math.PI * 3)) * 34 * (1 - t * 0.55)
    const x = 50 + Math.sin(t * Math.PI * 2) * 6
    gsap.set(ball.value, { x, y: y - hop, rotation: t * 540, transformOrigin: '50% 50%' })
    gsap.set(shadow.value, { x, y: y + 3, scaleX: 1 - (hop / 34) * 0.45, opacity: (0.55 - (hop / 34) * 0.35) * gsap.getProperty(ball.value, 'autoAlpha') })
  }
  gsap.set(ball.value, { autoAlpha: 0 })   // bal en schaduw pas zichtbaar als de bal begint
  placeBall()

  tl = gsap.timeline({ onComplete: () => emit('done') })

  tl.set(content.value, { autoAlpha: 1 })
    // 1. baan tekent zich, tekst komt per letter binnen
    .from(lines, { drawSVG: '0%', duration: 0.95, ease: 'power2.inOut', stagger: 0.1 }, 0)
    .from(split.chars, { yPercent: 115, duration: 0.8, ease: 'expo.out', stagger: 0.035 }, 0.1)
    .from('[data-pre-meta]', { autoAlpha: 0, y: 8, duration: 0.6, stagger: 0.1, ease: 'power2.out' }, 0.3)
    // 2. bal stuitert naar het net terwijl de teller oploopt
    .to(ball.value, { autoAlpha: 1, duration: 0.15 }, 0.45)
    .to(path, { t: 1, duration: 1.45, ease: 'power1.inOut', onUpdate: placeBall }, 0.45)
    .to(num, {
      v: 100, duration: 1.45, ease: 'power1.inOut',
      onUpdate: () => { counter.value.textContent = String(Math.round(num.v)).padStart(3, '0') },
    }, 0.45)
    .fromTo(bar.value, { scaleX: 0 }, { scaleX: 1, duration: 1.45, ease: 'power1.inOut' }, 0.45)
    // 3. de bal raakt het net: ring-puls
    .fromTo(ring.value, { attr: { r: 7 }, autoAlpha: 0.9 }, { attr: { r: 30 }, autoAlpha: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, 1.85)
    .to(ball.value, { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, transformOrigin: '50% 50%' }, 1.85)
    // 4. tekst weg, scherm klapt open langs het net
    .to(split.chars, { yPercent: -115, duration: 0.5, ease: 'expo.in', stagger: 0.02 }, 1.8)
    .to(content.value, { autoAlpha: 0, scale: 1.04, duration: 0.45, ease: 'power2.in' }, 1.95)
    .to(top.value, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 2.05)
    .to(bottom.value, { yPercent: 100, duration: 0.9, ease: 'expo.inOut' }, 2.05)
    .call(() => emit('reveal'), null, 2.55)
    .set(root.value, { autoAlpha: 0 })

  // Vangnet: op een traag apparaat nooit langer dan 5 s blokkeren.
  failsafe = setTimeout(() => tl?.progress(1), 5000)
})

onBeforeUnmount(() => {
  clearTimeout(failsafe)
  tl?.kill()
  split?.revert()
})
</script>

<template>
  <div ref="root" class="fixed inset-0 z-[100]" role="status" aria-label="Padel Maatjes wordt geladen">
    <!-- twee helften die bij het net openklappen -->
    <div ref="top" class="absolute inset-x-0 top-0 h-1/2 bg-ink"></div>
    <div ref="bottom" class="absolute inset-x-0 bottom-0 h-1/2 bg-ink"></div>

    <div ref="content" class="invisible absolute inset-0 flex flex-col items-center justify-center">
      <div ref="court" class="absolute inset-0 flex items-center justify-center text-lime/60">
        <CourtLines class="h-[82vh] max-h-[780px]" :stroke-width="1.1">
          <ellipse ref="shadow" cx="0" cy="0" rx="7" ry="2.2" fill="#cdff2e" opacity="0" />
          <circle ref="ring" cx="50" cy="100" r="7" fill="none" stroke="#cdff2e" stroke-width="1" class="invisible" />
          <g ref="ball" class="invisible">
            <circle cx="0" cy="0" r="6.5" fill="#d9ee2c" />
            <path d="M-5.200 -3.600c3.200 1.600 3.200 5.600 0 7.200M5.200 -3.600c-3.200 1.600-3.200 5.600 0 7.200" fill="none" stroke="#f5f7ee" stroke-width="0.9" stroke-linecap="round" />
          </g>
        </CourtLines>
      </div>

      <div class="relative -translate-y-[21vh] flex flex-col items-center gap-1 text-center">
        <div class="overflow-hidden px-2 pt-2"><p data-pre-word class="display text-[clamp(2.8rem,9vw,6.5rem)] text-fog">Padel</p></div>
        <div class="overflow-hidden px-2"><p data-pre-word class="display text-[clamp(2.8rem,9vw,6.5rem)] text-lime">Maatjes</p></div>
      </div>

      <p data-pre-meta class="eyebrow absolute bottom-8 left-8">Ready Maastricht</p>
      <p ref="counter" data-pre-meta class="absolute bottom-8 right-8 font-mono text-sm tracking-[0.2em] text-mist tabular">000</p>
      <div class="absolute inset-x-0 bottom-0 h-[3px] bg-white/10"><div ref="bar" class="h-full origin-left bg-lime" style="transform: scaleX(0)"></div></div>
    </div>
  </div>
</template>
