// GlassSlideToConfirm — slide-to-confirm track whose thumb is a liquid glass lens.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import type { JSX } from '@solidjs/web'
import { createEffect, createMemo, createSignal, For, merge, onSettled } from 'solid-js'

import { drawAround, drawDom } from './dom-snapshot'
import { SPRINGS, clamp, getGlassEngine, lerp, mixRgb, smooth, stepSpring, surfaceColorOf, type GlassView, type Rgb, type Spring } from './engine'
import { GlassStyles } from './glass-layer'

export type GlassSlideState = 'idle' | 'pending' | 'success'
export type GlassSlideSize = 'sm' | 'md' | 'lg' | 'xl'

export type GlassSlideToConfirmProps = {
  children: string
  onConfirm: () => unknown
  onConfirmError?: (error: unknown) => void
  pendingLabel?: string
  successLabel?: string
  errorLabel?: string
  threshold?: number
  resetAfter?: number
  hint?: boolean
  icon?: JSX.Element
  size?: GlassSlideSize
  fillClass?: string
  fill?: boolean
  mirror?: boolean
  disabled?: boolean
  class?: string
}

const OPTION_UNITS = 80
const OPTICS = (OPTION_UNITS * 1.35) / 120
const SWELL = 0.12
const STRETCH_W = 0.2
const STRETCH_H = 0.12
const TAIL = { omega: 17, zeta: 0.8 }
const NECK_SLOPE = 0.2
const NECK_PINCH = 0.74
const BULGE = 0.043
const BULGE_REACH = 1.35
const BULGE_SPEED = 0.8
const MEMBRANE = { omega: 24, zeta: 0.32 }
const RUBBER_GIVE = 1.35
const RUBBER_TRACK = 0.78
const OVERFLOW = 16
const WALL_GIVE = 0.75
const SQUASH_RATE = 1.15
const SQUASH = 0.2
const SQUASH_TALL = 0.6
const MARK_GLOW = 'transition-[filter] duration-200 [[data-glass-traveling]_&]:[filter:drop-shadow(0_0_5px_rgb(255_255_255/0.35))]'
const FILL_BULGE = 0.8
const FILL_SHOWN = 6
const REST = 'inset(8px 0 round 999px)'
const HOLD_SECONDS = 0.9
const HINT_EVERY = 4200
const SPIN_AT = 0.6
const SPIN = { omega: 18, zeta: 1 }
const DISSOLVE = { omega: 40, zeta: 1 }
const MORPH = { omega: 20, zeta: 1 }
const SWAP = { omega: 30, zeta: 1 }
const SWAP_SCALE = 0.25
const SWAP_BLUR = 4
const REFORM = 0.75
const REOPEN = 0.09
const POP = 0.12
const POP_KICK_X = 29
const POP_KICK_Y = 18.7
const DRAWN = 0.99
const DRAW = { omega: 13.4, zeta: 1 }
const HOME = { omega: 22, zeta: 0.75 }

const sizes: Record<GlassSlideSize, { host: string; thumb: string; fill: string; label: string; copy: string }> = {
  sm: { host: 'h-10 text-[13px] [&_svg]:size-4', thumb: 'size-8', fill: 'h-12 w-8', label: 'left-10', copy: 'left-9 h-10' },
  md: { host: 'h-12 text-sm [&_svg]:size-[18px]', thumb: 'size-10', fill: 'h-14 w-10', label: 'left-12', copy: 'left-11 h-12' },
  lg: { host: 'h-14 text-[15px] [&_svg]:size-5', thumb: 'size-12', fill: 'h-16 w-12', label: 'left-14', copy: 'left-[52px] h-14' },
  xl: { host: 'h-24 text-[20px] [&_svg]:size-8', thumb: 'size-[88px]', fill: 'h-[104px] w-[88px]', label: 'left-24', copy: 'left-[92px] h-24' },
}

const CHEVRON = [9.5, 5.5, 16, 12, 9.5, 18.5]
const CHECK = [4.5, 12.75, 10.5, 18.75, 19.5, 5.25]
const markPath = (k: number) => {
  const p = CHEVRON.map((from, i) => +lerp(from, CHECK[i], k).toFixed(2))
  return `M${p[0]} ${p[1]}L${p[2]} ${p[3]}L${p[4]} ${p[5]}`
}

const Spinner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" data-glass-spin="">
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
)

type Controller = { unlock: () => void; wake: () => void }

export function GlassSlideToConfirm(rawProps: GlassSlideToConfirmProps) {
  const props = merge(
    {
      threshold: 0.9,
      resetAfter: 0,
      hint: true,
      size: 'md' as GlassSlideSize,
      fillClass: 'bg-[#3291FF] text-white',
      fill: true,
      mirror: false,
      disabled: false,
      class: '',
    },
    rawProps,
  )

  const s = createMemo(() => sizes[props.size])
  const [state, setState] = createSignal<GlassSlideState>('idle')
  const [failed, setFailed] = createSignal(false)
  const [touched, setTouched] = createSignal(false)
  const [lastStatus, setLastStatus] = createSignal('')

  let rootEl: HTMLDivElement | undefined
  let canvasEl: HTMLCanvasElement | undefined
  let controller: Controller | null = null
  let alive = true

  const toIdle = (didFail: boolean) => {
    setState('idle')
    setFailed(didFail)
    controller?.unlock()
  }

  const run = async () => {
    setTouched(true)
    setFailed(false)
    setState('pending')
    try {
      await props.onConfirm()
      if (alive) setState('success')
    } catch (error) {
      if (alive) toIdle(true)
      props.onConfirmError?.(error)
    }
  }

  let liveCfg = {
    run,
    threshold: 0.9,
    hint: true,
    disabled: false,
    state: 'idle' as GlassSlideState,
    fill: true,
    mirror: false,
  }

  createEffect(
    () => ({
      threshold: props.threshold,
      hint: props.hint,
      disabled: props.disabled,
      state: state(),
      fill: props.fill,
      mirror: props.mirror,
    }),
    (next) => {
      liveCfg = { run, ...next }
      controller?.wake()
    },
  )

  createEffect(
    () => ({ st: state(), pendingLabel: props.pendingLabel, successLabel: props.successLabel }),
    ({ st, pendingLabel, successLabel }) => {
      const next = st === 'pending' ? (pendingLabel ?? '') : st === 'success' ? (successLabel ?? '') : ''
      if (next) setLastStatus(next)
    },
  )

  createEffect(
    () => ({ st: state(), resetAfter: props.resetAfter }),
    ({ st, resetAfter }) => {
      if (st !== 'success' || !resetAfter) return
      const id = setTimeout(() => toIdle(false), resetAfter)
      return () => clearTimeout(id)
    },
  )

  onSettled(() => {
    alive = true
    const root = rootEl
    const canvas = canvasEl
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) {
      return () => {
        alive = false
      }
    }
    const part = (name: string) => root.querySelector<HTMLElement>(`[data-glass-slide="${name}"]`)
    const track = part('track')
    const bed = part('bed')
    const label = part('label')
    const fill = part('fill')
    const copy = part('copy')
    const status = part('status')
    const thumb = part('thumb')
    const disc = part('disc')
    const done = part('done')
    const mark = part('mark')
    const glyph = part('glyph')
    const spinner = part('spinner')
    const check = part('check')
    if (!track || !bed || !label || !fill || !copy || !status || !thumb || !disc || !done || !mark || !spinner || !check) {
      return () => {
        alive = false
      }
    }
    const ink = mark.querySelector('[data-glass-slide="ink"]')
    const checkPath = check.querySelector('path')
    let engine = getGlassEngine()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    let W = 0
    let h = 0
    let d = 0
    let pad = 0
    let travel = 1
    let color: Rgb = [1, 1, 1]
    let fillColor: Rgb = [0.2, 0.57, 1]
    let surface: Rgb = [1, 1, 1]
    let input: 'none' | 'drag' | 'hold' | 'keys' = 'none'
    let locked = liveCfg.state !== 'idle'
    let arrived = locked
    let reopening = false
    let dragGoal = 0
    let grab = 0
    let hold = 0
    let keyValue = 0
    let nudged = false
    let lensOn = false
    let valueNow = ''
    const x: Spring = { x: 0, v: 0 }
    const tail: Spring = { x: 0, v: 0 }
    let stretchX = 1
    let stretchY = 1
    let shown = 0
    const swell: Spring = { x: 0, v: 0 }
    let margin = 8
    let rim = 8
    let shaped = false
    let fillVeil = ''
    let homing = false
    let bulged = false
    const press: Spring = { x: 0, v: 0 }
    const collapse: Spring = { x: locked ? 1 : 0, v: 0 }
    const spin: Spring = { x: 0, v: 0 }
    const dissolve: Spring = { x: 0, v: 0 }
    const morph: Spring = { x: 0, v: 0 }
    const swap: Spring = { x: 0, v: 0 }
    const popX: Spring = { x: 0, v: 0 }
    const popY: Spring = { x: 0, v: 0 }
    let greeted = liveCfg.state === 'success'
    let marks = ''

    const measure = () => {
      W = root.offsetWidth
      h = root.offsetHeight
      d = thumb.offsetWidth
      pad = (h - d) / 2
      travel = Math.max(1, W - h)
      margin = Math.max(0, -bed.offsetTop)
      rim = Math.max(0, pad - fill.offsetTop)
      root.style.setProperty('--glass-slide-ink', getComputedStyle(fill).color)
      copy.style.width = `${W - h}px`
      if (arrived && input === 'none') x.x = tail.x = travel
      if (engine) {
        const c = engine.resolveColor(getComputedStyle(disc).backgroundColor)
        color = [c[0], c[1], c[2]]
        const f = engine.resolveColor(getComputedStyle(done).backgroundColor)
        fillColor = [f[0], f[1], f[2]]
        const page = engine.resolveColor(surfaceColorOf(root.parentElement))
        surface = [page[0], page[1], page[2]]
      }
    }

    const write = () => {
      const p = clamp(x.x / travel)
      const c = clamp(collapse.x)
      const off = c * travel
      const r = d / 2
      const push = input === 'drag' ? 0 : Math.max(0, -x.x)
      const squash = Math.min(SQUASH, (SQUASH_RATE * push) / d)
      const at = Math.max(x.x, -(pad + r * squash))
      shown = at
      const back = Math.min(0, shown + r * squash)
      const tailAt = Math.max(0, tail.x - off - back)
      const headAt = Math.max(0, shown - off - back)
      const gap = headAt - tailAt
      const shift = 12 * p
      const speed = clamp(Math.abs(x.v) / (22 * d))
      const lead = Math.min(OVERFLOW, WALL_GIVE * Math.min(pad, Math.max(0, -at)))
      const stretch = Math.min(OVERFLOW, RUBBER_TRACK * Math.max(0, at - travel))
      stretchX = (1 + STRETCH_W * speed) * (1 - squash) * (1 + POP * popX.x)
      stretchY = (1 - STRETCH_H * speed) * (1 + SQUASH_TALL * squash) * (1 + POP * popY.x)
      disc.style.scale = Math.abs(stretchX - 1) > 0.004 || Math.abs(stretchY - 1) > 0.004 ? `${stretchX.toFixed(3)} ${stretchY.toFixed(3)}` : ''
      const fade = String(+((1 - 0.7 * p) * (1 - smooth(0, 1 / 3, c))).toFixed(3))
      const amp = Math.max(0, swell.x) * BULGE * h * (1 + BULGE_SPEED * speed)
      const reach = (BULGE_REACH * d) / 2
      thumb.style.translate = `${shown.toFixed(2)}px`
      track.style.left = `${(off - lead).toFixed(2)}px`
      track.style.right = `${(-stretch).toFixed(2)}px`
      fill.style.translate = `${(off + back).toFixed(2)}px`
      fill.style.width = `${(Math.max(tailAt, headAt) + d).toFixed(2)}px`
      const lift = amp * FILL_BULGE
      if (gap > 0.5 || lift > 0.02) {
        const a = tailAt + r
        const b = headAt + r
        const rise = (pos: number) => lift * Math.exp(-(((pos - b) / reach) ** 2))
        const steps = Math.max(1, Math.round((a - r) / 6))
        let upper = ''
        let lower = ''
        for (let i = 0; i <= steps; i++) {
          const pos = r + ((a - r) * i) / steps
          const up = rise(pos)
          upper += `L${pos.toFixed(1)} ${(rim - up).toFixed(2)}`
          lower = `L${pos.toFixed(1)} ${(rim + d + up).toFixed(2)}${lower}`
        }
        let end = a
        let over = ''
        let under = ''
        if (gap > 0.5) {
          const waist = Math.min(NECK_SLOPE * gap, NECK_PINCH * r)
          const mid = (a + gap / 2).toFixed(1)
          const top = (rim + waist).toFixed(2)
          const low = (rim + d - waist).toFixed(2)
          over = `C${mid} ${top} ${mid} ${top} ${b.toFixed(1)} ${(rim - rise(b)).toFixed(2)}`
          under = `C${mid} ${low} ${mid} ${low} ${a.toFixed(1)} ${(rim + d + rise(a)).toFixed(2)}`
          end = b
        }
        const first = rise(r)
        const last = rise(end)
        const cap = (by: number) => `A${r} ${(r + by).toFixed(2)} 0 0 1 `
        fill.style.clipPath = `path('M${r} ${(rim - first).toFixed(2)}${upper}${over}${cap(last)}${end.toFixed(1)} ${(rim + d + last).toFixed(2)}${under}${lower}${cap(first)}${r} ${(rim - first).toFixed(2)}Z')`
        shaped = true
      } else if (shaped) {
        fill.style.clipPath = REST
        shaped = false
      }
      const out = Math.max(tailAt, headAt) - 0.5
      const show = liveCfg.fill ? lerp(lensOn ? clamp(press.x) : 0, 1, clamp(out / FILL_SHOWN)) : 0
      const veil = show < 0.01 ? 'hidden' : show > 0.99 ? '' : String(+show.toFixed(3))
      if (veil !== fillVeil) {
        fillVeil = veil
        fill.style.visibility = veil === 'hidden' ? 'hidden' : ''
        fill.style.opacity = veil === 'hidden' ? '' : veil
      }
      const width = W - off + lead + stretch
      if (amp > 0.02 && width - h > 1) {
        const R = h / 2
        const centre = pad + shown + d / 2 - off + lead
        const rise = (pos: number) => amp * Math.exp(-(((pos - centre) / reach) ** 2))
        const steps = Math.max(2, Math.round((width - h) / 6))
        let upper = ''
        let lower = ''
        for (let i = 0; i <= steps; i++) {
          const pos = R + ((width - h) * i) / steps
          const up = rise(pos)
          upper += `L${pos.toFixed(1)} ${(margin - up).toFixed(2)}`
          lower = `L${pos.toFixed(1)} ${(margin + h + up).toFixed(2)}${lower}`
        }
        const start = rise(R)
        const end = rise(width - R)
        const cap = (by: number) => `A${R} ${(R + by).toFixed(2)} 0 0 1 `
        bed.style.clipPath = `path('M${R} ${(margin - start).toFixed(2)}${upper}${cap(end)}${(width - R).toFixed(1)} ${(margin + h + end).toFixed(2)}${lower}${cap(start)}${R} ${(margin - start).toFixed(2)}Z')`
        bulged = true
      } else if (bulged) {
        bed.style.clipPath = REST
        bulged = false
      }
      label.style.translate = `${shift.toFixed(2)}px`
      label.style.opacity = fade
      copy.style.translate = `${(shift - off - back).toFixed(2)}px`
      copy.style.opacity = fade
      status.style.opacity = String(+smooth(0.5, 1, c).toFixed(3))
      const sv = +clamp(spin.x).toFixed(3)
      const uv = +clamp(dissolve.x).toFixed(3)
      const kv = +clamp(morph.x).toFixed(3)
      const vv = +clamp(swap.x).toFixed(3)
      const next = `${sv} ${uv} ${kv} ${vv} ${lensOn}`
      if (next !== marks) {
        marks = next
        done.style.opacity = lensOn ? '0' : String(+Math.sqrt(uv).toFixed(3))
        bed.style.opacity = uv > 0 ? String(+(1 - uv).toFixed(3)) : ''
        disc.style.opacity = uv > 0 && !lensOn ? String(+(1 - uv).toFixed(3)) : ''
        mark.style.opacity = String(+((1 - sv) * (1 - vv)).toFixed(3))
        spinner.style.opacity = String(sv)
        check.style.opacity = String(+((1 - sv) * vv).toFixed(3))
        if (ink && checkPath) {
          const dp = markPath(kv)
          ink.setAttribute('d', dp)
          checkPath.setAttribute('d', dp)
        } else if (glyph) {
          const leave = vv > 0 && vv < 1
          glyph.style.scale = leave ? String(+lerp(1, SWAP_SCALE, vv).toFixed(3)) : ''
          glyph.style.filter = leave ? `blur(${+(SWAP_BLUR * vv).toFixed(2)}px)` : ''
          check.style.scale = leave ? String(+lerp(SWAP_SCALE, 1, vv).toFixed(3)) : ''
          check.style.filter = leave ? `blur(${+(SWAP_BLUR * (1 - vv)).toFixed(2)}px)` : ''
        }
      }
      const now = String(Math.round(p * 100))
      if (now !== valueNow) root.setAttribute('aria-valuenow', (valueNow = now))
    }

    const stopLens = () => {
      if (!lensOn) return
      lensOn = false
      press.x = press.v = 0
      delete root.dataset.glassMoving
      delete root.dataset.glassTraveling
      view.dirty = true
    }
    const startLens = () => {
      if (lensOn || !engine || !view.visible || reduced.matches) return
      measure()
      lensOn = true
    }
    const commit = () => {
      locked = true
      input = 'none'
      root.style.cursor = ''
    }

    const tick = (dt: number, still: boolean) => {
      let goal = locked ? travel : 0
      if (input === 'drag') {
        const over = dragGoal - travel
        const give = RUBBER_GIVE * h
        const most = OVERFLOW / RUBBER_TRACK
        goal = over > 0 ? travel + (most * over) / (over + give) : dragGoal < 0 ? (pad * dragGoal) / (d / 2 - dragGoal) : dragGoal
      } else if (input === 'keys') goal = keyValue * travel
      else if (input === 'hold') {
        hold = still ? 1 : Math.min(1, hold + dt / HOLD_SECONDS)
        goal = hold * travel
        if (hold >= 1) commit()
      }
      let moving = false
      if (still) {
        x.x = tail.x = goal
        x.v = tail.v = swell.x = swell.v = 0
        stopLens()
      } else {
        const following = input === 'drag' || input === 'hold'
        if (input !== 'none') homing = false
        const a = stepSpring(x, goal, following ? SPRINGS.drag : homing ? HOME : SPRINGS.slide, dt)
        if (!a) homing = false
        const open = lensOn && (following || Math.abs(x.x - goal) > d * 0.06)
        const b = lensOn && stepSpring(press, open ? 1 : 0, SPRINGS.press, dt)
        if (lensOn) {
          const landing = locked && input === 'none' && !liveCfg.fill && press.x > 0.5
          if (!open && !landing) delete root.dataset.glassTraveling
          else if ('glassMoving' in root.dataset) root.dataset.glassTraveling = ''
        }
        const c = stepSpring(tail, x.x, TAIL, dt)
        const e = stepSpring(swell, following ? 1 : 0, MEMBRANE, dt)
        moving = a || b || c || e
      }
      if (locked && !arrived && !reopening && Math.abs(x.x - travel) <= d * 0.06) {
        arrived = true
        nudged = true
        liveCfg.run()
      }
      const target = arrived ? 1 : 0
      let closing = false
      if (still) {
        collapse.x = target
        collapse.v = 0
      } else closing = stepSpring(collapse, target, DRAW, dt)
      let freed = false
      if (reopening && collapse.x <= REOPEN) {
        reopening = locked = false
        freed = homing = true
      }
      const now = liveCfg.state
      const confirmed = now === 'success' && input === 'none' && collapse.x > DRAWN
      if (confirmed && !greeted && !still) {
        popX.v += POP_KICK_X
        popY.v += POP_KICK_Y
      }
      greeted = confirmed
      const spinGoal = now === 'pending' && collapse.x > SPIN_AT ? 1 : 0
      const dissolveGoal = confirmed || (now !== 'success' && dissolve.x > 0.5 && collapse.x > REFORM) ? 1 : 0
      const morphGoal = confirmed ? 1 : 0
      let marking = false
      if (still) {
        spin.x = spinGoal
        dissolve.x = swap.x = dissolveGoal
        morph.x = morphGoal
        popX.x = popY.x = 0
        spin.v = dissolve.v = morph.v = swap.v = popX.v = popY.v = 0
      } else {
        const a = stepSpring(spin, spinGoal, spinGoal ? SPIN : DISSOLVE, dt)
        const b = stepSpring(dissolve, dissolveGoal, DISSOLVE, dt)
        const c = stepSpring(morph, morphGoal, MORPH, dt)
        const e = stepSpring(swap, dissolveGoal, ink ? DISSOLVE : SWAP, dt)
        const f = stepSpring(popX, 0, SPRINGS.hoverX, dt)
        const g = stepSpring(popY, 0, SPRINGS.hoverY, dt)
        marking = a || b || c || e || f || g
      }
      write()
      return moving || closing || marking || freed || (input === 'hold' && !still)
    }

    let raf = 0
    let last = 0
    const loop = (now: number) => {
      raf = 0
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
      last = now
      if (tick(dt, reduced.matches)) raf = requestAnimationFrame(loop)
      else last = 0
    }
    const wake = () => {
      if (engine) engine.wake()
      else if (!raf) raf = requestAnimationFrame(loop)
    }

    const view: GlassView = {
      canvas,
      ctx,
      dirty: false,
      visible: false,
      step: tick,
      lens: (refresh) => {
        if (!lensOn || !engine) return null
        if (refresh) measure()
        const p = clamp(press.x, -0.12, 1.15)
        const pc = clamp(press.x)
        const frost = 1 - pc
        const padX = Math.round(d * 0.75 + 12) + OVERFLOW
        const padTop = Math.round(d * 0.3 + 6)
        const padBottom = Math.round(d * 1.1 + 8)
        const box = root.getBoundingClientRect()
        const cx = pad + shown + d / 2
        const gl = engine
        return {
          left: -padX,
          top: -padTop,
          width: W + 2 * padX,
          height: h + padTop + padBottom,
          unit: d / OPTION_UNITS,
          cx: padX + cx,
          cy: padTop + h / 2,
          hx: (d / 2) * (1 + SWELL * p) * stretchX,
          hy: (d / 2) * (1 + SWELL * p) * stretchY,
          radius: 999,
          bodyX: 0,
          bevel: lerp(OPTION_UNITS * 0.42, 62 * OPTICS, pc),
          shadow: 0.12 * lerp(0.55, 1, pc),
          shadowSoftness: 34 * OPTICS * lerp(0.6, 1, pc),
          shadowOffset: 22 * OPTICS * lerp(0.5, 1, pc),
          strength: 1,
          color: mixRgb(color, fillColor, clamp(dissolve.x)),
          surface,
          edgeClear: 0,
          refraction: {
            paint: (back) => {
              back.translate(padX, padTop)
              drawDom(back, root, {
                origin: box,
                skip: (el) => el === canvas || el === thumb,
                onStale: () => {
                  view.dirty = true
                  gl.wake()
                },
              })
            },
            refract: lerp(6, 37, pc) * OPTICS * lerp(0.06, 1, pc),
            magnify: 0.12 * pc,
            dispersion: 0.12 * pc,
            blurCenter: lerp(0.35, 4, frost),
            blurEdge: lerp(2.2, 4, frost),
            frost,
          },
          cursorLight: true,
          pointerLight: true,
          reflection: liveCfg.mirror
            ? {
                height: d,
                paint: (around, reach) => {
                  drawAround(around, document.body, { left: box.left - padX, top: box.top - padTop, width: W + 2 * padX, height: h + padTop + padBottom }, reach, {
                    skip: (el) => el === canvas || el === thumb || el.hasAttribute('data-glass-skip'),
                    onStale: () => {
                      view.dirty = true
                      gl.wake()
                    },
                  })
                },
              }
            : undefined,
          screenX: box.left + cx,
          screenY: box.top + h / 2,
        }
      },
      drawn: () => {
        if (!lensOn || 'glassMoving' in root.dataset) return
        root.dataset.glassMoving = ''
        if (input !== 'none' || press.x > 0.05) root.dataset.glassTraveling = ''
      },
      lost: () => {
        engine = null
        stopLens()
        wake()
      },
    }

    const usable = () => !locked && !liveCfg.disabled && liveCfg.state === 'idle'
    const localX = (e: PointerEvent) => e.clientX - root.getBoundingClientRect().left
    const onMove = (e: PointerEvent) => {
      if (input !== 'drag') return
      dragGoal = localX(e) - grab
      wake()
    }
    const onUp = (e: PointerEvent) => {
      if (input !== 'drag') return
      root.style.cursor = ''
      if (e.type === 'pointerup' && clamp(dragGoal, 0, travel) / travel >= liveCfg.threshold) commit()
      else input = 'none'
      wake()
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !usable()) return
      const at = localX(e)
      const left = pad + x.x
      if (at < left - 10 || at > left + d + 10) return
      nudged = true
      input = 'drag'
      grab = at - x.x
      dragGoal = x.x
      try {
        root.setPointerCapture(e.pointerId)
      } catch {}
      root.style.cursor = 'grabbing'
      startLens()
      wake()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!usable()) return
      const k = e.key
      const step = k === 'ArrowRight' || k === 'ArrowUp' ? 0.1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -0.1 : k === 'PageUp' ? 0.25 : k === 'PageDown' ? -0.25 : 0
      const holds = k === ' ' || k === 'Enter'
      if (!step && !holds && k !== 'Home' && k !== 'End') return
      e.preventDefault()
      if (input === 'drag' || (holds && e.repeat)) return
      nudged = true
      if (holds) {
        input = 'hold'
        hold = clamp(x.x / travel)
      } else {
        keyValue = k === 'Home' ? 0 : k === 'End' ? 1 : clamp((input === 'keys' ? keyValue : 0) + step)
        input = 'keys'
        if (keyValue >= 0.999) commit()
        else if (keyValue <= 0.001) input = 'none'
      }
      startLens()
      wake()
    }
    const letGo = () => {
      if (input !== 'hold' && input !== 'keys') return
      input = 'none'
      wake()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (input === 'hold' && (e.key === ' ' || e.key === 'Enter')) letGo()
    }

    controller = {
      unlock: () => {
        if (!locked) return
        arrived = false
        reopening = true
        input = 'none'
        wake()
      },
      wake: () => wake(),
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('keyup', onKeyUp)
    root.addEventListener('blur', letGo)
    const io = new IntersectionObserver(([entry]) => {
      view.visible = entry.isIntersecting
      if (view.visible) {
        startLens()
        view.dirty = true
        wake()
      }
    })
    io.observe(root)
    const ro = new ResizeObserver(() => {
      measure()
      write()
      if (lensOn) view.dirty = true
      wake()
    })
    ro.observe(root)
    const nudge = setInterval(() => {
      if (nudged || !liveCfg.hint || !usable() || input !== 'none' || !view.visible || reduced.matches || document.hidden) return
      x.v = 8 * d
      wake()
    }, HINT_EVERY)
    measure()
    write()
    engine?.add(view)

    return () => {
      alive = false
      engine?.remove(view)
      cancelAnimationFrame(raf)
      clearInterval(nudge)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      io.disconnect()
      ro.disconnect()
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('keyup', onKeyUp)
      root.removeEventListener('blur', letGo)
      root.style.cursor = ''
      delete root.dataset.glassMoving
      delete root.dataset.glassTraveling
      root.style.removeProperty('--glass-slide-ink')
      controller = null
    }
  })

  const text = () => (failed() ? (props.errorLabel ?? props.children) : props.children)
  const statusText = () => (state() === 'pending' ? (props.pendingLabel ?? '') : state() === 'success' ? (props.successLabel ?? '') : '')
  const centered = 'absolute flex items-center justify-center overflow-hidden px-2'
  const stacked = 'absolute inset-0 flex items-center justify-center opacity-0'

  return (
    <div
      ref={(el) => {
        rootEl = el
      }}
      role="slider"
      tabindex={props.disabled ? -1 : 0}
      aria-label={props.children}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={state() === 'idle' ? 0 : 100}
      aria-valuetext={statusText() || undefined}
      aria-busy={state() === 'pending' ? 'true' : undefined}
      aria-disabled={props.disabled || state() !== 'idle' ? 'true' : undefined}
      data-glass-host=""
      data-state={state()}
      data-disabled={props.disabled ? '' : undefined}
      class={`relative isolate block w-full cursor-grab touch-pan-y rounded-full font-medium whitespace-nowrap text-neutral-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 aria-disabled:cursor-default data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 dark:text-neutral-300 ${s().host} ${props.class}`}
    >
      <GlassStyles />
      <canvas
        ref={(el) => {
          canvasEl = el
        }}
        aria-hidden="true"
        style={{ position: 'absolute', 'z-index': 30, 'max-width': 'none', 'pointer-events': 'none', width: '0px', height: '0px' }}
      />
      <span aria-hidden="true" data-glass-slide="track" class="absolute inset-y-0 right-0 left-0">
        <span data-glass-slide="bed" class="absolute inset-x-0 -inset-y-2 rounded-full bg-black/[0.06] dark:bg-white/[0.1]" style={{ 'clip-path': REST }} />
        <span data-glass-slide="done" class={`absolute inset-0 rounded-full opacity-0 ${props.fillClass}`} />
        <span data-glass-slide="status" class="absolute top-0 right-full flex h-full items-center pr-3 text-neutral-900 opacity-0 dark:text-white">
          <For each={[lastStatus()]}>
            {(lbl) => (
              <span data-glass-in={touched() ? '' : undefined}>{lbl}</span>
            )}
          </For>
        </span>
      </span>
      <span aria-hidden="true" data-glass-slide="label" class={`${centered} inset-y-0 right-0 ${s().label} ${failed() ? 'text-red-600 dark:text-red-400' : ''}`}>
        {text()}
      </span>
      <span aria-hidden="true" data-glass-slide="fill" class={`absolute -top-1 left-1 overflow-hidden rounded-full ${s().fill} ${props.fillClass}`} style={{ 'clip-path': REST }}>
        <span data-glass-slide="copy" class={`${centered} top-1 ${s().copy}`}>
          {text()}
        </span>
      </span>
      <span
        aria-hidden="true"
        data-glass-slide="thumb"
        class={`absolute top-1 left-1 z-40 flex items-center justify-center text-neutral-900 transition-colors duration-150 ${props.fill ? '[[data-glass-traveling]_&]:text-[color:var(--glass-slide-ink)]' : 'dark:[[data-glass-traveling]_&]:text-white'} [&_svg]:shrink-0 ${s().thumb}`}
      >
        <span
          data-glass-slide="disc"
          class="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.14),0_3px_8px_rgb(0_0_0/0.12)] [[data-glass-moving]_&]:opacity-0"
        />
        <span data-glass-slide="mark" class={`relative flex ${props.mirror ? MARK_GLOW : ''}`}>
          <span data-glass-slide="glyph" class="flex">
            {props.icon ?? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25">
                <path data-glass-slide="ink" d={markPath(0)} />
              </svg>
            )}
          </span>
        </span>
        <span data-glass-slide="spinner" class={stacked}>
          <Spinner />
        </span>
        <span data-glass-slide="check" class={`${stacked} text-[color:var(--glass-slide-ink)]`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width={props.icon ? 2.5 : 2.25}>
            <path d={markPath(1)} />
          </svg>
        </span>
      </span>
      <span role="status" class="sr-only">
        {statusText() || (failed() ? (props.errorLabel ?? '') : '')}
      </span>
    </div>
  )
}

export default GlassSlideToConfirm
