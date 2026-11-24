// GlassPopover — floating glass surface that unfolds from its trigger.
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass (MIT).

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  type PopoverContentProps,
  type PopoverProps,
} from '@ui-sdk/solid/popover'
import type { JSX } from '@solidjs/web'
import { merge, omit, Show, useContext } from 'solid-js'

import {
  GlassPopupAnchor,
  GlassPopupContext,
  GlassPopupSurface,
  OVER_CENTER,
  OVER_EDGE,
  spellLabel,
  useGlassPopup,
} from './glass-popup'

export type GlassPopoverProps = PopoverProps & {
  from?: 'top' | 'bottom'
}

export type GlassPopoverTriggerProps = {
  children?: JSX.Element
  class?: string
  disabled?: boolean
  'aria-label'?: string
  title?: string
}

export type GlassPopoverContentProps = {
  children?: JSX.Element
  class?: string
  over?: 'center' | 'edge'
  side?: 'top' | 'bottom'
  align?: PopoverContentProps['align']
  sideOffset?: number
}

export type GlassPopoverCloseProps = {
  children?: JSX.Element
  variant?: 'quiet' | 'solid'
  class?: string
  onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>
}

const OVER = {
  center: OVER_CENTER,
  edge: OVER_EDGE,
}

export function GlassPopover(rawProps: GlassPopoverProps) {
  const props = merge({ from: 'bottom' as const }, rawProps)
  const options = omit(props, 'children', 'from')
  const popup = useGlassPopup({ opening: 'morph', from: props.from })
  return (
    <Popover {...options}>
      <GlassPopupContext value={popup}>{props.children}</GlassPopupContext>
    </Popover>
  )
}

export function GlassPopoverTrigger(rawProps: GlassPopoverTriggerProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class')
  const popup = useContext(GlassPopupContext)
  return (
    <PopoverTrigger
      data-glass-host=""
      class={`inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-white/60 px-5 text-[15px] font-medium whitespace-nowrap text-neutral-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900 [&_svg]:size-4 [&_svg]:shrink-0 ${props.class}`}
      {...rest}
    >
      <Show when={popup}>{(p) => <GlassPopupAnchor popup={p()} />}</Show>
      <span class="inline-flex items-center gap-[inherit]">{spellLabel(props.children)}</span>
    </PopoverTrigger>
  )
}

export function GlassPopoverContent(rawProps: GlassPopoverContentProps) {
  const props = merge(
    {
      class: '',
      over: 'center' as const,
      side: 'bottom' as const,
      align: 'center' as const,
    },
    rawProps,
  )
  const rest = omit(props, 'children', 'class', 'over', 'side', 'align', 'sideOffset')
  const popup = useContext(GlassPopupContext)
  return (
    <PopoverContent
      data-glass-popup=""
      data-glass-skip=""
      side={props.over === 'center' ? 'bottom' : props.side}
      align={props.align}
      sideOffset={props.sideOffset ?? 0}
      class={`group/glass w-72 max-w-[calc(100vw-1rem)] rounded-[26px] p-4 text-[15px] text-neutral-900 outline-none data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900 ${props.sideOffset === undefined ? OVER[props.over] : ''} ${props.class}`}
      {...rest}
    >
      <Show when={popup}>{(p) => <GlassPopupSurface popup={p()} />}</Show>
      <GlassPopupContext value={null}>
        <div data-glass-list="" class="flex flex-col gap-3">
          {props.children}
        </div>
      </GlassPopupContext>
    </PopoverContent>
  )
}

export function GlassPopoverTitle(rawProps: { children?: JSX.Element; class?: string }) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'class')
  return <PopoverTitle class={`px-1 text-base font-semibold tracking-tight ${props.class}`} {...rest} />
}

export function GlassPopoverDescription(rawProps: { children?: JSX.Element; class?: string }) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'class')
  return <PopoverDescription class={`-mt-2 px-1 text-sm leading-relaxed opacity-70 ${props.class}`} {...rest} />
}

export function GlassPopoverClose(rawProps: GlassPopoverCloseProps) {
  const props = merge({ variant: 'quiet' as const, class: '' }, rawProps)
  const rest = omit(props, 'variant', 'class')
  const look = () =>
    props.variant === 'solid'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800 group-data-[glass-tone=dark]/glass:bg-white group-data-[glass-tone=dark]/glass:text-neutral-900 group-data-[glass-tone=dark]/glass:hover:bg-neutral-200'
      : 'bg-current/10 hover:bg-current/15'
  return (
    <PopoverClose
      data-glass-pick=""
      class={`inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap outline-none transition-[background-color,scale] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3291FF] active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0 ${look()} ${props.class}`}
      {...rest}
    />
  )
}

export default GlassPopover
