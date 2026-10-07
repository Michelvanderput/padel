import Lenis from 'lenis'
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion'

// Eén Lenis voor de hele app; ScrollTrigger leest dezelfde scrollpositie.
let lenis = null
let tick = null

export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return lenis

  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  tick = time => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  return lenis
}

export function stopSmoothScroll() {
  if (!lenis) return
  gsap.ticker.remove(tick)
  lenis.destroy()
  lenis = null
  tick = null
}

export const getLenis = () => lenis

export function scrollToTop(immediate = true) {
  if (lenis) lenis.scrollTo(0, { immediate })
  else window.scrollTo(0, 0)
}
