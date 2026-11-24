// GlassCard — frosted refractive card of liquid glass.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import type { JSX } from '@solidjs/web'
import { createMemo, merge, omit } from 'solid-js'

import { GlassLayer, type GlassMaterial, type GlassOptics } from './glass-layer'

export type GlassCardProps = {
  children?: JSX.Element
  material?: GlassMaterial
  tint?: number
  blur?: number
  live?: boolean
  optics?: GlassOptics
  class?: string
  style?: JSX.CSSProperties
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'style'>

const CARD_OPTICS: GlassOptics = {
  bendMode: 'radial',
  borderColor: '#ffffff',
  borderAlpha: 0.6,
  borderWidth: 1.3,
  frostMix: 1,
  frostEdge: 1,
  saturation: 1,
  refraction: 1,
  bendDepth: 1.35,
  bendCurve: 9.75,
  dispersion: 0,
  magnify: 0,
  light: 0,
  cursorLight: false,
  shadow: 0,
}

const SHADOW = '0 16.5px 36px rgba(0, 0, 0, 0.08), 0 26.4px 55.9px rgba(0, 0, 0, 0.08)'
const TINT = 0.7
const DARK_BORDER_ALPHA = 0.25
const BLUR = 5

const fallback: Record<GlassMaterial, string> = {
  clear:
    'border border-white/60 bg-white/(--glass-card-tint) text-neutral-900 backdrop-blur-(--glass-card-blur) dark:border-white/25 dark:bg-black/(--glass-card-tint) dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900',
  tinted: '',
}

export function GlassCard(rawProps: GlassCardProps) {
  const props = merge(
    {
      material: 'clear' as GlassMaterial,
      tint: TINT,
      blur: BLUR,
      live: false,
      class: '',
    },
    rawProps,
  )
  const rest = omit(props, 'children', 'material', 'tint', 'blur', 'live', 'optics', 'class', 'style')

  const corners = createMemo(() => (/(^|\s)!?rounded-/.test(props.class) ? '' : 'rounded-[28px]'))
  const lookStyle = createMemo<JSX.CSSProperties>(() => ({
    '--glass-card-tint': `${Math.min(1, Math.max(0, props.tint)) * 100}%`,
    '--glass-card-blur': `${Math.max(0, props.blur)}px`,
    ...props.style,
  }))
  const glass = createMemo<GlassOptics>(() => ({
    ...CARD_OPTICS,
    ...props.optics,
    dark: { borderAlpha: props.optics?.borderAlpha ?? DARK_BORDER_ALPHA, ...props.optics?.dark },
  }))

  return (
    <div data-glass-host="" class={`${corners()} ${fallback[props.material]} ${props.class}`} style={lookStyle()} {...rest}>
      <GlassLayer material={props.material} tint={props.tint} blur={props.blur} live={props.live} swell={false} optics={glass()} />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ 'z-index': -2, 'box-shadow': SHADOW }}
      />
      {props.children}
    </div>
  )
}

export default GlassCard
