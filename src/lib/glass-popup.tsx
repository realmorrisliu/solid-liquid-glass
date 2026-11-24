// GlassPopup — gooey / morphing popup surface shared with its trigger.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import type { JSX } from '@solidjs/web'
import { createContext, createEffect, For, merge, onCleanup } from 'solid-js'

import { drawAround, drawDom } from './dom-snapshot'
import {
  GLOW,
  GLOW_SMALL,
  GOOEY,
  MORPH,
  MORPH_GLOW,
  MORPH_GLOW_SMALL,
  SPRINGS,
  clamp,
  getGlassEngine,
  lerp,
  rgbCss,
  smooth,
  stepSpring,
  surfaceColorOf,
  type GlassEngine,
  type GlassLens,
  type GlassView,
  type Rgb,
  type Spring,
} from './engine'
import { ensureStyleOnce, GlassStyles } from './glass-layer'

const DESIGN_HEIGHT = 120
const TINT = 0.6
const CARD = { tint: 0.7, blur: 5, bendCurve: 9.75, bendDepth: 1.35 }
const FILLED = 0.92
const LINE = { alpha: 0.6, darkAlpha: 0.25, width: 1.3 }
const TRIGGER_PAD = 16
const PAD = 28
const PAD_BOTTOM = 56
const TUNE = GOOEY
const ITEMS = ':is([role=option],[role=menuitem],[data-glass-item])'
const PICKS = ':is([role=option],[role=menuitem],[data-glass-item],[data-glass-pick])'
const LIST = ':is([role=listbox],[role=menu],[data-glass-list])'
const RIDE = ['--glass-ride-x', '--glass-ride-y', '--glass-zoom', '--glass-clip', '--glass-soft']
const ATTACH = { omega: 28, zeta: 1 }
const LET_GO = { omega: 16, zeta: 1 }
const NEAR_EDGE = 0.3
const PRESS_SCALE = 1.08
const HOVER_SCALE = 1.04
const HOVER_GROW = 0.08
const MAX_GROW_PX = 6
const SETTLE = 0.16
const SETTLE_GLOW = 0.7
const CONTENT_GLOW = { lift: 0.55, bloom: 7, alpha: 0.65 }
const LETTER = { duration: 0.4, gap: 0.01, blur: 10 }
const MAX_STRETCH = 1.06

const CSS = `
[data-glass-popup]{isolation:isolate;overflow:visible!important;background:transparent}
[data-glass-popup][data-glass-off]{background:rgb(255 255 255 / .86);border:1px solid rgb(0 0 0 / .1);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
:is(.dark,[data-theme=dark]) [data-glass-popup][data-glass-off]{background:rgb(23 23 23 / .86);border-color:rgb(255 255 255 / .14)}
[data-glass-popup] :is([role=option],[role=menuitem],[data-glass-item]){transition:background-color .12s ease}
[data-glass-popup]:not([data-glass-off]) :is([role=listbox],[role=menu],[data-glass-list]){opacity:var(--glass-out,0)}
[data-glass-popup]:not([data-glass-off]) :is([role=option],[role=menuitem],[data-glass-item]){--glass-in:clamp(0,calc((var(--glass-items,0) - var(--glass-i,0) * var(--glass-gap)) / var(--glass-fade)),1);opacity:calc(var(--glass-base,1) * var(--glass-in));translate:0 calc((1 - var(--glass-in)) * 6px)}
[data-glass-popup] :is([role=option],[role=menuitem],[data-glass-item])[data-disabled]{--glass-base:.4}
[data-glass-popup][data-glass-arriving] :is([role=listbox],[role=menu],[data-glass-list]){overflow:hidden}
[data-glass-popup][data-glass-off] :is([role=listbox],[role=menu],[data-glass-list]){transition:opacity .16s ease}
[data-glass-popup][data-glass-off]:is([data-starting-style],[data-ending-style]) :is([role=listbox],[role=menu],[data-glass-list]){opacity:0}
[data-glass-anchor]>:not(canvas){translate:0 var(--glass-sway-y,0px);scale:var(--glass-sway-sx,1) var(--glass-sway-sy,1);filter:var(--glass-lit,none)}
[data-glass-popup]:not([data-glass-off]) :is([role=listbox],[role=menu],[data-glass-list]){translate:var(--glass-ride-x,0px) var(--glass-ride-y,0px);scale:var(--glass-zoom,1);clip-path:var(--glass-clip,none);filter:var(--glass-lit,) var(--glass-soft,)}
[data-glass-anchor][data-glass-morphing]>:not(canvas){filter:var(--glass-lit,) blur(var(--glass-label-blur,0px)) opacity(var(--glass-label,1))}
[data-glass-hold]{position:absolute;width:0;height:0;opacity:1;pointer-events:none}
[data-glass-card-shadow]{position:absolute;inset:0;z-index:-2;border-radius:inherit;pointer-events:none;opacity:0;box-shadow:0 20px 48px oklch(0 0 0 / .105),0 3px 10px oklch(0 0 0 / .045)}
[data-glass-popup][data-glass-tone=dark]>[data-glass-card-shadow]{box-shadow:0 22px 55px oklch(0 0 0 / .34)}
[data-glass-popup][data-glass-off]>[data-glass-card-shadow]{opacity:1!important}
[data-glass-anchor][data-glass-label=in] [data-glass-char]{animation:glass-char ${LETTER.duration}s ease-out both;animation-delay:calc(var(--glass-at,0s) + var(--glass-c,0) * ${LETTER.gap}s)}
[data-glass-anchor][data-glass-morphing] [data-glass-char]{opacity:0}
@keyframes glass-char{from{opacity:0;filter:blur(${LETTER.blur}px) brightness(0)}to{opacity:1;filter:blur(0) brightness(1)}}
@keyframes glass-hold{to{opacity:0}}
[data-glass-popup]:not([data-glass-off])[data-ending-style]>[data-glass-hold]{animation:glass-hold 60s linear forwards}
@media (prefers-reduced-motion:reduce){
[data-glass-char]{opacity:1!important;animation:none!important}
[data-glass-popup]:not([data-glass-off])[data-ending-style]>[data-glass-hold]{animation:none}
}
@media (prefers-reduced-transparency:reduce){
[data-glass-popup][data-glass-off]{background:rgb(255 255 255/.98)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
:is(.dark,[data-theme=dark]) [data-glass-popup][data-glass-off]{background:rgb(28 28 30/.98)!important}
}
`

type Box = { L: number; T: number; W: number; H: number }
type Page = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; key: string; at: number; stale: boolean; fill: string }

const newPage = (): Page => ({ canvas: document.createElement('canvas'), ctx: null, key: '', at: 0, stale: true, fill: '' })

function createMorph(matchWidth: boolean, morphs: boolean, from: GlassPopupFrom) {
  const way = from === 'bottom' ? -1 : 1
  let engine: GlassEngine | null = null
  let host: HTMLElement | null = null
  let content: HTMLElement | null = null
  let holdEl: HTMLElement | null = null
  let triggerView: GlassView | null = null
  let panelView: GlassView | null = null

  const open: Spring = { x: 0, v: 0 }
  const bridge: Spring = { x: 0, v: 0 }
  const recoil: Spring = { x: 0, v: 0 }
  const cross: Spring = { x: 0, v: 0 }
  const calm: Spring = { x: 0, v: 0 }
  let waited = 0
  const drop: Spring = { x: 0, v: 0 }
  let lingered = 0
  const swPress: Spring = { x: 0, v: 0 }
  const swX: Spring = { x: 0, v: 0 }
  const swY: Spring = { x: 0, v: 0 }
  const swScale: Spring = { x: 1, v: 0 }
  const glow: Spring = { x: 0, v: 0 }
  const glowSpread: Spring = { x: 0, v: 0 }
  const glowAt = { x: 0, y: 0 }
  let glowHold = 0
  let glowWide = false
  let glowList = false
  let label: '' | 'in' = ''
  const setLabel = (next: typeof label) => {
    if (label === next) return
    label = next
    if (!host) return
    if (next) host.dataset.glassLabel = next
    else delete host.dataset.glassLabel
  }
  let glowSmall = 0
  const smallness = (width: number, height: number) => 1 - smooth(2, 2.4, width / Math.max(height, 1))
  const glowTune = (): typeof GLOW => {
    const wideSet = morphs ? MORPH_GLOW : GLOW
    const smallSet = morphs ? MORPH_GLOW_SMALL : GLOW_SMALL
    if (glowSmall <= 0) return wideSet
    if (glowSmall >= 1) return smallSet
    const mixed = { ...wideSet }
    for (const key of Object.keys(mixed) as (keyof typeof GLOW)[]) mixed[key] = lerp(wideSet[key], smallSet[key], glowSmall)
    return mixed
  }
  let glowLevel = 0
  let hovered = false
  let pressed = false
  let settle = 0
  let wasShut = true
  let moving = false
  let joined = false
  let wasJoined = false
  let pushed = false
  let snapped = false
  let rec: { t: number; open: number; bridge: number; rc: number; reveal: number; snapped: boolean; cross: number; calm: number; drop: number }[] = []
  let recT = 0
  let rewind: number | null = null
  let panelDrawn = false
  let ready = false
  let dir = 1
  let surface: Rgb = [1, 1, 1]
  let tint: Rgb = [1, 1, 1]
  let cover = TINT
  let cardCover = CARD.tint
  let panelRadius = 24

  const isOpen = () => !!content && content.hasAttribute('data-open') && !content.hasAttribute('data-ending-style')
  const release = () => holdEl?.getAnimations().forEach((a) => a.finish())
  let reveal = 0
  let out = 0
  let lastPlace = -1
  let placed = -1
  const stepItems = (goal: number, dt: number, still: boolean, fixed?: number) => {
    if (!content) return false
    if (morphs) {
      const follows = still ? goal : smooth(0, Math.max(MORPH.contentFade, 0.01), clamp(calm.x))
      out = !still && !goal && MORPH.closeSoft > 0.5 ? Math.min(follows, Math.max(0, out - dt / Math.max(MORPH.closeFade, 0.01))) : follows
      reveal = out > 0 ? 99 : 0
    } else if (fixed !== undefined) {
      reveal = fixed
      out = 1
    } else if (still) {
      reveal = goal ? 99 : 0
      out = goal
    } else if (goal) {
      out = 1
      if (open.x > TUNE.itemsAt) reveal = Math.min(reveal + dt, 99)
    } else {
      out = Math.max(0, out - dt / 0.12)
      if (!out) reveal = 0
    }
    const st = content.style
    const put = (name: string, value: string) => {
      if (st.getPropertyValue(name) !== value) st.setProperty(name, value)
    }
    const items = content.querySelectorAll<HTMLElement>(ITEMS)
    const count = items.length
    if (reveal === 0) lastPlace = -1
    else if (lastPlace < 0 || count !== placed) {
      lastPlace = 0
      placed = count
      for (const el of items) lastPlace = Math.max(lastPlace, parseFloat(el.style.getPropertyValue('--glass-i') || getComputedStyle(el).getPropertyValue('--glass-i')) || 0)
    }
    const fade = Math.max(TUNE.itemsFade, 0.01)
    put('--glass-items', (lastPlace < 0 ? reveal : Math.min(reveal, Math.max(lastPlace, count) * TUNE.itemsGap + fade)).toFixed(3))
    put('--glass-out', out.toFixed(3))
    put('--glass-gap', String(TUNE.itemsGap))
    put('--glass-fade', String(fade))
    const arriving = !morphs && (!!goal || fixed !== undefined) && reveal < count * TUNE.itemsGap + TUNE.itemsFade
    if (arriving !== 'glassArriving' in content.dataset) {
      if (arriving) content.dataset.glassArriving = ''
      else delete content.dataset.glassArriving
    }
    return morphs ? false : goal ? arriving : out > 0
  }

  const written = new WeakMap<HTMLElement, Record<string, string>>()
  const write = (el: HTMLElement, name: string, value: string) => {
    let last = written.get(el)
    if (!last) written.set(el, (last = {}))
    if (last[name] === value) return
    last[name] = value
    el.style.setProperty(name, value)
  }
  let listEl: HTMLElement | null = null
  const listOf = () => (listEl?.isConnected && content?.contains(listEl) ? listEl : (listEl = content?.querySelector<HTMLElement>(LIST) ?? null))
  const panelRect = () => {
    const c = content?.getBoundingClientRect()
    return c && c.width > 2 && c.height > 2 ? c : null
  }
  let rebounding = false
  const rebound = () => {
    if (!morphs || !host || MORPH.closeSoft > 0.5) return
    const c = panelRect()
    const a = host.getBoundingClientRect()
    const from = c ? c.top + c.height / 2 - (a.top + a.height / 2) : 0
    recoil.x = 0
    recoil.v = ((from < -4 ? 1 : -1) * MORPH.kick * MORPH.closeKick) / Math.max(MORPH.weight, 0.1)
    rebounding = recoil.v !== 0
  }
  const dirty = () => {
    if (triggerView) triggerView.dirty = true
    if (panelView) panelView.dirty = true
    engine?.wake()
  }

  const light = (x?: number, y?: number, gain = 1, inList = false, wide = !inList && !isOpen()) => {
    if (!host) return
    const r = host.getBoundingClientRect()
    if (glow.x < 0.08) glowSpread.x = glowSpread.v = 0
    const reach = inList ? Infinity : 0.5
    glowAt.x = x === undefined ? 0 : clamp(x - (r.left + r.width / 2), -r.width * reach, r.width * reach)
    glowAt.y = y === undefined ? 0 : clamp(y - (r.top + r.height / 2), -r.height * reach, r.height * reach)
    glowSmall = smallness(host.offsetWidth, host.offsetHeight)
    const tune = glowTune()
    glowLevel = Math.min(Math.max(glow.x, 0) + gain * (inList ? tune.select : 1), tune.stack)
    glowWide = wide
    glowList = inList
    glowHold = tune.hold
  }

  const stepGlow = (dt: number) => {
    const opening = glowWide && isOpen()
    const tune = glowTune()
    const on = opening ? open.x < tune.coverUntil : pressed || glowHold > 0
    glowHold = Math.max(0, glowHold - dt)
    const a = stepSpring(glow, on ? glowLevel : 0, { omega: on ? tune.riseSpeed : opening ? tune.coverFadeSpeed : tune.fadeSpeed, zeta: 1 }, dt)
    const b = stepSpring(glowSpread, on || glow.x > 0.004 ? 1 : 0, { omega: tune.spreadSpeed, zeta: 1 }, dt)
    return glowHold > 0 || a || (b && glow.x > 0.004)
  }

  const maxScale = () => 1 + (2 * MAX_GROW_PX) / Math.max(host?.offsetWidth ?? 1, 1)
  const stepSwell = (dt: number, still: boolean) => {
    if (!host) return false
    const shut = !isOpen() && open.x < 0.004
    if (still) {
      swPress.x = swX.x = swY.x = swPress.v = swX.v = swY.v = swScale.v = 0
      swScale.x = 1
      glow.x = glow.v = glowSpread.x = glowSpread.v = glowHold = 0
      host.style.scale = ''
      settle = 0
      wasShut = shut
      setLabel('')
      return false
    }
    if (shut && !wasShut) {
      settle = SETTLE
      if (morphs && MORPH.closeSoft <= 0.5 && glow.x < SETTLE_GLOW) light(undefined, undefined, SETTLE_GLOW - Math.max(glow.x, 0), false, false)
      if (morphs) setLabel('in')
    }
    if (!shut) setLabel('')
    wasShut = shut
    const greeting = settle > 0
    settle = Math.max(0, settle - dt)
    const hov = (hovered || greeting) && shut ? 1 : 0
    const down = pressed && shut
    const target = down ? Math.min(PRESS_SCALE, maxScale()) : hov ? Math.min(HOVER_SCALE, maxScale()) : 1
    const a = stepSpring(swPress, down ? 1 : 0, SPRINGS.press, dt)
    const b = stepSpring(swX, hov, SPRINGS.hoverX, dt)
    const c = stepSpring(swY, hov, SPRINGS.hoverY, dt)
    const d = stepSpring(swScale, target, SPRINGS.press, dt)
    host.style.scale = swScale.x === 1 ? '' : swScale.x.toFixed(4)
    const e = stepGlow(dt)
    return a || b || c || d || e || greeting
  }

  const surfaceGlass = () => ({ frost: cardCover, blur: CARD.blur, bendCurve: CARD.bendCurve, bendDepth: CARD.bendDepth, borderAlpha: tint[0] > 0.5 ? LINE.alpha : LINE.darkAlpha, borderWidth: LINE.width })

  const measure = () => {
    if (!host) return null
    const r = host.getBoundingClientRect()
    const sc = Math.max(0.5, Number(swScale.x.toFixed(4)))
    const a = sc === 1 ? r : new DOMRect(r.left + (r.width - host.offsetWidth) / 2, r.top + (r.height - host.offsetHeight) / 2, host.offsetWidth, host.offsetHeight)
    if (a.width < 2 || a.height < 2) return null
    glowSmall = smallness(a.width, a.height)
    const sk = lerp(1, Math.min(PRESS_SCALE, maxScale()), clamp(swPress.x, -0.12, 1.15))
    const grow = a.height * HOVER_GROW
    const c = panelRect()
    const b = clamp(bridge.x, 0, 1.1)
    const thrown = Math.round(recoil.x * 128) / 128
    const rc = morphs ? 0 : thrown
    if (c) dir = c.top < a.top ? -1 : 1
    const hold = c ? b * smooth(0, 0.6, clamp(open.x)) : 0
    const body = {
      cx: a.left + a.width / 2,
      cy: a.top + a.height / 2 + dir * (TUNE.triggerSag * hold - TUNE.triggerJolt * rc) + (morphs ? way * MORPH.throw * thrown : 0),
      hx: (a.width / 2) * sk + grow * swX.x - 1.5 * hold + 3.2 * rc,
      hy: (a.height / 2) * sk + grow * swY.x + hold - 2 * rc,
    }
    let blob: GlassLens['blob']
    let out = 0
    joined = false
    if (c && !morphs) {
      const y = clamp(open.x, -0.04, 1.08)
      const t = clamp(y)
      const edge = dir < 0 ? a.top : a.bottom
      const panelNear = dir < 0 ? c.bottom : c.top
      const panelFar = dir < 0 ? c.top : c.bottom
      const jolt = dir * TUNE.panelJolt * rc * smooth(0, 0.35, t)
      const near = lerp(edge - dir * 6, panelNear - dir * TUNE.neckPull * b, smooth(0, NEAR_EDGE, t)) + jolt
      const far = lerp(edge - dir, panelFar, y) + jolt * 0.5
      const hx = lerp(a.width * 0.3, c.width / 2, y) * (1 - 0.012 * rc)
      const hy = Math.max(Math.abs(far - near) / 2, 0.5)
      out = smooth(0, 48, dir * (far - edge))
      const small = 1 - smooth(2, 2.4, a.width / a.height)
      const k = Math.max(lerp(TUNE.neckSoftness, TUNE.smallNeckSoftness, small) * b * smooth(0, 90, dir * (far - edge)), 0.05)
      joined = k > 2 * Math.max(dir * (near - (body.cy + dir * body.hy)), 0)
      blob = {
        x: lerp(body.cx, c.left + c.width / 2, t) - body.cx,
        y: (near + far) / 2 - body.cy,
        hx,
        hy,
        r: Math.min(lerp(panelRadius, panelRadius * 1.8, b), hx, hy),
        k,
        neck: { x: 0, w: Math.max(a.width * lerp(0.2, 0.6, clamp(b)), small * a.height * lerp(TUNE.smallNeck, TUNE.smallNeckWide, clamp(b))) },
        fade: { amount: clamp(TUNE.smallEdgeFade) * small, reach: TUNE.smallEdgeReach },
        material: surfaceGlass(),
      }
    }
    let morph: { cx: number; cy: number; hx: number; hy: number; r: number; zoomX: number; zoomY: number; list: Box | null } | undefined
    if (c && morphs && content) {
      const tall = Math.abs(c.height - a.height) >= Math.abs(c.width - a.width)
      const lead = open.x
      const follow = cross.x
      const lean = clamp(1 - MORPH.pinch * (lead - follow), 0.5, 1.3)
      const hx = Math.max(lerp(lerp(Math.min(body.hx, body.hy), body.hx, clamp(MORPH.seed)), c.width / 2, tall ? follow : lead) * (tall ? lean : 1), 1)
      const hy = Math.max(lerp(body.hy, c.height / 2, tall ? lead : follow) * (tall ? 1 : lean), 1)
      const cx = lerp(body.cx, c.left + c.width / 2, tall ? follow : lead)
      const cy = lerp(body.cy, c.top + c.height / 2, tall ? lead : follow) - way * MORPH.drop * (clamp(lead) - Math.min(drop.x, clamp(lead)))
      const r = Math.min(lerp(Math.min(hx, hy), panelRadius, smooth(Math.min(MORPH.cornersFrom, 0.99), 1, clamp(calm.x))), hx, hy)
      const list = listOf()
      out = smooth(0, 48, 2 * Math.max(hx - body.hx, hy - body.hy))
      blob = { x: cx - body.cx, y: cy - body.cy, hx, hy, r, k: MORPH.gooey > 0.5 ? Math.max(MORPH.softness, 0.05) : 0.05, material: surfaceGlass() }
      const fx = hx / (c.width / 2)
      const fy = hy / (c.height / 2)
      const even = Math.sqrt(fx * fy)
      morph = {
        cx,
        cy,
        hx,
        hy,
        r,
        zoomX: lerp(1, clamp(even * clamp(fx / even, 1 / MAX_STRETCH, MAX_STRETCH), 0.1, 1.5), clamp(MORPH.zoom)),
        zoomY: lerp(1, clamp(even * clamp(fy / even, 1 / MAX_STRETCH, MAX_STRETCH), 0.1, 1.5), clamp(MORPH.zoom)),
        list: list && { L: c.left + content.clientLeft + list.offsetLeft, T: c.top + content.clientTop + list.offsetTop, W: list.offsetWidth, H: list.offsetHeight },
      }
    }
    const t = clamp(open.x)
    const card = !c ? 0 : morphs ? smooth(MORPH.frostFrom, Math.max(MORPH.frostTo, MORPH.frostFrom + 0.01), clamp(calm.x)) : (1 - smooth(0, 0.35, clamp(b))) * smooth(0.35, 0.8, t)
    const sway = { y: body.cy - (a.top + a.height / 2), sx: 1 + (3.2 * rc - 1.5 * hold) / (a.width / 2), sy: 1 + (hold - 2 * rc) / (a.height / 2) }
    const ride = c ? 0.75 * dir * TUNE.panelJolt * rc * smooth(0, 0.35, clamp(open.x)) : 0
    const tune = glowTune()
    const wide = glowWide && blob && tune.cover > 0 ? smooth(0, 1, t) : 0
    const spreading = clamp(glowSpread.x)
    const carried = morphs && glowList && MORPH.closeSoft > 0.5 && !isOpen()
    const home = carried ? 1 - smooth(0, 1, t) : 0
    const reach = a.height * sc * (glowList ? tune.selectReach + tune.selectSpread * spreading : tune.reach + tune.spread * spreading)
    const lit =
      glow.x > 0.004
        ? {
            x: lerp(lerp(glowAt.x, 0, home), blob?.x ?? 0, wide),
            y: lerp(lerp(glowAt.y - sway.y, 0, home), blob?.y ?? 0, wide),
            r: lerp(
              lerp(reach, Math.min(reach, a.height * sc * MORPH.closeGlowReach), home),
              Math.max(reach, 2 * tune.cover * Math.hypot(blob?.hx ?? 0, blob?.hy ?? 0)),
              wide,
            ),
            amount: Math.max(0, glow.x) * tune.amount * (glowList && !carried ? smooth(Math.min(tune.selectLeave, 0.99), 1, t) : 1),
            blob: glowWide || glowList ? 1 : 0,
            spill: tune.halo,
          }
        : undefined
    const edge = { hostLeft: host.clientLeft, hostTop: host.clientTop, left: content?.clientLeft ?? 0, top: content?.clientTop ?? 0 }
    const onPanel = !!morph && panelDrawn && (t >= 0.004 || isOpen())
    const dpr = window.devicePixelRatio || 1
    const snap = (v: number) => Math.round(v * dpr) / dpr
    const seam = { left: snap(a.left), top: snap(a.top), right: snap(a.right), bottom: snap(a.bottom) }
    return { a, c, sc, seam, body, blob, t, card, out, sway, ride, lit, edge, morph, onPanel, parted: morphs ? !!blob && card >= 0.999 : card > 0 && !joined }
  }

  let measured: ReturnType<typeof measure> = null
  let fresh = false
  const shape = () => {
    if (!fresh) {
      fresh = true
      measured = measure()
      queueMicrotask(() => (fresh = false))
    }
    return measured
  }

  const carry = (s: NonNullable<ReturnType<typeof shape>>) => {
    const set = (el: HTMLElement | null, name: string, value: string, rest: string) => {
      if (!el) return
      if (value === rest) el.style.removeProperty(name)
      else if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value)
    }
    set(host, '--glass-sway-y', `${s.sway.y.toFixed(2)}px`, '0.00px')
    set(host, '--glass-sway-sx', s.sway.sx.toFixed(4), '1.0000')
    set(host, '--glass-sway-sy', s.sway.sy.toFixed(4), '1.0000')
    if (!morphs) return set(content, '--glass-ride-y', `${s.ride.toFixed(2)}px`, '0.00px')
    const gone = smooth(0, MORPH.labelOut, s.t)
    if (host && gone > 0 !== 'glassMorphing' in host.dataset) {
      if (gone > 0) host.dataset.glassMorphing = ''
      else delete host.dataset.glassMorphing
    }
    set(host, '--glass-label', (1 - gone).toFixed(3), '1.000')
    set(host, '--glass-label-blur', `${(MORPH.labelBlur * gone).toFixed(2)}px`, '0.00px')
    const m = s.morph
    const l = m?.list
    const litAt = (x: number, y: number) => {
      if (!s.lit) return ''
      const d = Math.hypot(x - s.lit.x, y - s.lit.y) / Math.max(s.lit.r, 1)
      const a = s.lit.amount * Math.exp(-d * d)
      if (a < 0.02) return ''
      return `brightness(${(1 + a * CONTENT_GLOW.lift).toFixed(3)}) drop-shadow(0 0 ${(CONTENT_GLOW.bloom * Math.min(a, 1)).toFixed(1)}px rgb(255 255 255 / ${(CONTENT_GLOW.alpha * Math.min(a / 2, 1)).toFixed(3)}))`
    }
    set(host, '--glass-lit', litAt(0, 0), '')
    set(content, '--glass-lit', m && s.lit?.blob ? litAt(m.cx - s.body.cx, m.cy - s.body.cy) : '', '')
    if (!m || !l || !s.c || (Math.abs(open.x - 1) < 1e-3 && Math.abs(cross.x - 1) < 1e-3 && calm.x > 0.999 && drop.x > 0.9995)) {
      for (const name of RIDE) set(content, name, '', '')
      return
    }
    const kx = m.zoomX
    const ky = m.zoomY
    const lx = l.L + l.W / 2
    const ly = l.T + l.H / 2
    const x = m.cx + (lx - (s.c.left + s.c.width / 2)) * kx
    const y = m.cy + (ly - (s.c.top + s.c.height / 2)) * ky
    const inset = [l.H / 2 + (m.cy - m.hy - y) / ky, l.W / 2 - (m.cx + m.hx - x) / kx, l.H / 2 - (m.cy + m.hy - y) / ky, l.W / 2 + (m.cx - m.hx - x) / kx]
    const soft = MORPH.contentBlur * (1 - smooth(0, 1, clamp(calm.x)))
    set(content, '--glass-ride-x', `${(x - lx).toFixed(2)}px`, '')
    set(content, '--glass-ride-y', `${(y - ly).toFixed(2)}px`, '')
    set(content, '--glass-zoom', `${kx.toFixed(4)} ${ky.toFixed(4)}`, '')
    set(content, '--glass-clip', `inset(${inset.map((v) => `${v.toFixed(1)}px`).join(' ')} round ${(m.r / kx).toFixed(1)}px / ${(m.r / ky).toFixed(1)}px)`, '')
    set(content, '--glass-soft', soft > 0.05 ? `blur(${soft.toFixed(2)}px)` : '', '')
  }

  const lensFor = (box: Box, s: NonNullable<ReturnType<typeof shape>>, page: Page, repaint: () => void, card = 0): Omit<GlassLens, 'left' | 'top'> => {
    const unit = (s.a.height * s.sc) / DESIGN_HEIGHT
    return {
      width: box.W,
      height: box.H,
      unit,
      cx: s.body.cx - box.L,
      cy: s.body.cy - box.T,
      hx: s.body.hx,
      hy: s.body.hy,
      radius: 999,
      bodyX: 0,
      blob: s.blob,
      bevel: DESIGN_HEIGHT * 0.42,
      shadow: 0.12 * lerp(0.55, 1, s.t),
      shadowSoftness: 34 * lerp(0.6, 1, s.t),
      shadowOffset: 22 * lerp(0.5, 1, s.t),
      strength: 1 - card,
      tune: { bendCurve: lerp(1.6, CARD.bendCurve, card), bendDepth: lerp(1, CARD.bendDepth, card), fresnel: 1 - card },
      color: tint,
      border: card > 0 ? [1, 1, 1] : undefined,
      borderAlpha: card > 0 ? card * (tint[0] > 0.5 ? LINE.alpha : LINE.darkAlpha) : undefined,
      borderWidth: card > 0 ? LINE.width : undefined,
      surface,
      edgeClear: 0.2,
      cursorLight: card < 0.5,
      glow: s.lit && (s.blob && !s.parted && s.lit.blob ? { ...s.lit, halo: { around: 'blob' as const, amount: s.out * s.lit.spill } } : s.lit),
      refraction: {
        paint: (back) => {
          const fill = rgbCss(surface)
          const recoloured = fill !== page.fill
          page.fill = fill
          back.fillStyle = fill
          back.fillRect(0, 0, box.W, box.H)
          const target = back.canvas
          const key = `${target.width}:${target.height}:${box.L}:${box.T}:${Math.round(scrollX)}:${Math.round(scrollY)}`
          const now = performance.now()
          if (!page.ctx) page.ctx = page.canvas.getContext('2d')
          const again = !!page.ctx && (page.stale || key !== page.key || (!moving && now - page.at > 120))
          if (page.ctx && again) {
            page.stale = false
            page.key = key
            page.at = now
            if (page.canvas.width !== target.width || page.canvas.height !== target.height) {
              page.canvas.width = target.width
              page.canvas.height = target.height
            }
            page.ctx.setTransform(1, 0, 0, 1, 0, 0)
            page.ctx.clearRect(0, 0, target.width, target.height)
            page.ctx.setTransform(back.getTransform())
            drawDom(page.ctx, document.body, {
              origin: { left: box.L, top: box.T },
              region: { left: box.L, top: box.T, right: box.L + box.W, bottom: box.T + box.H },
              skip: (el) => el === host || el === content || el.hasAttribute('data-glass-skip'),
              onStale: () => {
                page.stale = true
                repaint()
              },
            })
          }
          back.save()
          back.setTransform(1, 0, 0, 1, 0, 0)
          back.drawImage(page.canvas, 0, 0)
          back.restore()
          return again || recoloured
        },
        refract: 44,
        magnify: 0,
        dispersion: lerp(0.12, 0, card),
        blurCenter: 0.35,
        blurEdge: 2.2,
        frost: lerp(cover, cardCover, card),
        blur: CARD.blur * card,
      },
      screenX: s.body.cx,
      screenY: s.body.cy,
    }
  }

  const readColours = () => {
    if (!host || !engine) return
    const s = engine.resolveColor(surfaceColorOf(host.parentElement))
    surface = [s[0], s[1], s[2]]
    let light = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2] > 0.5
    tint = light ? [1, 1, 1] : [0, 0, 0]
    cover = TINT
    cardCover = CARD.tint
    if ('glassFill' in host.dataset) {
      const had = 'glassReady' in host.dataset
      if (had) delete host.dataset.glassReady
      const fill = engine.resolveColor(getComputedStyle(host).backgroundColor)
      if (had) host.dataset.glassReady = ''
      if (fill[3] > 0.02) {
        tint = [fill[0], fill[1], fill[2]]
        cover = 1
        cardCover = FILLED
        light = 0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2] > 0.5
      }
    }
    const tone = light ? 'light' : 'dark'
    if (host.dataset.glassTone !== tone) host.dataset.glassTone = tone
    if (content) {
      if (content.dataset.glassTone !== tone) content.dataset.glassTone = tone
      panelRadius = parseFloat(getComputedStyle(content).borderTopLeftRadius) || 24
      const width = `${host.offsetWidth}px`
      if (matchWidth && content.style.width !== width) content.style.width = width
    }
  }

  const setTrigger = (canvas: HTMLCanvasElement | null) => {
    const el = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    engine = getGlassEngine()
    if (!canvas || !el || !ctx || !engine) return () => {}
    const e = engine
    host = el
    el.dataset.glassAnchor = ''
    const page = newPage()
    const pages = [page]
    const advance = (dt: number, still: boolean): boolean => {
      const goal = isOpen() ? 1 : 0
      const live = !!panelRect()
      if (still) {
        open.x = cross.x = calm.x = drop.x = goal
        open.v = cross.v = calm.v = drop.v = bridge.x = bridge.v = recoil.x = recoil.v = 0
        rebounding = false
        stepItems(goal, dt, true)
        rec = []
        rewind = null
        if (!goal) release()
        return (moving = false)
      }
      if (goal && open.x === 0 && !pushed) {
        if (!pressed && !glowHold && glow.x < 0.08) light(undefined, undefined, 1, false, true)
        for (const p of [...pages, panelPage]) if (p) p.stale = true
        rec = []
        recT = 0
      }
      if (goal) (lingered = 0), (rebounding = false)
      else if (morphs && rewind === null && open.x > 0.004 && lingered < MORPH.closeDelay) {
        lingered += dt
        return (moving = true)
      }
      const soft = morphs && MORPH.closeSoft > 0.5
      if (!goal && rewind === null && rec.length > 1 && open.x > 0.004 && !soft) {
        const shown = (content?.querySelectorAll(ITEMS).length ?? 0) * TUNE.itemsGap + TUNE.itemsFade
        let i = rec.length - 1
        const rested = (f: (typeof rec)[number]) =>
          morphs
            ? Math.abs(f.open - 1) < 0.012 && Math.abs(f.cross - 1) < 0.012 && f.calm > 0.95 && Math.abs(f.rc) < 0.01 && f.drop > 0.995
            : f.open >= 0.995 && f.bridge <= 0.02 && f.reveal >= shown
        while (i > 0 && rested(rec[i])) i--
        rewind = rec[Math.min(i + 1, rec.length - 1)].t
      }
      if (goal && rewind !== null) {
        const at = rewind
        rec = rec.filter((f) => f.t <= at)
        recT = at
        rewind = null
        open.v = cross.v = calm.v = bridge.v = recoil.v = 0
        pushed = open.x > 0.02
      }
      if (rewind !== null) {
        rewind -= dt * (morphs ? MORPH.closePace : TUNE.closeSpeed / Math.max(TUNE.openSpeed, 0.1))
        if (rewind <= 0) {
          rewind = null
          rec = []
          open.x = open.v = cross.x = cross.v = calm.x = calm.v = drop.x = drop.v = bridge.x = bridge.v = recoil.x = recoil.v = 0
          pushed = snapped = wasJoined = false
          stepItems(0, dt, true)
          rebound()
          release()
          dirty()
          return (moving = rebounding)
        }
        let j = rec.length - 2
        while (j > 0 && rec[j].t > rewind) j--
        const f0 = rec[j]
        const f1 = rec[j + 1]
        const u = clamp((rewind - f0.t) / Math.max(f1.t - f0.t, 1e-4))
        open.x = lerp(f0.open, f1.open, u)
        bridge.x = lerp(f0.bridge, f1.bridge, u)
        recoil.x = lerp(f0.rc, f1.rc, u)
        cross.x = lerp(f0.cross, f1.cross, u)
        calm.x = lerp(f0.calm, f1.calm, u)
        drop.x = lerp(f0.drop, f1.drop, u)
        drop.v = 0
        open.v = cross.v = calm.v = bridge.v = recoil.v = 0
        snapped = f0.snapped
        wasJoined = joined
        stepItems(0, dt, false, lerp(f0.reveal, f1.reveal, u))
        return (moving = true)
      }
      if (morphs) {
        const back = { omega: soft ? MORPH.closeSpeed : MORPH.openSpeed * 1.5, zeta: 1 }
        const heavy = Math.max(MORPH.weight, 0.1)
        if (goal && !pushed) {
          pushed = true
          if (open.x > 0.02) waited = Math.max(MORPH.openDelay, MORPH.dropDelay)
          else {
            waited = 0
            recoil.v += MORPH.kick / heavy
          }
        }
        if (!goal) pushed = false
        const held = goal === 1 && waited < MORPH.openDelay
        if (goal) waited += dt
        const m1 = held || stepSpring(open, goal, goal ? { omega: MORPH.openSpeed, zeta: MORPH.openDamping } : back, dt)
        const m2 = held || stepSpring(cross, goal, goal ? { omega: MORPH.crossSpeed, zeta: MORPH.crossDamping } : back, dt)
        const m3 = held || stepSpring(calm, goal, goal ? { omega: MORPH.calmSpeed, zeta: 1 } : back, dt)
        const falls = goal === 1 && waited >= MORPH.dropDelay
        const m5 = (goal === 1 && !falls) || stepSpring(drop, falls ? 1 : goal, goal ? { omega: MORPH.dropSpeed, zeta: Math.min(MORPH.dropDamping, 1) } : back, dt)
        let m4 = stepSpring(recoil, 0, goal || rebounding ? { omega: MORPH.swingSpeed / Math.sqrt(heavy), zeta: Math.min(MORPH.swingDamping, 0.999) } : back, dt)
        if (m4 && Math.abs(recoil.x) < 0.006 && Math.abs(recoil.v) < 0.02) {
          recoil.x = recoil.v = 0
          m4 = false
        }
        stepItems(goal, dt, false)
        if (!goal && Math.max(open.x, cross.x, calm.x) < 0.004) {
          if (open.x || cross.x || calm.x) {
            rebound()
            m4 = rebounding
          }
          open.x = open.v = cross.x = cross.v = calm.x = calm.v = drop.x = drop.v = 0
          if (!m4) {
            recoil.x = recoil.v = 0
            rebounding = false
          }
          release()
          dirty()
          return (moving = rebounding)
        }
        moving = m1 || m2 || m3 || m4 || m5
        if (goal && moving && rec.length < 1500) {
          recT += dt
          rec.push({ t: recT, open: open.x, bridge: 0, rc: recoil.x, reveal, snapped: false, cross: cross.x, calm: calm.x, drop: drop.x })
        }
        return moving
      }
      const weight = Math.max(TUNE.weight, 0.1)
      const kick = TUNE.kick / weight
      const m1 = stepSpring(open, goal, goal ? { omega: TUNE.openSpeed, zeta: TUNE.openDamping } : { omega: TUNE.closeSpeed, zeta: 0.7 }, dt)
      const attached = live && (goal ? open.x < TUNE.detachAt : true)
      const m2 = stepSpring(bridge, attached ? 1 : 0, attached || !goal ? ATTACH : snapped ? LET_GO : { omega: TUNE.snapSpeed, zeta: 1 }, dt)
      if (goal && !pushed && open.x > 0.02) {
        pushed = true
        recoil.v += kick * 0.5
      }
      if (!goal) pushed = snapped = false
      if (wasJoined && !joined && goal && !snapped) {
        snapped = true
        recoil.v += kick
      }
      if (!wasJoined && joined && !goal) recoil.v += kick * 0.5
      wasJoined = joined
      let m3 = stepSpring(recoil, 0, { omega: TUNE.recoilSpeed / Math.sqrt(weight), zeta: Math.min(TUNE.recoilDamping, 0.999) }, dt)
      if (m3 && Math.abs(recoil.x) < 0.006 && Math.abs(recoil.v) < 0.02) {
        recoil.x = recoil.v = 0
        m3 = false
      }
      const m4 = stepItems(goal, dt, false)
      if (!goal && open.x < 0.004) release()
      moving = m1 || m2 || m3 || m4
      if (goal && moving && rec.length < 1500) {
        recT += dt
        rec.push({ t: recT, open: open.x, bridge: bridge.x, rc: recoil.x, reveal, snapped, cross: 0, calm: 0, drop: 0 })
      }
      return moving
    }
    const view: GlassView = {
      canvas,
      ctx,
      dirty: true,
      visible: false,
      step: (dt, still) => {
        const morphing = advance(dt, still)
        return stepSwell(dt, still) || morphing
      },
      lens: (refresh) => {
        if (refresh) readColours()
        const s = shape()
        if (!s) return null
        carry(s)
        if (s.onPanel) return null
        const { a } = s
        const thrownUp = morphs ? Math.ceil((Math.abs(MORPH.throw) * MORPH.kick) / (Math.sqrt(Math.max(MORPH.weight, 0.1)) * Math.max(MORPH.swingSpeed, 1))) : 0
        const box = {
          L: Math.floor(a.left - TRIGGER_PAD),
          T: Math.floor(a.top - TRIGGER_PAD - thrownUp),
          W: Math.ceil(a.width + 2 * TRIGGER_PAD) + 1,
          H: Math.ceil(a.height * 1.8 + 2 * TRIGGER_PAD + thrownUp) + 1,
        }
        write(canvas, 'transform-origin', `${a.left + a.width / 2 - box.L}px ${a.top + a.height / 2 - box.T}px`)
        write(canvas, 'scale', s.sc === 1 ? '' : (1 / s.sc).toFixed(6))
        write(
          canvas,
          'clip-path',
          s.c && panelDrawn && !s.parted
            ? `inset(${s.seam.top - box.T}px ${box.L + box.W - s.seam.right}px ${box.T + box.H - s.seam.bottom}px ${s.seam.left - box.L}px)`
            : '',
        )
        return {
          ...lensFor(box, s, page, dirty),
          reflection: {
            height: a.height,
            paint: (around, reach) => {
              drawAround(around, document.body, { left: box.L, top: box.T, width: box.W, height: box.H }, reach, {
                skip: (el) => el === host || el === content || el.hasAttribute('data-glass-skip'),
                onStale: dirty,
              })
            },
          },
          blob: s.parted ? undefined : s.blob,
          left: box.L - a.left - s.edge.hostLeft,
          top: box.T - a.top - s.edge.hostTop,
        }
      },
      drawn: () => {
        if (ready) return
        ready = true
        el.dataset.glassReady = ''
      },
      lost: () => {
        ready = false
        delete el.dataset.glassReady
        el.style.scale = ''
        delete el.dataset.glassMorphing
        if (content) content.dataset.glassOff = ''
        release()
      },
    }
    triggerView = view
    const off = () => el.matches(":disabled, [aria-disabled='true']")
    const onDown = (ev: PointerEvent) => {
      if (off() || ev.button > 0) return
      pressed = true
      light(ev.clientX, ev.clientY)
      dirty()
    }
    const onUp = () => {
      pressed = false
      dirty()
    }
    const onEnter = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' || off()) return
      hovered = true
      dirty()
    }
    const onLeave = () => {
      pressed = hovered = false
      dirty()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    const io = new IntersectionObserver(([entry]) => {
      view.visible = entry.isIntersecting
      dirty()
    })
    io.observe(el)
    const ro = new ResizeObserver(dirty)
    ro.observe(el)
    const onScroll = () => {
      if (triggerView) triggerView.repaint = true
      if (panelView) panelView.repaint = true
      e.wake()
    }
    addEventListener('scroll', onScroll, { passive: true, capture: true })
    e.add(view)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      el.style.scale = ''
      for (const name of ['--glass-sway-y', '--glass-sway-sx', '--glass-sway-sy', '--glass-label', '--glass-label-blur', '--glass-lit']) el.style.removeProperty(name)
      delete el.dataset.glassAnchor
      delete el.dataset.glassMorphing
      setLabel('')
      pressed = hovered = false
      e.remove(view)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      io.disconnect()
      ro.disconnect()
      removeEventListener('scroll', onScroll, { capture: true })
      delete el.dataset.glassReady
      delete el.dataset.glassTone
      triggerView = null
      host = null
    }
  }

  let panelPage: Page | null = null
  const setPanel = (canvas: HTMLCanvasElement | null, hold: HTMLElement | null, cardShadow: HTMLElement | null) => {
    const el = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !el || !ctx) return () => {}
    const e = getGlassEngine()
    if (!e) {
      el.dataset.glassOff = ''
      return () => {}
    }
    engine = e
    content = el
    holdEl = hold
    const page = (panelPage = newPage())
    const view: GlassView = {
      canvas,
      ctx,
      dirty: true,
      visible: el.hasAttribute('data-open'),
      step: () => moving,
      lens: (refresh) => {
        if (refresh) readColours()
        const s = shape()
        if (!s?.c || (s.t < 0.004 && !isOpen())) {
          panelDrawn = false
          return null
        }
        const { a, c } = s
        const L = Math.floor(Math.min(a.left, c.left) - PAD)
        const carried = morphs ? way * MORPH.drop : 0
        const T = Math.floor(Math.min(a.top, c.top) - PAD - Math.max(carried, 0))
        const box = {
          L,
          T,
          W: Math.ceil(Math.max(a.right, c.right) + PAD - L),
          H: Math.ceil(Math.max(a.bottom, c.bottom) + PAD_BOTTOM + Math.max(-carried, 0) - T),
        }
        const x0 = s.seam.left - L
        const y0 = s.seam.top - T
        write(canvas, 'clip-path', s.parted || s.morph ? '' : `path(evenodd,"M0 0H${box.W}V${box.H}H0Z M${x0} ${y0}H${s.seam.right - L}V${s.seam.bottom - T}H${x0}Z")`)
        if (cardShadow && s.blob) {
          const bx = s.body.cx + s.blob.x
          const by = s.body.cy + s.blob.y
          write(
            cardShadow,
            'inset',
            `${(by - s.blob.hy - c.top - s.edge.top).toFixed(1)}px ${(c.right - bx - s.blob.hx - s.edge.left).toFixed(1)}px ${(c.bottom - by - s.blob.hy - s.edge.top).toFixed(1)}px ${(bx - s.blob.hx - c.left - s.edge.left).toFixed(1)}px`,
          )
          write(cardShadow, 'border-radius', `${s.blob.r.toFixed(1)}px`)
          write(cardShadow, 'opacity', s.out.toFixed(3))
        }
        const alone =
          s.parted && s.blob
            ? {
                cx: s.body.cx + s.blob.x - box.L,
                cy: s.body.cy + s.blob.y - box.T,
                hx: s.blob.hx,
                hy: s.blob.hy,
                radius: s.blob.r,
                blob: undefined,
                glow: s.lit && s.lit.blob ? { ...s.lit, x: s.lit.x - s.blob.x, y: s.lit.y - s.blob.y, halo: { around: 'body' as const, amount: s.out * s.lit.spill } } : undefined,
              }
            : {}
        return { ...lensFor(box, s, page, dirty, s.parted ? 1 : s.morph ? s.card : 0), ...alone, left: L - c.left - s.edge.left, top: T - c.top - s.edge.top }
      },
      drawn: () => {
        if (panelDrawn) return
        panelDrawn = true
        if (triggerView) triggerView.dirty = true
      },
      lost: () => {
        el.dataset.glassOff = ''
      },
    }
    panelView = view
    const chosen = (item: Element | null | undefined): item is Element => !!item && !item.matches("[data-disabled], [aria-disabled='true']")
    const onPick = (ev: PointerEvent) => {
      if (ev.button > 0 || !(ev.target instanceof Element) || !chosen(ev.target.closest(PICKS))) return
      light(ev.clientX, ev.clientY, 1, true)
      dirty()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return
      const item = document.activeElement?.closest(PICKS) ?? el.querySelector(`${ITEMS}[data-highlighted]`)
      if (!chosen(item) || !el.contains(item)) return
      const r = item.getBoundingClientRect()
      light(r.left + r.width / 2, r.top + r.height / 2, 1, true)
      dirty()
    }
    el.addEventListener('pointerdown', onPick)
    el.addEventListener('keydown', onKey)
    const own = /--glass-(?:items|out|gap|fade|ride-x|ride-y|zoom|clip|soft)\s*:[^;]*;?\s*/g
    const mo = new MutationObserver((records) => {
      const now = (el.getAttribute('style') ?? '').replace(own, '')
      if (records.every((r) => r.attributeName === 'style')) {
        if (records.some((r) => (r.oldValue ?? '').replace(own, '') !== now)) {
          if (triggerView) triggerView.repaint = true
          view.repaint = true
          e.wake()
        }
        return
      }
      if (isOpen()) view.visible = true
      dirty()
    })
    mo.observe(el, { attributes: true, attributeOldValue: true, attributeFilter: ['data-open', 'data-closed', 'data-ending-style', 'data-side', 'style'] })
    const ro = new ResizeObserver(dirty)
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => {
      view.visible = entry.isIntersecting
      dirty()
    })
    io.observe(el)
    e.add(view)
    dirty()
    return () => {
      e.remove(view)
      el.removeEventListener('pointerdown', onPick)
      el.removeEventListener('keydown', onKey)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      mo.disconnect()
      ro.disconnect()
      io.disconnect()
      delete el.dataset.glassTone
      panelView = null
      panelPage = null
      panelDrawn = false
      content = null
      holdEl = null
      dirty()
    }
  }

  return { setTrigger, setPanel }
}

export type GlassPopup = ReturnType<typeof createMorph>
export type GlassPopupOpening = 'stretch' | 'morph'
export type GlassPopupFrom = 'top' | 'bottom'

export const OVER_CENTER =
  '[position-try-fallbacks:none]! data-[side=bottom]:-translate-y-1/2 data-[side=top]:translate-y-1/2 data-[side=bottom]:[transform:translateY(calc(var(--anchor-height)*-0.5))] data-[side=top]:[transform:translateY(calc(var(--anchor-height)*0.5))]'

export const OVER_EDGE = 'data-[side=bottom]:[transform:translateY(calc(var(--anchor-height)*-1))] data-[side=top]:[transform:translateY(var(--anchor-height))]'

export const GlassPopupContext = createContext<GlassPopup | null>(null)

const canvasStyle: JSX.CSSProperties = {
  position: 'absolute',
  'z-index': -1,
  'max-width': 'none',
  'pointer-events': 'none',
  width: '0px',
  height: '0px',
}

export function GlassPopupSurface(props: { popup: GlassPopup }) {
  let canvasEl: HTMLCanvasElement | undefined
  let holdEl: HTMLSpanElement | undefined
  let shadowEl: HTMLSpanElement | undefined

  createEffect(
    () => props.popup,
    (morph) => {
      const cleanup = morph.setPanel(canvasEl ?? null, holdEl ?? null, shadowEl ?? null)
      onCleanup(cleanup)
    },
  )

  return (
    <>
      <canvas
        ref={(el) => {
          canvasEl = el
        }}
        aria-hidden="true"
        style={canvasStyle}
      />
      <span
        ref={(el) => {
          holdEl = el
        }}
        aria-hidden="true"
        data-glass-hold=""
      />
      <span
        ref={(el) => {
          shadowEl = el
        }}
        aria-hidden="true"
        data-glass-card-shadow=""
      />
    </>
  )
}

export function GlassPopupAnchor(props: { popup: GlassPopup }) {
  let canvasEl: HTMLCanvasElement | undefined

  ensureStyleOnce('popup', CSS)

  createEffect(
    () => props.popup,
    (popup) => {
      const cleanup = popup.setTrigger(canvasEl ?? null)
      onCleanup(cleanup)
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
        style={canvasStyle}
      />
    </>
  )
}

export function GlassPopupText(rawProps: { children: string; delay?: number; class?: string }) {
  const props = merge({ delay: 0 }, rawProps)
  return (
    <span class={props.class}>
      <span class="sr-only">{props.children}</span>
      <span aria-hidden="true" style={{ '--glass-at': `${props.delay}s` } as JSX.CSSProperties}>
        <For each={Array.from(props.children)}>
          {(char, i) => (
            <span data-glass-char="" style={{ '--glass-c': i() } as JSX.CSSProperties}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          )}
        </For>
      </span>
    </span>
  )
}

export function spellLabel(content: JSX.Element): JSX.Element {
  if (typeof content === 'string' && content.trim()) {
    return <GlassPopupText>{content}</GlassPopupText>
  }
  return content
}

export function useGlassPopup(options: { matchWidth?: boolean; opening?: GlassPopupOpening; from?: GlassPopupFrom } = {}): GlassPopup {
  const matchWidth = options.matchWidth ?? false
  const opening = options.opening ?? 'stretch'
  const from = options.from ?? 'top'
  return createMorph(matchWidth, opening === 'morph', from)
}
