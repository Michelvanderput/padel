import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin)

const rmQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
const fineQuery = typeof matchMedia === 'function' ? matchMedia('(hover: hover) and (pointer: fine)') : null

export const prefersReducedMotion = () => !!rmQuery?.matches
export const hasFinePointer = () => !!fineQuery?.matches

export const EASE = 'expo.out'

export { gsap, ScrollTrigger, SplitText, Flip, DrawSVGPlugin }
