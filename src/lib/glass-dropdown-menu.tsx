// GlassDropdownMenu — action menu swelling out of its control on a glass neck.
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass (MIT).

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  type MenuContentProps,
  type MenuItemProps,
  type MenuProps,
} from '@ui-sdk/solid/menu'
import type { JSX } from '@solidjs/web'
import { createContext, merge, omit, onSettled, Show, useContext } from 'solid-js'

import {
  GlassPopupAnchor,
  GlassPopupContext,
  GlassPopupSurface,
  OVER_CENTER,
  OVER_EDGE,
  spellLabel,
  useGlassPopup,
} from './glass-popup'

export type GlassDropdownMenuProps = MenuProps & {
  over?: 'center' | 'edge'
  from?: 'top' | 'bottom'
}

const OverContext = createContext<() => 'center' | 'edge' | undefined>(() => undefined)

export type GlassDropdownMenuTriggerProps = {
  children?: JSX.Element
  class?: string
  disabled?: boolean
  render?: (props: Record<string, any>) => JSX.Element
  'aria-label'?: string
  title?: string
}

export type GlassDropdownMenuContentProps = {
  children?: JSX.Element
  class?: string
  sideOffset?: number
  align?: MenuContentProps['align']
}

export type GlassDropdownMenuItemProps = Omit<MenuItemProps, 'class'> & {
  children?: JSX.Element
  class?: string
  index?: number
}

export function GlassDropdownMenu(rawProps: GlassDropdownMenuProps) {
  const props = merge({ from: 'top' as const }, rawProps)
  const options = omit(props, 'children', 'over', 'from')
  const popup = useGlassPopup({ opening: props.over ? 'morph' : 'stretch', from: props.from })
  return (
    <Menu {...options}>
      <OverContext value={() => props.over}>
        <GlassPopupContext value={popup}>{props.children}</GlassPopupContext>
      </OverContext>
    </Menu>
  )
}

export function GlassDropdownMenuTrigger(rawProps: GlassDropdownMenuTriggerProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class', 'render')
  const popup = useContext(GlassPopupContext)
  const over = useContext(OverContext)

  return (
    <Show
      when={!props.render && popup}
      fallback={
        <MenuTrigger
          render={props.render ? (triggerProps) => props.render!({ ...triggerProps, ...rest }) : undefined}
          class={props.class}
          {...(props.render ? {} : rest)}
        >
          {props.render ? undefined : props.children}
        </MenuTrigger>
      }
    >
      {(p) => (
        <MenuTrigger
          data-glass-host=""
          class={`inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-white/60 px-5 text-sm font-semibold whitespace-nowrap text-neutral-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900 [&_svg]:size-4 [&_svg]:shrink-0 ${props.class}`}
          {...rest}
        >
          <GlassPopupAnchor popup={p()} />
          <span class="inline-flex items-center gap-[inherit]">{over() ? spellLabel(props.children) : props.children}</span>
        </MenuTrigger>
      )}
    </Show>
  )
}

export function GlassDropdownMenuContent(rawProps: GlassDropdownMenuContentProps) {
  const props = merge({ class: '', align: 'center' as const }, rawProps)
  const rest = omit(props, 'children', 'class', 'sideOffset', 'align')
  const popup = useContext(GlassPopupContext)
  const over = useContext(OverContext)
  const centered = () => over() === 'center'
  let listEl: HTMLDivElement | undefined

  onSettled(() => {
    if (!listEl) return
    const items = listEl.querySelectorAll<HTMLElement>('[role="menuitem"], [data-glass-item]')
    items.forEach((el, i) => {
      if (!el.style.getPropertyValue('--glass-i')) el.style.setProperty('--glass-i', String(i))
    })
  })

  return (
    <MenuContent
      data-glass-popup=""
      data-glass-skip=""
      sideOffset={props.sideOffset ?? (over() ? 0 : 12)}
      align={props.align}
      side={centered() ? 'bottom' : undefined}
      class={`group/glass min-w-44 rounded-3xl p-1.5 text-[15px] text-neutral-900 outline-none data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900 ${over() && props.sideOffset === undefined ? (centered() ? OVER_CENTER : OVER_EDGE) : ''} ${props.class}`}
      {...rest}
    >
      <Show when={popup}>{(p) => <GlassPopupSurface popup={p()} />}</Show>
      <div
        ref={(el) => {
          listEl = el
        }}
        data-glass-list=""
        class="flex flex-col"
      >
        {props.children}
      </div>
    </MenuContent>
  )
}

export function GlassDropdownMenuItem(rawProps: GlassDropdownMenuItemProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'class', 'index')
  return (
    <MenuItem
      style={props.index !== undefined ? ({ '--glass-i': props.index } as JSX.CSSProperties) : undefined}
      class={`relative flex h-10 cursor-pointer items-center gap-2.5 rounded-2xl px-3.5 font-medium whitespace-nowrap outline-none select-none transition-colors duration-100 data-[disabled]:cursor-not-allowed data-[highlighted]:bg-current/10 data-[destructive]:text-red-600 group-data-[glass-tone=dark]/glass:data-[destructive]:text-red-400 [&_svg]:size-4 [&_svg]:shrink-0 ${props.class}`}
      {...rest}
    />
  )
}

export function GlassDropdownMenuSeparator(rawProps: { class?: string; style?: JSX.CSSProperties }) {
  const props = merge({ class: '' }, rawProps)
  return <MenuSeparator data-glass-item="" style={props.style} class={`mx-3.5 my-1 h-px shrink-0 bg-current/15 ${props.class}`} />
}

export default GlassDropdownMenu
