/**
 * Three.js 立体预览（单独打包，按需加载）。
 * 负责把 buildShape() 的结果渲染为逼真毛线质感的立体织片：
 * 织片底面阴影曲面 + 细毛线管短针（正面 V 字 + 顶链 + 钩入上一圈的立柱），
 * 新钩的针有弹出动画；拖动旋转、滚轮 / 双指缩放。
 */
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildShape, type Shape } from '../lib/shape3d'
import { colorAt, type ColorChange } from '../lib/colors'
import type { StitchType } from '../types/stitch'
import { createStitchGeometry } from './stitchGeometry'

export interface SceneInput {
  rounds: StitchType[][]
  ringSize?: number
  base: string
  changes: ColorChange[]
}

const POP_MS = 320
const BG = 0xfdf3df

/**
 * 细腻的羊毛/棉线多股捻度与微毛羽贴图。
 * 用于 map 与 bumpMap，提供哑光触感与螺旋股线起伏。
 */
function yarnTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f6f6f6'
  g.fillRect(0, 0, 128, 128)

  // 股线螺旋捻度 (Twisted plies)
  const plyWidth = 16
  for (let x = -128; x < 256; x += plyWidth) {
    const grad = g.createLinearGradient(x, 0, x + plyWidth, 0)
    grad.addColorStop(0.0, 'rgba(15, 10, 5, 0.35)')
    grad.addColorStop(0.2, 'rgba(40, 30, 20, 0.05)')
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)')
    grad.addColorStop(0.8, 'rgba(40, 30, 20, 0.05)')
    grad.addColorStop(1.0, 'rgba(15, 10, 5, 0.35)')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + plyWidth, 0)
    g.lineTo(x + plyWidth + 64, 128)
    g.lineTo(x + 64, 128)
    g.closePath()
    g.fill()
  }

  // 细微毛羽噪点 (Woolly fiber fuzz micro-texture)
  g.fillStyle = 'rgba(0, 0, 0, 0.05)'
  for (let i = 0; i < 350; i++) {
    const rx = (i * 37) % 128
    const ry = (i * 91) % 128
    g.fillRect(rx, ry, 1, 1)
  }
  g.fillStyle = 'rgba(255, 255, 255, 0.12)'
  for (let i = 0; i < 250; i++) {
    const rx = (i * 53) % 128
    const ry = (i * 79) % 128
    g.fillRect(rx, ry, 1, 1)
  }

  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(4, 2)
  t.colorSpace = SRGBColorSpace
  return t
}

function shadowTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(120,72,20,0.35)')
  grad.addColorStop(0.6, 'rgba(120,72,20,0.12)')
  grad.addColorStop(1, 'rgba(120,72,20,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export class CrochetScene {
  readonly renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(35, 1, 0.1, 500)
  private controls: OrbitControls
  /** 逼真单针毛线管几何体（V 字 + 顶链 + 钩入立柱 + 背杠） */
  private stitchGeo = createStitchGeometry()
  private yarnTex = yarnTexture()
  private stitchMat: MeshStandardMaterial
  private surfaceMat: MeshStandardMaterial
  private stitchesMesh: InstancedMesh | null = null
  private surface: Mesh | null = null
  private shadow: Mesh
  /** 作品本体（平片翻过来让正面朝上） */
  private piece = new Group()
  private shape: Shape | null = null
  private input: SceneInput | null = null
  private births = new Map<string, number>()
  private known = new Set<string>()
  private first = true
  private userMoved = false
  private dirty = true
  private raf = 0
  private spinUntil = 0
  private resizeObs: ResizeObserver
  private tmp = new Matrix4()
  private tmpColor = new Color()
  stitchCount = 0

  constructor(
    private container: HTMLElement,
    private opts: { onContextLost?: () => void } = {},
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.96
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.setClearColor(BG)
    const el = this.renderer.domElement
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    el.style.touchAction = 'none'
    el.addEventListener('webglcontextlost', this.onLost)
    container.appendChild(el)

    this.scene.background = new Color(BG)
    this.scene.add(new HemisphereLight(0xfff6e5, 0x9a7650, 1.25))
    const key = new DirectionalLight(0xffe7c4, 2.4)
    key.position.set(6, 12, 8)
    this.scene.add(key)
    const rim = new DirectionalLight(0xc7dcff, 1.1)
    rim.position.set(-8, 4, -10)
    this.scene.add(rim)
    const fill = new DirectionalLight(0xffffff, 0.5)
    fill.position.set(0, -6, 4)
    this.scene.add(fill)

    this.stitchMat = new MeshStandardMaterial({
      map: this.yarnTex,
      bumpMap: this.yarnTex,
      bumpScale: 0.5,
      roughness: 0.92,
      metalness: 0,
    })
    this.surfaceMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: DoubleSide })

    this.shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }))
    this.shadow.rotation.x = -Math.PI / 2
    this.scene.add(this.shadow)
    this.scene.add(this.piece)

    this.controls = new OrbitControls(this.camera, el)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.8
    this.controls.addEventListener('start', () => {
      this.userMoved = true
      this.spinUntil = 0
      this.controls.autoRotate = false
    })
    this.controls.addEventListener('change', () => (this.dirty = true))

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()
    this.loop()
  }

  private onLost = (e: Event) => {
    e.preventDefault()
    this.opts.onContextLost?.()
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  /** 播放一段转盘展示（通关时） */
  spin(ms = 2600) {
    this.spinUntil = performance.now() + ms
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 8
  }

  update(input: SceneInput) {
    this.input = input
    const shape = buildShape(input.rounds, { ringSize: input.ringSize })
    this.shape = shape
    const now = performance.now()
    const ids = new Set(shape.stitches.map((s) => s.id))
    if (!this.first) for (const s of shape.stitches) if (!this.known.has(s.id)) this.births.set(s.id, now)
    for (const id of this.births.keys()) if (!ids.has(id)) this.births.delete(id)
    this.known = ids
    this.first = false
    this.stitchCount = shape.stitches.length
    this.ensureInstances(shape.stitches.length)
    this.buildSurface(shape, input)
    this.writeInstances(now)
    this.frame(shape)
    this.dirty = true
  }

  private ensureInstances(n: number) {
    const cap = this.stitchesMesh?.instanceMatrix.count ?? 0
    if (n <= cap && this.stitchesMesh) return
    const size = Math.max(64, 2 ** Math.ceil(Math.log2(n + 1)))
    if (this.stitchesMesh) {
      this.piece.remove(this.stitchesMesh)
      this.stitchesMesh.dispose()
    }
    this.stitchesMesh = new InstancedMesh(this.stitchGeo, this.stitchMat, size)
    this.stitchesMesh.frustumCulled = false
    this.stitchesMesh.count = 0
    this.piece.add(this.stitchesMesh)
  }

  private buildSurface(shape: Shape, input: SceneInput) {
    if (this.surface) {
      this.piece.remove(this.surface)
      this.surface.geometry.dispose()
      this.surface = null
    }
    const prof = shape.profile
    if (!prof.length) return
    // 曲面略缩到毛线圈下面，只填缝，不抢戏
    // 进行中的圈：曲面只长到已钩的比例（跟着螺旋一起长）
    const lastRound = input.rounds[input.rounds.length - 1]
    const made = shape.stitches.filter((st) => st.round === input.rounds.length - 1).length
    const fracDone = lastRound.length && prof.length ? Math.min(1, made / prof[prof.length - 1].count) : 1
    const pp = prof.map((p, i) => {
      if (i !== prof.length - 1 || fracDone >= 1) return p
      const q = i > 0 ? prof[i - 1] : { r: p.r * 0.3, y: p.y }
      return { ...p, r: q.r + (p.r - q.r) * fracDone, y: q.y + (p.y - q.y) * fracDone }
    })
    const pts = [new Vector2(0.001, prof[0].y + 0.02), ...pp.map((p) => new Vector2(Math.max(0.001, p.r - 0.02), p.y))]
    const last = prof[prof.length - 1]
    // 收口的立体件（最后一圈很小）把顶端封上
    if (prof.length > 2 && last.r < shape.maxRadius * 0.4) pts.push(new Vector2(0.001, last.y + last.r * 0.12))
    const seg = 48
    const geo = new LatheGeometry(pts, seg)
    // 每圈的颜色 = 该圈第一针的颜色（加深，当作针目之间的阴影）
    const roundSeq: number[] = []
    let seq = 0
    input.rounds.forEach((r) => {
      if (r.length) roundSeq.push(seq)
      seq += r.length
    })
    const colors = new Float32Array(geo.attributes.position.count * 3)
    const per = pts.length
    for (let i = 0; i <= seg; i++) {
      for (let j = 0; j < per; j++) {
        const rk = Math.max(0, j - 1)
        this.tmpColor.set(colorAt(roundSeq[Math.min(rk, roundSeq.length - 1)] ?? 0, input.base, input.changes)).multiplyScalar(0.25)
        const o = (i * per + j) * 3
        colors[o] = this.tmpColor.r
        colors[o + 1] = this.tmpColor.g
        colors[o + 2] = this.tmpColor.b
      }
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3))
    this.surface = new Mesh(geo, this.surfaceMat)
    this.piece.add(this.surface)
  }

  private writeInstances(now: number): boolean {
    const shape = this.shape
    const input = this.input
    if (!shape || !input || !this.stitchesMesh) return false
    let animating = false
    const x = new Vector3()
    const y = new Vector3()
    const z = new Vector3()
    shape.stitches.forEach((s, i) => {
      let k = 1
      const b = this.births.get(s.id)
      if (b !== undefined) {
        const t = (now - b) / POP_MS
        if (t >= 1) this.births.delete(s.id)
        else {
          k = Math.max(0.01, easeOutBack(Math.max(0, t)))
          animating = true
        }
      }
      x.set(...s.tangent)
      y.set(...s.up)
      z.set(...s.normal)

      const lift = 0.05 + (1 - Math.min(k, 1)) * 0.4
      const px = s.position[0] + s.normal[0] * lift
      const py = s.position[1] + s.normal[1] * lift
      const pz = s.position[2] + s.normal[2] * lift
      const w = s.width
      this.tmpColor.set(colorAt(s.seq, input.base, input.changes))
      if (b !== undefined && k < 1.05) this.tmpColor.lerp(new Color(0xffffff), Math.max(0, 0.45 * (1 - k)))

      // 针目宽度自适应缩放（微调比例，使毛线管既覆盖圈间距又不被过度拉伸）
      const sx = k * Math.min(1.25, Math.max(0.75, 0.65 + w * 0.35))
      const sy = k
      const sz = k
      this.tmp.makeBasis(
        x.clone().multiplyScalar(sx),
        y.clone().multiplyScalar(sy),
        z.clone().multiplyScalar(sz)
      )
      this.tmp.setPosition(px, py, pz)
      this.stitchesMesh!.setMatrixAt(i, this.tmp)
      this.stitchesMesh!.setColorAt(i, this.tmpColor)
    })
    this.stitchesMesh.count = shape.stitches.length
    this.stitchesMesh.instanceMatrix.needsUpdate = true
    if (this.stitchesMesh.instanceColor) this.stitchesMesh.instanceColor.needsUpdate = true
    return animating
  }

  /** 让整个作品留在画面中；用户手动转过视角后只调整焦点高度 */
  private frame(shape: Shape) {
    const R = Math.max(2.2, shape.maxRadius + 0.8)
    const H = shape.height
    // 平片（杯垫、圆垫）的正面在底面：翻过来正面朝上，像放在桌上一样
    const flatPiece = H < shape.maxRadius * 0.3
    this.piece.rotation.x = flatPiece ? Math.PI : 0
    this.piece.position.y = flatPiece ? H : 0
    this.shadow.scale.setScalar(R * 2.6)
    this.shadow.position.y = -0.35
    const target = new Vector3(0, H / 2, 0)
    const size = Math.max(R, H * 0.6)
    const dist = size / Math.tan((this.camera.fov * Math.PI) / 360) + R * 0.6
    this.controls.minDistance = size * 0.8
    this.controls.maxDistance = dist * 3
    if (!this.userMoved) {
      const flat = H < R * 0.3
      const elev = flat ? 0.95 : 0.5 // 平片更俯视，立体件更平视
      this.camera.position.set(Math.sin(0.6) * Math.cos(elev) * dist, H / 2 + Math.sin(elev) * dist, Math.cos(0.6) * Math.cos(elev) * dist)
    }
    this.controls.target.copy(target)
    this.controls.update()
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    if (this.spinUntil && now > this.spinUntil) {
      this.spinUntil = 0
      this.controls.autoRotate = false
    }
    const moved = this.controls.update()
    const animating = this.births.size > 0 && this.writeInstances(now)
    if (moved || animating || this.dirty || this.spinUntil) {
      this.renderer.render(this.scene, this.camera)
      this.dirty = false
    }
  }

  /** 当前画面的 PNG（data URL） */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost)
    this.stitchesMesh?.dispose()
    this.surface?.geometry.dispose()
    this.stitchGeo.dispose()
    this.shadow.geometry.dispose()
    ;(this.shadow.material as MeshBasicMaterial).map?.dispose()
    ;(this.shadow.material as MeshBasicMaterial).dispose()
    this.stitchMat.dispose()
    this.surfaceMat.dispose()
    this.yarnTex.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
