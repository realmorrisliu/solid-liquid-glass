// GlassButton — a button made of liquid glass.
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass (MIT).

import { Button, type ButtonActionDetails, type ButtonState } from '@ui-sdk/solid/button'
import type { JSX } from '@solidjs/web'
import { merge, omit, Show } from 'solid-js'

import { GlassLayer, type GlassMaterial, type GlassOptics, type GlassSwell } from './glass-layer'

export type GlassButtonSize = 'sm' | 'md' | 'lg' | 'xl'

export type GlassButtonProps = {
  children?: JSX.Element
  material?: GlassMaterial
  size?: GlassButtonSize
  icon?: JSX.Element
  iconPosition?: 'start' | 'end'
  tint?: number
  /** Hold and drag: the button follows the pointer a little way, stretches along the pull and swings back when let go. Default `true`. */
  pull?: boolean
  /** Hover/press swell behavior: `true` (default), `'subtle'` (Apple-restrained press without wobble), or `false`. */
  swell?: GlassSwell
  /** Adjacent COHESION melting into nearby buttons (`true` by default when `swell={true}`, ignored when `swell="subtle"`). */
  cohesion?: boolean
  /** Clear glass: CSS selector of the ancestor whose content is refracted (default: the page). */
  backdrop?: string
  optics?: GlassOptics
  class?: string
  disabled?: boolean
  focusableWhenDisabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  pendingAnnouncement?: string
  onClick?: (event: Parameters<JSX.EventHandler<HTMLElement, MouseEvent>>[0], details: ButtonActionDetails) => unknown
  /** Render a custom element (for example an `<a>` link) while preserving GlassLayer and UI SDK behaviors. */
  render?: (props: Record<string, any>, state: ButtonState) => JSX.Element
  href?: string
  target?: string
  rel?: string
  'aria-label'?: string
  title?: string
}

const sizes: Record<GlassButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-4 text-[13px] [&_svg]:size-3.5',
  md: 'h-10 gap-2 px-5 text-sm [&_svg]:size-4',
  lg: 'h-12 gap-2 px-6 text-[15px] [&_svg]:size-[18px]',
  xl: 'h-16 gap-2.5 px-8 text-lg [&_svg]:size-5',
}

const fallback: Record<GlassMaterial, string> = {
  clear:
    'border border-black/10 bg-white/60 text-neutral-900 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900',
  tinted: '',
}

export function GlassButton(rawProps: GlassButtonProps) {
  const props = merge(
    {
      material: 'clear' as GlassMaterial,
      size: 'md' as GlassButtonSize,
      iconPosition: 'end' as const,
      pull: true,
      swell: true as GlassSwell,
      cohesion: true,
      class: '',
      type: 'button' as const,
    },
    rawProps,
  )
  const rest = omit(props, 'children', 'material', 'size', 'icon', 'iconPosition', 'tint', 'pull', 'swell', 'cohesion', 'backdrop', 'optics', 'class', 'render', 'href', 'target', 'rel')

  const baseClass = () => {
    const corners = /(^|\s)!?rounded-/.test(props.class) ? '' : 'rounded-full'
    return `inline-flex shrink-0 cursor-pointer items-center justify-center ${corners} font-semibold whitespace-nowrap select-none outline-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:opacity-40 [&_svg]:shrink-0 ${sizes[props.size]} ${fallback[props.material]} ${props.class}`
  }

  const inner = () => (
    <>
      <GlassLayer material={props.material} tint={props.tint} pull={props.pull} swell={props.swell} cohesion={props.cohesion} backdrop={props.backdrop} optics={props.optics} />
      <Show when={props.icon && props.iconPosition === 'start'}>{props.icon}</Show>
      {props.children}
      <Show when={props.icon && props.iconPosition === 'end'}>{props.icon}</Show>
    </>
  )

  return (
    <Button
      data-glass-host=""
      class={baseClass()}
      render={
        props.render
          ? (btnProps, state) => props.render!({ ...btnProps, 'data-glass-host': '', class: baseClass() }, state)
          : props.href
            ? (btnProps) => (
                <a {...btnProps} href={props.href} target={props.target} rel={props.rel}>
                  {inner()}
                </a>
              )
            : undefined
      }
      {...rest}
    >
      {!props.render && !props.href ? inner() : null}
    </Button>
  )
}

export default GlassButton
