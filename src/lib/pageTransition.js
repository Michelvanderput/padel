import { nextTick } from 'vue'
import { START_LOCATION } from 'vue-router'
import { gsap, prefersReducedMotion } from '@/lib/motion'
import { scrollToTop } from '@/composables/useSmoothScroll'

/**
 * Limoenen gordijn tussen pagina's, gekoppeld aan de router:
 * beforeEach schuift het gordijn omhoog (en dekt daarmee ook het laden van lazy
 * chunks), afterEach trekt het weg zodra de nieuwe pagina staat.
 * De eerste navigatie (app-start) krijgt geen gordijn — daar is de preloader voor.
 */
export function installPageTransition(router, curtain) {
  let covering = null
  gsap.set(curtain, { yPercent: 100, autoAlpha: 1 })   // autoAlpha haalt de start-'invisible' weg

  const cover = () => new Promise(resolve => {
    gsap.killTweensOf(curtain)
    covering = gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'expo.inOut', onComplete: resolve })
  })

  const uncover = () => {
    gsap.killTweensOf(curtain)
    gsap.to(curtain, {
      yPercent: -100, duration: 0.7, ease: 'expo.inOut', delay: 0.05,
      onComplete: () => gsap.set(curtain, { yPercent: 100 }),
    })
  }

  const offBefore = router.beforeEach(async (to, from) => {
    if (from === START_LOCATION || prefersReducedMotion() || to.path === from.path) return true
    await cover()
    return true
  })

  const offAfter = router.afterEach(async (to, from, failure) => {
    if (from === START_LOCATION) return
    if (prefersReducedMotion()) { scrollToTop(); return }
    if (!covering) return
    await nextTick()
    requestAnimationFrame(() => {
      if (!failure) scrollToTop()
      covering = null
      uncover()
    })
  })

  return () => { offBefore(); offAfter() }
}
