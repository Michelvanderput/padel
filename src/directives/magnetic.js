import { gsap, prefersReducedMotion, hasFinePointer } from '@/lib/motion'

// v-magnetic="0.35" — element trekt zacht richting de cursor.
export default {
  mounted(el, { value }) {
    if (prefersReducedMotion() || !hasFinePointer()) return
    const strength = typeof value === 'number' ? value : 0.3
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' })

    const move = e => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => { xTo(0); yTo(0) }

    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el._magnetic = { move, leave }
  },
  beforeUnmount(el) {
    if (!el._magnetic) return
    el.removeEventListener('pointermove', el._magnetic.move)
    el.removeEventListener('pointerleave', el._magnetic.leave)
    gsap.killTweensOf(el)
  },
}
