import { gsap, prefersReducedMotion, hasFinePointer } from '@/lib/motion'

// v-tilt="6" — 3D-tilt (max graden) plus een spotlight die de muis volgt (.spotlight).
export default {
  mounted(el, { value }) {
    if (prefersReducedMotion() || !hasFinePointer()) return
    const max = typeof value === 'number' ? value : 6
    el.style.transformStyle = 'preserve-3d'
    el.style.willChange = 'transform'
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' })

    const move = e => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      ry((px - 0.5) * max * 2)
      rx((0.5 - py) * max * 2)
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
    }
    const leave = () => { rx(0); ry(0) }

    gsap.set(el, { transformPerspective: 900 })
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    el._tilt = { move, leave }
  },
  beforeUnmount(el) {
    if (!el._tilt) return
    el.removeEventListener('pointermove', el._tilt.move)
    el.removeEventListener('pointerleave', el._tilt.leave)
    gsap.killTweensOf(el)
  },
}
