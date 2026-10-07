import { onMounted, onBeforeUnmount } from 'vue'
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion, EASE } from '@/lib/motion'
import { introReady } from '@/lib/intro'

/**
 * Standaard pagina-animaties op basis van data-attributen in de template:
 *
 *   data-split              kop: per regel omhoog uit een masker (SplitText)
 *   data-reveal             element: fade + omhoog; onder de vouw pas bij scrollen
 *   data-reveal-group       kinderen met data-reveal krijgen een stagger
 *   data-count="12"         telt op naar 12 zodra de pagina klaar is
 *
 * Zonder JS of met prefers-reduced-motion blijft alles gewoon zichtbaar —
 * begintoestanden worden pas door GSAP gezet.
 */
export function useReveal(rootRef, { delay = 0.1 } = {}) {
  let ctx = null
  const splits = []

  onMounted(async () => {
    const root = rootRef.value
    if (!root || prefersReducedMotion()) return

    const start = []   // afspeelfuncties; lopen pas na preloader + fonts

    ctx = gsap.context(() => {
      // Koppen blijven onzichtbaar tot ze gesplitst zijn (voorkomt een flits).
      gsap.set(root.querySelectorAll('[data-split]'), { autoAlpha: 0 })

      root.querySelectorAll('[data-count]').forEach(el => {
        const target = Number(el.dataset.count)
        if (!Number.isFinite(target)) return
        el.textContent = '0'
        start.push(() => {
          const state = { v: 0 }
          gsap.to(state, {
            v: target, duration: 1.4, ease: 'power3.out', delay: delay + 0.2,
            onUpdate: () => { el.textContent = Math.round(state.v) },
            onComplete: () => { el.textContent = target },
          })
        })
      })

      root.querySelectorAll('[data-reveal]').forEach(el => {
        if (el.closest('[data-reveal-group]')) return
        const inView = el.getBoundingClientRect().top < window.innerHeight * 0.92
        gsap.set(el, { autoAlpha: 0, y: 32 })
        start.push(() => {
          if (inView) {
            gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, delay: delay + 0.1 })
          } else {
            ScrollTrigger.create({
              trigger: el, start: 'top 90%', once: true,
              onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: EASE }),
            })
          }
        })
      })

      root.querySelectorAll('[data-reveal-group]').forEach(group => {
        const items = group.querySelectorAll('[data-reveal]')
        if (!items.length) return
        gsap.set(items, { autoAlpha: 0, y: 36 })
        start.push(() => {
          const play = () => gsap.to(items, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, stagger: 0.07 })
          if (group.getBoundingClientRect().top < window.innerHeight * 0.9) gsap.delayedCall(delay + 0.1, play)
          else ScrollTrigger.create({ trigger: group, start: 'top 90%', once: true, onEnter: play })
        })
      })
    }, root)

    // Wacht op de preloader; koppen pas splitsen als het font er is.
    try { await Promise.all([introReady, document.fonts.ready]) } catch (_) {}
    if (!root.isConnected || !ctx) return

    ctx.add(() => {
      start.forEach(fn => fn())
      root.querySelectorAll('[data-split]').forEach(el => {
        const split = SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit: self => {
            gsap.set(el, { autoAlpha: 1 })
            return gsap.from(self.lines, {
              yPercent: 110, duration: 1.15, ease: EASE, stagger: 0.09, delay,
            })
          },
        })
        splits.push(split)
      })
    })
  })

  onBeforeUnmount(() => {
    splits.forEach(s => s.revert())
    ctx?.revert()
    ctx = null
  })
}
