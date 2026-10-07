import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/* ────────────────────────────────────────────────────────────
 * Procedureel padelracket + bal. Geen modelbestanden: alles wordt
 * uit Shapes, extrudes en canvas-textures opgebouwd, zodat er niets
 * extra hoeft te downloaden. 1 eenheid ≈ 100 mm.
 * ──────────────────────────────────────────────────────────── */

const W = 1.38         // halve breedte van de kop
const H = 1.35         // halve hoogte van de kop
const THROAT = 0.62    // lengte hals
const HANDLE = 1.0    // lengte handvat

export const VARIANTS = {
  lime: { frame: '#cdff2e', frameRough: 0.28, frameMetal: 0.1, inlay: '#0a0f0c', grip: '#161b18', band: '#cdff2e' },
  clay: { frame: '#14110f', frameRough: 0.45, frameMetal: 0.3, inlay: '#ff6a3d', grip: '#1a1511', band: '#ff6a3d' },
  ice:  { frame: '#eef3ec', frameRough: 0.22, frameMetal: 0.05, inlay: '#0a0f0c', grip: '#e3e9e1', band: '#0a0f0c' },
}

/* ── Texturen ────────────────────────────────────────────── */

function canvasTexture(size, draw, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Carbon-twill: wisselende diagonale glans per blokje.
function carbonTexture() {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#080b09'
    g.fillRect(0, 0, s, s)
    const cell = 8
    for (let y = 0; y < s / cell; y++) {
      for (let x = 0; x < s / cell; x++) {
        const flip = (x + y) % 2 === 0
        const x0 = x * cell, y0 = y * cell
        const grad = flip
          ? g.createLinearGradient(x0, y0, x0 + cell, y0 + cell)
          : g.createLinearGradient(x0 + cell, y0, x0, y0 + cell)
        grad.addColorStop(0, '#242b26')
        grad.addColorStop(0.5, '#0b0f0c')
        grad.addColorStop(1, '#1c231e')
        g.fillStyle = grad
        g.fillRect(x0, y0, cell, cell)
      }
    }
  }, { repeat: 1.6 })
}

function gripTexture(base, line) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    g.strokeStyle = line
    g.globalAlpha = 0.55
    g.lineWidth = 3
    for (let i = -s; i < s * 2; i += 16) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + s, s)
      g.stroke()
    }
  }, { repeat: 1 })
}

function feltBump() {
  return canvasTexture(256, (g, s) => {
    const img = g.createImageData(s, s)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 90 + Math.random() * 120
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, { repeat: 3, srgb: false })
}

/* ── Vormen ──────────────────────────────────────────────── */

// Afgeronde druppelvorm: breed boven, smaller richting de hals.
function headOutline(scale = 1, n = 120) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const cy = Math.cos(t), sx = Math.sin(t)
    const taper = 0.8 + 0.2 * Math.pow(cy * 0.5 + 0.5, 0.85)
    const x = W * Math.sign(sx) * Math.pow(Math.abs(sx), 0.9) * taper
    const y = H * Math.sign(cy) * Math.pow(Math.abs(cy), 0.95)
    pts.push(new THREE.Vector2(x * scale, y * scale))
  }
  return pts
}

function insidePolygon(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

// Perforaties in een zeshoekig raster, groter in het midden (sweet spot).
function addPerforations(shape, inner) {
  const dx = 0.2, dy = 0.173
  for (let j = -7; j <= 7; j++) {
    for (let i = -7; i <= 7; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * dx
      const y = j * dy + 0.12
      const nx = x / (W * 0.74), ny = (y - 0.1) / (H * 0.8)
      const d = nx * nx + ny * ny
      if (d > 1) continue
      if (!insidePolygon(new THREE.Vector2(x, y), inner)) continue
      const r = 0.06 - d * 0.02
      const hole = new THREE.Path()
      hole.absarc(x, y, r, 0, Math.PI * 2, true)
      shape.holes.push(hole)
    }
  }
}

function ringShape(outerScale, innerScale) {
  const s = new THREE.Shape(headOutline(outerScale))
  s.holes.push(new THREE.Path(headOutline(innerScale).reverse()))
  return s
}

function throatShape() {
  const top = -H + 0.15
  const bot = -H - THROAT
  const s = new THREE.Shape()
  s.moveTo(-0.58, top)
  s.quadraticCurveTo(-0.42, bot + 0.3, -0.18, bot)
  s.lineTo(0.18, bot)
  s.quadraticCurveTo(0.42, bot + 0.3, 0.58, top)
  s.lineTo(-0.58, top)
  const win = new THREE.Path()
  win.moveTo(0, top - 0.14)
  win.lineTo(-0.17, bot + 0.22)
  win.lineTo(0.17, bot + 0.22)
  win.lineTo(0, top - 0.14)
  s.holes.push(win)
  return s
}

/* ── Geometrie (één keer gebouwd, gedeeld door alle rackets) ─ */

export function buildRacketGeometries() {
  const innerRing = headOutline(0.86)

  const faceShape = new THREE.Shape(headOutline(0.95))
  addPerforations(faceShape, innerRing)

  // Een padelracket is één vlakke plaat (±38 mm): de gekleurde rand ligt gelijk met het
  // vlak, geen opstaande buis zoals bij tennis.
  const T = 0.38
  const face = new THREE.ExtrudeGeometry(faceShape, { depth: T, bevelEnabled: false, curveSegments: 14 })
  face.translate(0, 0, -T / 2)

  const frame = new THREE.ExtrudeGeometry(ringShape(1, 0.9), {
    depth: T - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 4, curveSegments: 24,
  })
  frame.translate(0, 0, -(T - 0.08) / 2)

  // dunne accentlijn op de rand, óók gelijk met het vlak
  const inlay = new THREE.ExtrudeGeometry(ringShape(0.9, 0.885), { depth: T + 0.004, bevelEnabled: false, curveSegments: 24 })
  inlay.translate(0, 0, -(T + 0.004) / 2)

  const throat = new THREE.ExtrudeGeometry(throatShape(), { depth: T - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 16 })
  throat.translate(0, 0, -(T - 0.1) / 2)

  const handleTop = -H - THROAT
  const handle = new THREE.CylinderGeometry(0.215, 0.2, HANDLE, 8, 1)
  handle.translate(0, handleTop - HANDLE / 2 + 0.02, 0)
  handle.scale(1, 1, 0.74)

  const band = new THREE.CylinderGeometry(0.205, 0.205, 0.07, 8)
  band.scale(1, 1, 0.76)

  const pommel = new THREE.CylinderGeometry(0.215, 0.2, 0.11, 8)
  pommel.scale(1, 1, 0.78)
  pommel.translate(0, handleTop - HANDLE - 0.03, 0)

  const lanyard = new THREE.TorusGeometry(0.1, 0.014, 10, 40)

  return { face, frame, inlay, throat, handle, band, pommel, lanyard, handleTop }
}

export function buildMaterials(variantKey) {
  const v = VARIANTS[variantKey] ?? VARIANTS.lime
  const carbon = carbonTexture()
  const carbonFrame = variantKey === 'clay' ? carbon : null
  return {
    face: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, map: carbon, bumpMap: carbon, bumpScale: 0.6,
      roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12,
    }),
    frame: new THREE.MeshPhysicalMaterial({
      color: v.frame, map: carbonFrame, roughness: v.frameRough, metalness: v.frameMetal,
      clearcoat: 1, clearcoatRoughness: 0.18,
    }),
    inlay: new THREE.MeshStandardMaterial({ color: v.inlay, roughness: 0.4, metalness: 0.2 }),
    grip: new THREE.MeshStandardMaterial({ color: 0xffffff, map: gripTexture(v.grip, variantKey === 'ice' ? '#bcc6bd' : '#2b332e'), roughness: 0.85, metalness: 0 }),
    band: new THREE.MeshStandardMaterial({ color: v.band, roughness: 0.35, metalness: 0.15 }),
  }
}

export function makeRacket(geo, mats) {
  const g = new THREE.Group()
  const add = (geometry, material, z = 0) => {
    const m = new THREE.Mesh(geometry, material)
    m.position.z = z
    g.add(m)
    return m
  }
  add(geo.face, mats.face)
  add(geo.frame, mats.frame)
  add(geo.inlay, mats.inlay)
  add(geo.throat, mats.frame)
  add(geo.handle, mats.grip)
  add(geo.pommel, mats.frame)

  const top = add(geo.band, mats.band)
  top.position.y = geo.handleTop - 0.02
  const lan = add(geo.lanyard, mats.band)
  lan.position.set(0.05, geo.handleTop - HANDLE - 0.12, 0)
  lan.rotation.y = Math.PI / 2.4

  // Pivot ongeveer in het zwaartepunt: kop + hals.
  const wrap = new THREE.Group()
  g.position.y = 1.0
  wrap.add(g)
  return wrap
}

/* ── Bal ─────────────────────────────────────────────────── */

function seamCurve(r) {
  const a = 1, b = 0.4, c = 2 * Math.sqrt(a * b)
  const pts = []
  for (let i = 0; i < 220; i++) {
    const t = (i / 220) * Math.PI * 2
    pts.push(new THREE.Vector3(
      a * Math.cos(t) + b * Math.cos(3 * t),
      a * Math.sin(t) - b * Math.sin(3 * t),
      c * Math.sin(2 * t),
    ).normalize().multiplyScalar(r * 1.004))
  }
  return new THREE.CatmullRomCurve3(pts, true)
}

export function makeBall(r = 0.34, bump) {
  const g = new THREE.Group()
  const felt = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#d9ee2c', roughness: 0.9, bumpMap: bump, bumpScale: 1.4 }),
  )
  const seam = new THREE.Mesh(
    new THREE.TubeGeometry(seamCurve(r), 180, r * 0.035, 8, true),
    new THREE.MeshStandardMaterial({ color: '#f5f7ee', roughness: 0.8 }),
  )
  g.add(felt, seam)
  return g
}

/* ── Scène ───────────────────────────────────────────────── */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t

/**
 * mode 'hero'     — drie rackets + ballen die zweven, volgt de muis
 * mode 'showcase' — één racket dat met de scrollvoortgang draait
 */
export async function createRacketScene(canvas, { mode = 'hero', reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping   // behoudt de lime i.p.v. hem uit te bleken
  renderer.toneMappingExposure = 0.95
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  scene.environmentIntensity = 0.5

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60)
  camera.position.set(0, 0, 15)

  // Licht: warme key + gekleurde rim-lichten voor de randen van het carbon.
  scene.add(new THREE.HemisphereLight(0xdfe9dc, 0x0a0f0c, 0.5))
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(4, 6, 9)
  scene.add(key)
  const rimLime = new THREE.PointLight(0xcdff2e, 90, 30, 1.6)
  rimLime.position.set(-7, 3, -4)
  scene.add(rimLime)
  const rimClay = new THREE.PointLight(0xff6a3d, 70, 30, 1.6)
  rimClay.position.set(7, -4, -3)
  scene.add(rimClay)

  const geo = buildRacketGeometries()
  const matSets = ['lime', 'clay', 'ice'].map(buildMaterials)
  const bump = feltBump()
  const root = new THREE.Group()
  scene.add(root)

  const rackets = []
  const balls = []

  function addRacket(i, cfg) {
    const r = makeRacket(geo, matSets[i])
    r.userData = { ...cfg, phase: Math.random() * 6.28 }
    r.scale.setScalar(cfg.scale)
    root.add(r)
    rackets.push(r)
    return r
  }
  function addBall(cfg) {
    const b = makeBall(cfg.r, bump)
    b.userData = { ...cfg, phase: Math.random() * 6.28 }
    root.add(b)
    balls.push(b)
    return b
  }

  if (mode === 'hero') {
    addRacket(0, { scale: 1.3, depth: 1.0, spin: 0.55 })   // lime, voorgrond
    addRacket(1, { scale: 0.95, depth: 0.6, spin: 0.7 })   // clay, achter
    addRacket(2, { scale: 0.75, depth: 0.35, spin: 0.9 })  // ice, ver weg
    addBall({ r: 0.42, depth: 1.2, orbit: 0 })
    addBall({ r: 0.3, depth: 0.7, orbit: 1 })
    addBall({ r: 0.24, depth: 0.4, orbit: 2 })
  } else {
    addRacket(0, { scale: 1.3, depth: 1, spin: 0 })
    addBall({ r: 0.32, depth: 1, orbit: 0 })
  }

  const state = { w: 1, h: 1, aspect: 1, progress: 0, px: 0, py: 0, tx: 0, ty: 0, time: 0 }

  function layout() {
    const wide = state.aspect >= 1.25   // anders 'compact': (bijna) vierkant vak, bv. de mobiele hero
    if (mode === 'hero') {
      const [lime, clay, ice] = rackets
      if (wide) {
        lime.userData.base = new THREE.Vector3(3.5, -0.2, 0.5);  lime.userData.rotZ = -0.5
        clay.userData.base = new THREE.Vector3(-0.6, 1.1, -3.5); clay.userData.rotZ = 0.55
        ice.userData.base  = new THREE.Vector3(2.2, 3.3, -6.5);  ice.userData.rotZ = 0.9
        lime.scale.setScalar(1.3); clay.scale.setScalar(0.95); ice.scale.setScalar(0.75)
      } else {
        lime.userData.base = new THREE.Vector3(1.3, -0.2, 0.5);  lime.userData.rotZ = -0.45
        clay.userData.base = new THREE.Vector3(-2.0, 0.6, -3.5); clay.userData.rotZ = 0.55
        ice.userData.base  = new THREE.Vector3(3.8, 2.9, -6);    ice.userData.rotZ = 0.8
        lime.scale.setScalar(1.12); clay.scale.setScalar(0.82); ice.scale.setScalar(0.62)
      }
      const ballPos = wide
        ? [[0.4, -2.3, 2.6], [-2.8, 3.3, -1], [6.9, 3.6, -2]]
        : [[-0.4, -2.3, 2.6], [0.3, 3.1, -1], [-3.4, -0.8, -2]]
      balls.forEach((b, i) => { b.userData.base = new THREE.Vector3(...ballPos[i]) })
    } else {
      rackets[0].userData.base = new THREE.Vector3(0, 0, 0)
      rackets[0].userData.rotZ = -0.2
      rackets[0].scale.setScalar(wide ? 1.3 : 1.05)
      balls[0].userData.base = new THREE.Vector3(0, 0, 0)
    }
  }

  function resize(w, h) {
    state.w = Math.max(1, w); state.h = Math.max(1, h)
    state.aspect = state.w / state.h
    renderer.setSize(state.w, state.h, false)
    camera.aspect = state.aspect
    camera.updateProjectionMatrix()
    layout()
  }

  function update(dt) {
    state.time += dt
    const t = state.time
    const p = state.progress
    const k = reduced ? 0 : 1

    // Pointer-parallax, gedempt
    state.px = lerp(state.px, state.tx, 1 - Math.pow(0.001, dt))
    state.py = lerp(state.py, state.ty, 1 - Math.pow(0.001, dt))

    if (mode === 'hero') {
      root.position.y = p * 3.4
      root.rotation.z = p * 0.35
      root.scale.setScalar(1 - p * 0.18)

      rackets.forEach(r => {
        const u = r.userData
        const bob = Math.sin(t * 0.9 * u.spin + u.phase) * 0.22 * k
        r.position.set(
          u.base.x + state.px * 0.9 * u.depth,
          u.base.y + bob + state.py * 0.6 * u.depth,
          u.base.z,
        )
        r.rotation.z = u.rotZ + Math.sin(t * 0.5 * u.spin + u.phase) * 0.08 * k + state.px * 0.12
        r.rotation.y = Math.sin(t * 0.45 * u.spin + u.phase) * 0.7 * k + state.px * 0.5 * u.depth + p * 1.2
        r.rotation.x = Math.sin(t * 0.35 + u.phase) * 0.1 * k - state.py * 0.35 * u.depth
      })
      balls.forEach(b => {
        const u = b.userData
        const hop = Math.abs(Math.sin(t * 1.1 + u.phase)) * 0.55 * k
        b.position.set(
          u.base.x + Math.cos(t * 0.4 + u.phase) * 0.35 * k + state.px * 1.4 * u.depth,
          u.base.y + hop + state.py * 0.9 * u.depth,
          u.base.z,
        )
        b.rotation.x = t * 0.9 * k
        b.rotation.y = t * 0.6 * k
      })
    } else {
      const r = rackets[0], u = r.userData
      r.position.set(state.px * 0.4, Math.sin(t * 0.9) * 0.12 * k, 0)
      r.rotation.y = p * Math.PI * 2 + state.px * 0.3
      r.rotation.z = lerp(u.rotZ, 0.28, p)
      r.rotation.x = Math.sin(p * Math.PI) * 0.35 - state.py * 0.2

      const b = balls[0]
      const ang = p * Math.PI * 2 * 2 + t * 0.4 * k
      b.position.set(Math.cos(ang) * 2.6, Math.sin(ang * 0.7) * 1.4, Math.sin(ang) * 2.6)
      b.rotation.x = t * 1.2 * k
    }
  }

  layout()

  // Shaders parallel compileren (KHR_parallel_shader_compile) i.p.v. de hoofdthread te blokkeren
  try { await renderer.compileAsync(scene, camera) } catch (_) { /* valt terug op compileren bij het eerste frame */ }

  function render() { renderer.render(scene, camera) }

  function dispose() {
    const geos = new Set(), mats = new Set(), texs = new Set()
    root.traverse(o => {
      if (!o.isMesh) return
      geos.add(o.geometry)
      mats.add(o.material)
    })
    geos.forEach(g => g.dispose())
    mats.forEach(m => {
      if (m.map) texs.add(m.map)
      if (m.bumpMap) texs.add(m.bumpMap)
      m.dispose()
    })
    texs.forEach(t => t.dispose())
    envTex.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }

  return {
    resize, update, render, dispose,
    setProgress: v => { state.progress = clamp(v, 0, 1) },
    setPointer: (x, y) => { state.tx = clamp(x, -1, 1); state.ty = clamp(y, -1, 1) },
  }
}
