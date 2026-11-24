// GlassButtonGroup — related actions sharing one unified body of liquid glass.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import type { JSX } from '@solidjs/web'
import { createContext, createSignal, merge, omit, onSettled, Show, useContext } from 'solid-js'

import { GlassLayer, type GlassMaterial } from './glass-layer'
import { GlassPopupAnchor, GlassPopupContext } from './glass-popup'

export type GlassButtonGroupSize = 'sm' | 'md' | 'lg'
export type GlassButtonGroupOrientation = 'horizontal' | 'vertical'

export type GlassButtonGroupProps = {
  children?: JSX.Element
  orientation?: GlassButtonGroupOrientation
  size?: GlassButtonGroupSize
  material?: GlassMaterial
  tint?: number
  class?: string
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children' | 'class'>

export type GlassButtonGroupItemProps = {
  children?: JSX.Element
  class?: string
  render?: (props: Record<string, any>) => JSX.Element
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'class'>

type Group = { size: () => GlassButtonGroupSize; vertical: () => boolean }
const GroupContext = createContext<Group>({ size: () => 'md', vertical: () => false })

const bodies: Record<GlassButtonGroupSize, { pad: string; stacked: string }> = {
  sm: { pad: 'p-0.5', stacked: 'rounded-[16px]' },
  md: { pad: 'p-1', stacked: 'rounded-[20px]' },
  lg: { pad: 'p-1', stacked: 'rounded-[24px]' },
}

const items: Record<GlassButtonGroupSize, string> = {
  sm: 'h-7 min-w-7 gap-1.5 px-3 text-[13px] [&_svg]:size-3.5',
  md: 'h-8 min-w-8 gap-2 px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-10 min-w-10 gap-2 px-4.5 text-[15px] [&_svg]:size-[18px]',
}

const STACKED = { shadowOffset: 0.35, shadowSoftness: 0.35 }
const WHITE = 'bg-white text-neutral-900'

const fallback: Record<GlassMaterial, string> = {
  clear:
    'border border-black/10 bg-white/60 text-neutral-900 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900',
  tinted: '',
}

export function GlassButtonGroup(rawProps: GlassButtonGroupProps) {
  const props = merge(
    {
      orientation: 'horizontal' as GlassButtonGroupOrientation,
      size: 'md' as GlassButtonGroupSize,
      material: 'tinted' as GlassMaterial,
      class: '',
    },
    rawProps,
  )
  const rest = omit(props, 'children', 'orientation', 'size', 'material', 'tint', 'class')
  const popup = useContext(GlassPopupContext)
  const [isContainer, setIsContainer] = createSignal(false)
  let rootEl: HTMLDivElement | undefined

  onSettled(() => {
    if (!rootEl) return
    const nested = [...rootEl.children].some((el) => el.getAttribute('role') === 'group')
    if (nested) setIsContainer(true)
  })

  const vertical = () => props.orientation === 'vertical'
  const white = () => (props.material === 'tinted' && !/(^|\s)!?bg-/.test(props.class) ? WHITE : '')
  const corners = () =>
    /(^|\s)!?rounded-/.test(props.class) ? '' : vertical() ? bodies[props.size].stacked : 'rounded-full'

  return (
    <div
      ref={(el) => {
        rootEl = el
      }}
      role="group"
      data-glass-host={isContainer() ? undefined : ''}
      data-orientation={props.orientation}
      data-glass-fill={!isContainer() && popup && props.material === 'tinted' ? '' : undefined}
      class={
        isContainer()
          ? `inline-flex shrink-0 gap-2 ${vertical() ? 'flex-col items-stretch' : 'items-center'} ${props.class}`
          : `inline-flex shrink-0 ${vertical() ? 'flex-col items-stretch' : 'items-center'} ${corners()} ${bodies[props.size].pad} font-semibold whitespace-nowrap select-none ${fallback[props.material]} ${white()} ${props.class}`
      }
      {...rest}
    >
      <Show when={!isContainer()}>
        <Show
          when={popup}
          fallback={<GlassLayer material={props.material} tint={props.tint} optics={vertical() ? STACKED : undefined} />}
        >
          {(p) => <GlassPopupAnchor popup={p()} />}
        </Show>
      </Show>
      <GroupContext value={{ size: () => props.size, vertical }}>{props.children}</GroupContext>
    </div>
  )
}

export function GlassButtonGroupItem(rawProps: GlassButtonGroupItemProps) {
  const props = merge({ class: '', type: 'button' as const }, rawProps)
  const rest = omit(props, 'children', 'class', 'render', 'type')
  const group = useContext(GroupContext)
  const classes = () =>
    `inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full ${items[group.size()]} outline-none focus-visible:ring-2 focus-visible:ring-[#3291FF] disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:shrink-0 ${props.class}`

  return (
    <Show
      when={props.render}
      fallback={
        <button type={props.type} class={classes()} {...rest}>
          {props.children}
        </button>
      }
    >
      {(renderFn) => renderFn()({ ...rest, class: classes(), children: props.children })}
    </Show>
  )
}

export function GlassButtonGroupSeparator(rawProps: { class?: string }) {
  const props = merge({ class: '' }, rawProps)
  const group = useContext(GroupContext)
  return (
    <span
      role="separator"
      aria-orientation={group.vertical() ? 'horizontal' : 'vertical'}
      class={`shrink-0 bg-current opacity-20 ${group.vertical() ? 'mx-2.5 my-0.5 h-px' : 'mx-0.5 h-1/2 w-px'} ${props.class}`}
    />
  )
}

export function GlassButtonGroupText(
  rawProps: { children?: JSX.Element; class?: string } & Omit<JSX.HTMLAttributes<HTMLSpanElement>, 'children' | 'class'>,
) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class')
  const group = useContext(GroupContext)
  return (
    <span class={`inline-flex shrink-0 items-center justify-center ${items[group.size()]} font-medium opacity-70 ${props.class}`} {...rest}>
      {props.children}
    </span>
  )
}

export default GlassButtonGroup
