// GlassLayer — turns any positioned element (a button, a link, a pill) into liquid glass.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import { createEffect, merge, onCleanup } from 'solid-js'

import { drawAround, drawDom } from './dom-snapshot'
import {
  DESIGN_HEIGHT,
  SPRINGS,
  clamp,
  getGlassEngine,
  lerp,
  mixRgb,
  rgbCss,
  smooth,
  stepSpring,
  surfaceColorOf,
  type GlassView,
  type Rgb,
  type Spring,
} from './engine'

export type GlassMaterial = 'clear' | 'tinted'
export type GlassDroplet = 'none' | 'apart' | 'merged'

export type GlassOptics = {
  tintColor?: string
  borderColor?: string
  borderAlpha?: number
  borderWidth?: number
  frostMix?: number
  frostEdge?: number
  saturation?: number
  clearBlur?: number
  clearBlurEdge?: number
  refraction?: number
  bendMode?: 'edge' | 'radial'
  bendDepth?: number
  bendCurve?: number
  dispersion?: number
  magnify?: number
  light?: number
  rim?: number
  rimWidth?: number
  bevel?: number
  fresnel?: number
  inner?: number
  reflection?: number
  caustic?: number
  mirror?: number
  cursorLight?: boolean
  shadow?: number
  shadowSoftness?: number
  shadowOffset?: number
  dark?: { tint?: number; borderColor?: string; borderAlpha?: number }
}

export type GlassLayerProps = {
  material?: GlassMaterial
  droplet?: GlassDroplet
  tint?: number
  blur?: number
  backdrop?: string
  live?: boolean
  trigger?: string
  disabled?: boolean
  swell?: boolean
  optics?: GlassOptics
}

const PRESS_SCALE = 1.08
const HOVER_SCALE = 1.04
const HOVER_GROW = 0.08
const MAX_GROW_PX = 6
const DROPLET_GAP = 0.25

export const GLASS_CSS = `
@layer components{:where([data-glass-host]){position:relative;isolation:isolate}}
[data-glass-host][data-glass-ready]{background:transparent!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
@keyframes glass-marquee{to{transform:translateX(-50%)}}
[data-glass-marquee]{animation:glass-marquee var(--glass-marquee-duration,5s) linear infinite}
@keyframes glass-in{from{opacity:0;filter:blur(3px);transform:translateY(4px)}}
[data-glass-in]{animation:glass-in .38s cubic-bezier(.2,.8,.2,1) both}
@keyframes glass-draw{from{stroke-dashoffset:25}}
[data-glass-draw]{stroke-dasharray:25;animation:glass-draw .42s cubic-bezier(.65,0,.35,1) .12s both}
@keyframes glass-spin{to{transform:rotate(1turn)}}
[data-glass-spin]{animation:glass-spin .8s linear infinite}
[data-glass-ready] [data-glass-fallback]{visibility:hidden}
@media (prefers-reduced-motion:reduce){[data-glass-marquee],[data-glass-in],[data-glass-draw],[data-glass-spin]{animation:none}}
@media (prefers-reduced-transparency:reduce){[data-glass-host]:not([data-glass-ready]){-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background-color:rgb(255 255 255/.96)!important}:is(.dark,[data-theme=dark]) [data-glass-host]:not([data-glass-ready]){background-color:rgb(28 28 30/.96)!important}}
`

export function ensureStyleOnce(id: string, css: string) {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`style[data-solid-glass="${id}"]`)) return
  const style = document.createElement('style')
  style.setAttribute('data-solid-glass', id)
  style.textContent = css
  document.head.appendChild(style)
}

/** Injects GLASS_CSS once per document. */
export function GlassStyles() {
  ensureStyleOnce('base', GLASS_CSS)
  return null
}

export function GlassLayer(rawProps: GlassLayerProps) {
  const props = merge(
    {
      material: 'clear' as GlassMaterial,
      droplet: 'none' as GlassDroplet,
      tint: 0.6,
      blur: 0,
      live: false,
      disabled: false,
      swell: true,
    },
    rawProps,
  )

  let canvasEl: HTMLCanvasElement | undefined
  let currentDroplet: GlassDroplet = 'none'
  let currentTune: { tint: number; blur: number; optics?: GlassOptics } = { tint: 0.6, blur: 0 }
  let poke: (() => void) | null = null

  createEffect(
    () => ({ droplet: props.droplet, tint: props.tint, blur: props.blur, optics: props.optics }),
    (next) => {
      currentDroplet = next.droplet
      currentTune = { tint: next.tint, blur: next.blur, optics: next.optics }
      poke?.()
    },
  )

  createEffect(
    () => ({
      material: props.material,
      backdrop: props.backdrop,
      live: props.live,
      trigger: props.trigger,
      disabled: props.disabled,
      swell: props.swell,
    }),
    (cfg) => {
      const canvas = canvasEl
      const host = canvas?.parentElement
      const ctx = canvas?.getContext('2d')
      const engine = cfg.disabled ? null : getGlassEngine()
      if (!canvas || !host || !ctx || !engine) return

      const clear = cfg.material === 'clear'
      let w = 0
      let h = 0
      let hasDroplet = false
      let corner: number | null = null
      let surface: Rgb = [1, 1, 1]
      let color: [Rgb, Rgb] = [
        [1, 1, 1],
        [1, 1, 1],
      ]
      let border: [Rgb, Rgb] | null = null
      let borderAlpha = 1
      let darkGlass = false
      let colorT = 1
      let unpaintable = false
      let sampled = false
      let pressed = false
      let hovered = false
      let ready = false
      const page = {
        canvas: document.createElement('canvas'),
        ctx: null as CanvasRenderingContext2D | null,
        key: '',
        at: 0,
        stale: true,
        fill: '',
        size: '',
        lx: 0,
        ly: 0,
        sx: 0,
        sy: 0,
        pinned: [] as Element[],
        rigid: false,
      }
      const press: Spring = { x: 0, v: 0 }
      const growX: Spring = { x: 0, v: 0 }
      const growY: Spring = { x: 0, v: 0 }
      const scale: Spring = { x: 1, v: 0 }
      const drop: Spring = { x: 0, v: 0 }
      const maxScale = () => 1 + (2 * MAX_GROW_PX) / Math.max(w, 1)

      const view: GlassView = {
        canvas,
        ctx,
        dirty: true,
        visible: false,
        step: (dt, still) => {
          if (still) {
            press.x = growX.x = growY.x = press.v = growX.v = growY.v = 0
            drop.x = hasDroplet && currentDroplet === 'apart' ? 1 : 0
            drop.v = 0
            scale.x = 1
            host.style.scale = ''
            if (colorT !== 1) view.dirty = true
            colorT = 1
            return false
          }
          const hov = hovered ? 1 : 0
          const target = pressed ? Math.min(PRESS_SCALE, maxScale()) : hovered ? Math.min(HOVER_SCALE, maxScale()) : 1
          const a = stepSpring(press, pressed ? 1 : 0, SPRINGS.press, dt)
          const b = stepSpring(growX, hov, SPRINGS.hoverX, dt)
          const c = stepSpring(growY, hov, SPRINGS.hoverY, dt)
          const d = stepSpring(scale, target, SPRINGS.press, dt)
          const apart = currentDroplet === 'apart' && view.visible && !pressed
          const e = hasDroplet ? stepSpring(drop, apart ? 1 : 0, apart ? SPRINGS.dropletOut : SPRINGS.dropletIn, dt) : false
          host.style.scale = scale.x === 1 ? '' : scale.x.toFixed(4)
          const fading = 1 - colorT > 0.004
          colorT = fading ? colorT + (1 - colorT) * Math.min(1, dt * 14) : 1
          return a || b || c || d || e || fading || (clear && cfg.live && view.visible)
        },
        lens: (refresh) => {
          if (refresh) {
            w = host.offsetWidth
            h = host.offsetHeight
            const rounding = getComputedStyle(host).borderTopLeftRadius
            const px = rounding.endsWith('%') ? (Math.min(w, h) * parseFloat(rounding)) / 100 : parseFloat(rounding) || 0
            corner = px >= Math.min(w, h) / 2 - 0.5 ? null : px
            const had = hasDroplet
            hasDroplet = currentDroplet !== 'none' && [...host.children].some((c) => c.hasAttribute('data-glass-drop'))
            if (hasDroplet !== had) engine.wake()
            const s = engine.resolveColor(surfaceColorOf(host.parentElement))
            surface = [s[0], s[1], s[2]]
            if (clear) {
              const o = currentTune.optics
              const custom = o?.tintColor || getComputedStyle(host).getPropertyValue('--glass-tint').trim()
              const luminance = 0.2126 * surface[0] + 0.7152 * surface[1] + 0.0722 * surface[2]
              const t = custom ? engine.resolveColor(custom) : null
              const tc: Rgb = t ? [t[0], t[1], t[2]] : luminance > 0.5 ? [1, 1, 1] : [0, 0, 0]
              const tone = 0.2126 * tc[0] + 0.7152 * tc[1] + 0.0722 * tc[2] > 0.5 ? 'light' : 'dark'
              if (host.dataset.glassTone !== tone) host.dataset.glassTone = tone
              darkGlass = tone === 'dark'
              color = [tc, tc]
              const line = darkGlass ? { ...o, ...o?.dark } : o
              const bc = line?.borderColor && (line.borderAlpha ?? 0) > 0 ? engine.resolveColor(line.borderColor) : null
              border = bc ? [[bc[0], bc[1], bc[2]], [bc[0], bc[1], bc[2]]] : null
              borderAlpha = bc ? clamp((line?.borderAlpha ?? 0) * bc[3]) : 1
              colorT = 1
              sampled = true
            } else {
              const had = 'glassReady' in host.dataset
              const transition = host.style.transition
              host.style.transition = 'none'
              if (had) delete host.dataset.glassReady
              const st = getComputedStyle(host)
              const fill = engine.resolveColor(st.backgroundColor)
              const bw = st.borderTopStyle === 'solid' ? parseFloat(st.borderTopWidth) || 0 : 0
              const bc = engine.resolveColor(st.borderTopColor)
              const cannot = st.backgroundImage !== 'none' || (st.borderTopStyle !== 'solid' && st.borderTopStyle !== 'none')
              if (had) {
                host.dataset.glassReady = ''
                void getComputedStyle(host).backgroundColor
              }
              host.style.transition = transition
              const next = mixRgb(surface, [fill[0], fill[1], fill[2]], fill[3])
              const nextBorder: Rgb | null = bw > 0 && bc[3] > 0.02 ? mixRgb(next, [bc[0], bc[1], bc[2]], bc[3]) : null
              unpaintable = cannot || (fill[3] < 0.02 && !nextBorder)
              const now = sampled ? mixRgb(color[0], color[1], colorT) : next
              const nowBorder = sampled && border ? mixRgb(border[0], border[1], colorT) : (nextBorder ?? next)
              const changed = sampled && (now.some((v, i) => Math.abs(v - next[i]) > 0.004) || !!border !== !!nextBorder)
              color = [now, next]
              border = nextBorder ? [nowBorder, nextBorder] : null
              colorT = changed ? 0 : 1
              sampled = true
              if (changed) engine.wake()
            }
          }
          if (w < 2 || h < 2) return null
          if (unpaintable) {
            if (ready) {
              ready = false
              delete host.dataset.glassReady
            }
            return null
          }
          const padX = 8
          const padTop = 10
          const padBottom = Math.round(h * 0.8 + 4)
          const p = clamp(press.x, -0.12, 1.15)
          const s = Math.max(0.5, scale.x)
          const k = lerp(1, Math.min(PRESS_SCALE, maxScale()), p) / s
          const grow = (h * HOVER_GROW) / s
          const t = hasDroplet ? clamp(drop.x, 0, 1.06) : 0
          const pull = h * (1 + DROPLET_GAP) * t
          const hy = (h / 2) * k + grow * growY.x
          const rect = host.getBoundingClientRect()
          const pc = clamp(press.x)
          const unit = h / DESIGN_HEIGHT
          const bevel = lerp(DESIGN_HEIGHT * 0.42, 62, pc)
          const radius = corner === null ? 999 : corner * (hy / (h / 2))
          const { tint, blur, optics: o } = currentTune
          const strength = Math.max(clamp(o?.light ?? 1, 0, 3), 1e-4)
          return {
            left: -padX - host.clientLeft,
            top: -padTop - host.clientTop,
            width: w + 2 * padX,
            height: h + padTop + padBottom,
            unit,
            cx: padX + w / 2,
            cy: padTop + h / 2,
            hx: (w / 2 - pull / 2) * k + grow * growX.x,
            hy,
            radius,
            bodyX: (-pull / 2) * k,
            droplet:
              t > 0.001
                ? {
                    x: (w / 2 - h / 2) * k + grow * growX.x * 0.5,
                    r: hy,
                    k: h * 0.34 * smooth(0, 0.15, t) * (1 - smooth(0.8, 1, t)),
                  }
                : undefined,
            bevel: (corner === null ? bevel : Math.min(bevel, (radius / unit) * 1.2)) * Math.max(0.05, o?.bevel ?? 1),
            band: corner === null || hasDroplet ? undefined : bevel * 0.35 * Math.max(0.05, o?.bendDepth ?? 1),
            shadow: (0.12 * lerp(0.55, 1, pc) * Math.max(0, o?.shadow ?? 1)) / strength,
            shadowSoftness: 34 * lerp(0.6, 1, pc) * Math.max(0.05, o?.shadowSoftness ?? 1),
            shadowOffset: 22 * lerp(0.5, 1, pc) * Math.max(0, o?.shadowOffset ?? 1),
            strength,
            tune: o && {
              rim: o.rim,
              rimWidth: o.rimWidth,
              fresnel: o.fresnel,
              inner: o.inner,
              reflection: o.reflection,
              caustic: o.caustic,
              mirror: o.mirror,
              bendCurve: o.bendCurve,
              bendDepth: o.bendDepth,
              saturation: o.saturation,
              frostEdge: o.frostEdge,
            },
            color: mixRgb(color[0], color[1], colorT),
            border: border ? mixRgb(border[0], border[1], colorT) : undefined,
            borderAlpha: clear ? borderAlpha : undefined,
            borderWidth: clear ? o?.borderWidth : undefined,
            surface,
            edgeClear: 0.2,
            cursorLight: o?.cursorLight ?? true,
            reflection: !clear
              ? undefined
              : {
                  height: h,
                  live: cfg.live,
                  paint: (around, reach) => {
                    const r = host.getBoundingClientRect()
                    const box = {
                      left: r.left + (r.width - w) / 2 - padX,
                      top: r.top + (r.height - h) / 2 - padTop,
                      width: w + 2 * padX,
                      height: h + padTop + padBottom,
                    }
                    drawAround(around, (cfg.backdrop ? host.closest(cfg.backdrop) : null) ?? document.body, box, reach, {
                      skip: (el) => el === host || el.hasAttribute('data-glass-skip'),
                      onStale: dirty,
                    })
                  },
                },
            refraction: clear
              ? {
                  paint: (back) => {
                    back.translate(padX, padTop)
                    const fill = rgbCss(surface)
                    const recoloured = fill !== page.fill
                    page.fill = fill
                    back.fillStyle = fill
                    back.fillRect(-padX, -padTop, w + 2 * padX, h + padTop + padBottom)
                    const root = (cfg.backdrop ? host.closest(cfg.backdrop) : null) ?? document.body
                    const r = host.getBoundingClientRect()
                    const lx = r.left + (r.width - w) / 2
                    const ly = r.top + (r.height - h) / 2
                    const target = back.canvas
                    const key = `${target.width}:${target.height}:${Math.round(lx * 2)}:${Math.round(ly * 2)}:${Math.round(scrollX)}:${Math.round(scrollY)}`
                    const now = performance.now()
                    if (!page.ctx) page.ctx = page.canvas.getContext('2d')
                    const region = { left: lx - padX, top: ly - padTop, right: lx + w + padX, bottom: ly + h + padBottom }
                    const rides =
                      !cfg.live &&
                      page.rigid &&
                      page.size === `${target.width}:${target.height}` &&
                      Math.abs(lx - page.lx + scrollX - page.sx) < 0.05 &&
                      Math.abs(ly - page.ly + scrollY - page.sy) < 0.05 &&
                      !page.pinned.some((el) => {
                        const b = el.getBoundingClientRect()
                        return b.width > 0 && b.height > 0 && b.right > region.left && b.left < region.right && b.bottom > region.top && b.top < region.bottom
                      })
                    const again = !!page.ctx && (page.stale || (key !== page.key && !rides) || now - page.at > (cfg.live ? 12 : 120))
                    if (page.ctx && again) {
                      page.stale = false
                      page.key = key
                      page.at = now
                      page.size = `${target.width}:${target.height}`
                      page.lx = lx
                      page.ly = ly
                      page.sx = scrollX
                      page.sy = scrollY
                      if (page.canvas.width !== target.width || page.canvas.height !== target.height) {
                        page.canvas.width = target.width
                        page.canvas.height = target.height
                      }
                      const pc2 = page.ctx
                      pc2.setTransform(1, 0, 0, 1, 0, 0)
                      pc2.clearRect(0, 0, target.width, target.height)
                      pc2.setTransform(back.getTransform())
                      const found = { pinned: [] as Element[], touched: false, loose: false }
                      drawDom(pc2, root, {
                        origin: { left: lx, top: ly },
                        region,
                        skip: (el) => el === host || el.hasAttribute('data-glass-skip'),
                        onStale: () => {
                          page.stale = true
                          view.dirty = true
                          engine.wake()
                        },
                        found,
                      })
                      page.pinned = found.pinned
                      page.rigid = !found.loose && !found.touched
                    }
                    back.save()
                    back.setTransform(1, 0, 0, 1, 0, 0)
                    back.drawImage(page.canvas, 0, 0)
                    back.restore()
                    return again || recoloured
                  },
                  refract: lerp(44, 37, pc) * Math.max(0, o?.refraction ?? 1),
                  magnify: Math.max(0, o?.magnify ?? 0),
                  dispersion: Math.max(0, o?.dispersion ?? 0.12),
                  blurCenter: Math.max(0, o?.clearBlur ?? 0.35),
                  blurEdge: Math.max(0, o?.clearBlurEdge ?? 2.2),
                  frost: clamp(darkGlass ? (o?.dark?.tint ?? tint) : tint),
                  blur,
                  blurMix: o?.frostMix,
                  radial: o?.bendMode === 'radial' ? 0.065 * Math.max(0, o?.refraction ?? 1) : undefined,
                }
              : undefined,
            screenX: rect.left + rect.width / 2,
            screenY: rect.top + rect.height / 2,
          }
        },
        drawn: () => {
          if (ready) return
          ready = true
          host.dataset.glassReady = ''
        },
        lost: () => {
          delete host.dataset.glassReady
          host.style.scale = ''
        },
      }

      const isDisabled = () => host.matches(":disabled, [aria-disabled='true']")
      const dirty = () => {
        view.dirty = true
        engine.wake()
      }
      poke = dirty
      const onDown = () => {
        if (!cfg.swell || isDisabled()) return
        pressed = true
        engine.wake()
      }
      const onUp = () => {
        pressed = false
        engine.wake()
      }
      const onEnter = (e: PointerEvent) => {
        if (!cfg.swell || e.pointerType !== 'mouse' || isDisabled()) return
        hovered = true
        dirty()
      }
      const onLeave = () => {
        pressed = false
        hovered = false
        dirty()
      }
      const target: HTMLElement = (cfg.trigger ? host.closest<HTMLElement>(cfg.trigger) : null) ?? host
      target.addEventListener('pointerdown', onDown)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
      target.addEventListener('pointerenter', onEnter)
      target.addEventListener('pointerleave', onLeave)
      const io = new IntersectionObserver(([entry]) => {
        view.visible = entry.isIntersecting
        dirty()
      })
      io.observe(host)
      const ro = new ResizeObserver(dirty)
      ro.observe(host)
      const mo = new MutationObserver(dirty)
      mo.observe(host, {
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'data-state'],
      })
      const onScroll = () => {
        view.repaint = true
        engine.wake()
      }
      if (clear) addEventListener('scroll', onScroll, { passive: true, capture: true })
      engine.add(view)

      onCleanup(() => {
        engine.remove(view)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        io.disconnect()
        ro.disconnect()
        mo.disconnect()
        removeEventListener('scroll', onScroll, { capture: true })
        target.removeEventListener('pointerdown', onDown)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        target.removeEventListener('pointerenter', onEnter)
        target.removeEventListener('pointerleave', onLeave)
        delete host.dataset.glassReady
        delete host.dataset.glassTone
        host.style.scale = ''
        poke = null
      })
    },
  )

  return (
    <>
      <GlassStyles />
      <canvas
        ref={(el) => {
          canvasEl = el
        }}
        aria-hidden="true"
        style={{
          position: 'absolute',
          'z-index': -1,
          'max-width': 'none',
          'pointer-events': 'none',
          width: '0px',
          height: '0px',
        }}
      />
    </>
  )
}

export default GlassLayer
