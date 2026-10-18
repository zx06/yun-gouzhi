/**
 * Three.js 立体预览（单独打包，按需加载）。
 * 负责把 buildShape() 的结果渲染为逼真毛线质感的立体织片：
 * 织片底面阴影曲面 + 细毛线管短针（正面 V 字两条腿 + 顶部辫子链前后半针 + 脚钩进上一圈那针），
 * 所有针目合并成一个 BufferGeometry（每针固定一段顶点区间），一次 draw call。
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
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  BufferGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  NoColorSpace,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildShape, type Shape } from '../lib/shape3d'
import { colorAt, type ColorChange } from '../lib/colors'
import type { StitchType } from '../types/stitch'
import { stitchParents } from '../lib/stitchTopology'
import {
  stitchCurves,
  sampleCatmullRom,
  writeTube,
  tubeIndices,
  tubeIndexCount,
  tubeVertexCount,
  TUBES_PER_STITCH,
  type TubeLayout,
} from '../lib/yarnCurves'
import type { Vec3 } from '../lib/shape3d'

export interface SceneInput {
  rounds: StitchType[][]
  ringSize?: number
  base: string
  changes: ColorChange[]
}

const POP_MS = 320
const BG = 0xfdf3df
/** 毛线半径（针宽 = 1） */
export const YARN_R = 0.175
/** 每段毛线：前半针、后半针、左腿、右腿、背面横杠的颜色深浅（背面的线照不到光） */
const TUBE_SHADE = [1, 0.82, 0.96, 0.96, 0.78]

/** 手机（粗指针 / 窄屏）用更少的分段 */
export function yarnLayout(): TubeLayout {
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700)
  return coarse ? { segs: 8, radial: 5 } : { segs: 12, radial: 7 }
}

/**
 * 多股加捻毛线贴图（程序生成，灰度）：u 沿线方向、v 绕线一周。
 * 3 股线斜着绕，股与股之间是深色的沟，股上有顺着捻向的细纤维和毛羽噪点。
 * 同时用作颜色贴图（乘在针目颜色上）和凹凸贴图。
 */
function yarnTexture(): CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const img = g.createImageData(S, S)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // 顺着股线方向的纤维条纹：预先做一条 1D 噪声
  const fiber = Array.from({ length: S * 4 }, () => rnd())
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      const ph = (((u - v) * 3) % 1 + 1) % 1 // 0..1 跨一股
      const ply = Math.sin(Math.PI * ph) // 股的圆弧截面
      const fi = fiber[Math.floor(((u + v) * 3 * S + ph * 37) % (S * 4))]
      let h = 0.62 + 0.38 * Math.pow(ply, 0.5)
      h *= 0.9 + 0.1 * fi
      h += (rnd() - 0.5) * 0.08
      const val = Math.max(0, Math.min(255, h * 255))
      const o = (y * S + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = val
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  // 毛羽：零星的浅色短纤维
  g.strokeStyle = 'rgba(255,255,255,0.22)'
  g.lineWidth = 1
  for (let i = 0; i < 90; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const a = rnd() * Math.PI
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6)
    g.stroke()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
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

const WHITE = new Color(0xffffff)

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
  private layout = yarnLayout()
  private yarnTex = yarnTexture()
  private bumpTex: CanvasTexture
  private stitchMat: MeshPhysicalMaterial
  private surfaceMat: MeshStandardMaterial
  /** 所有针目的毛线管合在一起 */
  private yarnGeo: BufferGeometry | null = null
  private yarnMesh: Mesh | null = null
  private capacity = 0
  /** writeAll 之后、下一次渲染之前：整段上传，不能被动画帧的局部更新覆盖 */
  private fullUpload = false
  /** 每针的父针（stitches 下标） */
  private parents: number[][] = []
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
  private tmpColor = new Color()
  stitchCount = 0
  /** 毛线管三角形数（e2e / 性能观察用） */
  get yarnTriangles(): number {
    return this.yarnGeo ? this.yarnGeo.drawRange.count / 3 : 0
  }
  /** 'low' = 手机的低分段 */
  get lod(): 'high' | 'low' {
    return this.layout.radial <= 5 ? 'low' : 'high'
  }

  constructor(
    private container: HTMLElement,
    private opts: { onContextLost?: () => void } = {},
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
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
    const fill = new DirectionalLight(0xfff1e0, 0.18)
    fill.position.set(0, -6, 4)
    this.scene.add(fill)

    this.bumpTex = new CanvasTexture(this.yarnTex.image as HTMLCanvasElement)
    this.bumpTex.wrapS = this.bumpTex.wrapT = RepeatWrapping
    this.bumpTex.colorSpace = NoColorSpace
    // 哑光、几乎没有高光，加一点 sheen 让边缘有毛茸茸的柔光
    this.stitchMat = new MeshPhysicalMaterial({
      vertexColors: true,
      map: this.yarnTex,
      bumpMap: this.bumpTex,
      bumpScale: 1.6,
      roughness: 0.96,
      metalness: 0,
      specularIntensity: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.85,
      sheenColor: new Color(0x9a9a9a),
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
    this.parents = stitchParents(input.rounds).map((l) => l.parents)
    this.ensureCapacity(shape.stitches.length)
    this.buildSurface(shape, input)
    this.writeAll(now)
    this.frame(shape)
    this.dirty = true
  }

  private ensureCapacity(n: number) {
    if (n <= this.capacity && this.yarnGeo) return
    const cap = Math.max(64, 2 ** Math.ceil(Math.log2(n + 1)))
    if (this.yarnMesh) {
      this.piece.remove(this.yarnMesh)
      this.yarnGeo?.dispose()
    }
    const vPer = tubeVertexCount(this.layout) * TUBES_PER_STITCH
    const iPer = tubeIndexCount(this.layout) * TUBES_PER_STITCH
    const geo = new BufferGeometry()
    const nv = cap * vPer
    geo.setAttribute('position', new BufferAttribute(new Float32Array(nv * 3), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(nv * 3), 3))
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(nv * 2), 2))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(nv * 3), 3))
    const idx = new Uint32Array(cap * iPer)
    let o = 0
    for (let st = 0; st < cap; st++) for (let tb = 0; tb < TUBES_PER_STITCH; tb++) o = tubeIndices(this.layout, (st * TUBES_PER_STITCH + tb) * tubeVertexCount(this.layout), idx, o)
    geo.setIndex(new BufferAttribute(idx, 1))
    geo.setDrawRange(0, 0)
    this.yarnGeo = geo
    this.capacity = cap
    this.yarnMesh = new Mesh(geo, this.stitchMat)
    this.yarnMesh.frustumCulled = false
    this.piece.add(this.yarnMesh)
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
    // 曲面退到针目背后（沿正面法线往里），针与针之间的缝隙里透出深色，像织物的孔
    const IN = 0.26
    const pts = [
      new Vector2(0.001, prof[0].y + IN),
      ...pp.map((p) => new Vector2(Math.max(0.001, p.r - Math.sin(p.phi) * IN), p.y + Math.cos(p.phi) * IN)),
    ]
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
        this.tmpColor.set(colorAt(roundSeq[Math.min(rk, roundSeq.length - 1)] ?? 0, input.base, input.changes)).multiplyScalar(0.12)
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

  /** 重写全部针目；返回是否还有弹出动画 */
  private writeAll(now: number): boolean {
    const shape = this.shape
    if (!shape || !this.yarnGeo) return false
    let animating = false
    for (let i = 0; i < shape.stitches.length; i++) animating = this.writeStitch(i, now) || animating
    const iPer = tubeIndexCount(this.layout) * TUBES_PER_STITCH
    this.yarnGeo.setDrawRange(0, shape.stitches.length * iPer)
    for (const k of ['position', 'normal', 'uv', 'color']) {
      const attr = this.yarnGeo.getAttribute(k) as BufferAttribute
      attr.clearUpdateRanges()
      attr.needsUpdate = true
    }
    this.fullUpload = true
    return animating
  }

  /** 只重写正在弹出的针（动画帧） */
  private writeBirths(now: number): boolean {
    const shape = this.shape
    if (!shape || !this.yarnGeo) return false
    let animating = false
    const vPer = tubeVertexCount(this.layout) * TUBES_PER_STITCH
    const attrs = (['position', 'normal', 'uv', 'color'] as const).map((k) => this.yarnGeo!.getAttribute(k) as BufferAttribute)
    const partial = !this.fullUpload
    if (partial) attrs.forEach((a) => a.clearUpdateRanges())
    shape.stitches.forEach((s, i) => {
      if (!this.births.has(s.id)) return
      animating = this.writeStitch(i, now) || animating
      for (const a of attrs) {
        if (partial) a.addUpdateRange(i * vPer * a.itemSize, vPer * a.itemSize)
        a.needsUpdate = true
      }
    })
    return animating
  }

  private writeStitch(i: number, now: number): boolean {
    const shape = this.shape!
    const input = this.input!
    const geo = this.yarnGeo!
    const s = shape.stitches[i]
    let k = 1
    let animating = false
    const b = this.births.get(s.id)
    if (b !== undefined) {
      const t = (now - b) / POP_MS
      if (t >= 1) this.births.delete(s.id)
      else {
        k = Math.max(0.01, easeOutBack(Math.max(0, t)))
        animating = true
      }
    }
    const parents = (this.parents[i] ?? []).map((p) => shape.stitches[p]).filter(Boolean)
    const curves = stitchCurves(s, parents)
    // 弹出：以钩入点为中心从小长大，同时从正面浮起再落下
    const lift = (1 - Math.min(k, 1)) * 0.4
    const A = curves.anchor
    const n = s.normal
    const tf = (p: Vec3): Vec3 => [
      A[0] + (p[0] - A[0]) * k + n[0] * lift,
      A[1] + (p[1] - A[1]) * k + n[1] * lift,
      A[2] + (p[2] - A[2]) * k + n[2] * lift,
    ]
    const pos = geo.getAttribute('position').array as Float32Array
    const nor = geo.getAttribute('normal').array as Float32Array
    const uv = geo.getAttribute('uv').array as Float32Array
    const col = geo.getAttribute('color').array as Float32Array
    const vTube = tubeVertexCount(this.layout)
    this.tmpColor.set(colorAt(s.seq, input.base, input.changes))
    if (b !== undefined && k < 1.05) this.tmpColor.lerp(WHITE, Math.max(0, 0.45 * (1 - k)))
    const r = YARN_R * Math.min(1, Math.max(0.3, k))
    curves.tubes.forEach((ctrl, tb) => {
      const v0 = (i * TUBES_PER_STITCH + tb) * vTube
      const path = sampleCatmullRom(k === 1 ? ctrl : ctrl.map(tf), this.layout.segs)
      writeTube(path, r, this.layout, pos, nor, uv, v0, 0.9)
      const sh = TUBE_SHADE[tb]
      for (let v = v0; v < v0 + vTube; v++) {
        col[v * 3] = this.tmpColor.r * sh
        col[v * 3 + 1] = this.tmpColor.g * sh
        col[v * 3 + 2] = this.tmpColor.b * sh
      }
    })
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
    const animating = this.births.size > 0 && this.writeBirths(now)
    if (moved || animating || this.dirty || this.spinUntil) {
      this.renderer.render(this.scene, this.camera)
      this.fullUpload = false
      this.dirty = false
    }
  }

  /** 当前画面的 PNG（data URL） */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    this.fullUpload = false
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    this.controls.dispose()
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost)
    this.yarnGeo?.dispose()
    this.surface?.geometry.dispose()
    this.bumpTex.dispose()
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
