// GlassMenu — a menu whose button's own glass grows into the menu (`opening: 'grow'`).
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass v2.0 (MIT).

import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  type MenuCheckboxItemProps,
  type MenuContentProps,
  type MenuItemProps,
  type MenuProps,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  type MenuSubProps,
  type MenuSubTriggerProps,
  type MenuTriggerProps,
} from '@ui-sdk/solid/menu'
import type { JSX } from '@solidjs/web'
import { merge, omit, onSettled, Show, useContext } from 'solid-js'

import { GlassCard } from './glass-card'
import { GlassPopupAnchor, GlassPopupContext, GlassPopupSurface, useGlassPopup } from './glass-popup'

export type GlassMenuProps = MenuProps

export type GlassMenuTriggerProps = Omit<MenuTriggerProps, 'render'> & {
  children?: JSX.Element
  class?: string
  disabled?: boolean
  /** Render the trigger onto a custom element (e.g. a GlassButtonGroupItem inside GlassMenu). */
  render?: (props: Record<string, any>) => JSX.Element
  'aria-label'?: string
  title?: string
}

export type GlassMenuContentProps = {
  children?: JSX.Element
  class?: string
  side?: MenuContentProps['side']
  align?: MenuContentProps['align']
  sideOffset?: number
  alignOffset?: number
}

export type GlassMenuItemProps = Omit<MenuItemProps, 'class'> & {
  children?: JSX.Element
  class?: string
  index?: number
}

export type GlassMenuCheckboxItemProps = Omit<MenuCheckboxItemProps, 'class'> & {
  children?: JSX.Element
  class?: string
  index?: number
}

export type GlassMenuRadioGroupProps<T extends string = string> = Omit<MenuRadioGroupProps<T>, 'class'> & {
  children?: JSX.Element
  class?: string
}

export type GlassMenuRadioItemProps = Omit<MenuRadioItemProps, 'class'> & {
  children?: JSX.Element
  class?: string
  index?: number
}

export type GlassMenuGroupProps = {
  children?: JSX.Element
  class?: string
  style?: JSX.CSSProperties | string
}

export type GlassMenuLabelProps = {
  children?: JSX.Element
  class?: string
}

export type GlassMenuShortcutProps = {
  children?: JSX.Element
  class?: string
}

export type GlassMenuSubTriggerProps = Omit<MenuSubTriggerProps, 'class'> & {
  children?: JSX.Element
  class?: string
  index?: number
}

/** One row of the menu: an action, a checkbox, a radio, or the trigger of a submenu. */
const ROW =
  'relative flex h-10 cursor-pointer items-center gap-2.5 rounded-2xl px-3.5 font-medium whitespace-nowrap outline-none select-none transition-colors duration-100 data-[disabled]:cursor-not-allowed data-[highlighted]:bg-current/10 [&_svg]:size-4 [&_svg]:shrink-0'

/** Surface typography shared by GlassMenuContent and GlassMenuSubContent. */
const SURFACE =
  'min-w-44 rounded-3xl p-1.5 text-[15px] text-neutral-900 outline-none data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900'

export function GlassMenu(rawProps: GlassMenuProps) {
  const popup = useGlassPopup({ opening: 'grow' })
  return (
    <Menu {...rawProps}>
      <GlassPopupContext value={popup}>{rawProps.children}</GlassPopupContext>
    </Menu>
  )
}

export function GlassMenuTrigger(rawProps: GlassMenuTriggerProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class', 'render')
  const popup = useContext(GlassPopupContext)

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
          class={`inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-white/60 px-5 text-[15px] font-medium whitespace-nowrap text-neutral-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900 [&_svg]:size-4 [&_svg]:shrink-0 ${props.class}`}
          {...rest}
        >
          <GlassPopupAnchor popup={p()} />
          <span class="inline-flex items-center gap-[inherit]">{props.children}</span>
        </MenuTrigger>
      )}
    </Show>
  )
}

export function GlassMenuContent(rawProps: GlassMenuContentProps) {
  const props = merge({ class: '', side: 'bottom' as const, align: 'start' as const, sideOffset: 8 }, rawProps)
  const rest = omit(props, 'children', 'class', 'side', 'align', 'sideOffset', 'alignOffset')
  const popup = useContext(GlassPopupContext)
  let listEl: HTMLDivElement | undefined

  onSettled(() => {
    if (!listEl) return
    const items = listEl.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-glass-item]')
    items.forEach((el, i) => {
      if (!el.style.getPropertyValue('--glass-i')) el.style.setProperty('--glass-i', String(i))
    })
  })

  return (
    <MenuContent
      data-glass-popup=""
      data-glass-skip=""
      side={props.side}
      align={props.align}
      sideOffset={props.sideOffset}
      alignOffset={props.alignOffset}
      class={`group/glass ${SURFACE} ${props.class}`}
      {...rest}
    >
      <Show when={popup}>{(p) => <GlassPopupSurface popup={p()} />}</Show>
      <GlassPopupContext value={null}>
        <div
          ref={(el) => {
            listEl = el
          }}
          data-glass-list=""
          class="flex flex-col"
        >
          {props.children}
        </div>
      </GlassPopupContext>
    </MenuContent>
  )
}

export function GlassMenuItem(rawProps: GlassMenuItemProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'class', 'index')
  return (
    <MenuItem
      style={props.index !== undefined ? ({ '--glass-i': props.index } as JSX.CSSProperties) : undefined}
      class={`${ROW} data-[destructive]:text-red-600 group-data-[glass-tone=dark]/glass:data-[destructive]:text-red-400 ${props.class}`}
      {...rest}
    />
  )
}

export function GlassMenuCheckboxItem(rawProps: GlassMenuCheckboxItemProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class', 'index')
  return (
    <MenuCheckboxItem
      data-glass-item=""
      style={props.index !== undefined ? ({ '--glass-i': props.index } as JSX.CSSProperties) : undefined}
      class={`${ROW} ${props.class}`}
      {...rest}
    >
      {props.children}
      <MenuItemIndicator class="ml-auto pl-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </MenuItemIndicator>
    </MenuCheckboxItem>
  )
}

export function GlassMenuRadioGroup<T extends string = string>(rawProps: GlassMenuRadioGroupProps<T>) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class')
  return (
    <MenuRadioGroup class={`flex flex-col ${props.class}`} {...(rest as MenuRadioGroupProps<T>)}>
      {props.children}
    </MenuRadioGroup>
  )
}

export function GlassMenuRadioItem(rawProps: GlassMenuRadioItemProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class', 'index')
  return (
    <MenuRadioItem
      data-glass-item=""
      style={props.index !== undefined ? ({ '--glass-i': props.index } as JSX.CSSProperties) : undefined}
      class={`${ROW} ${props.class}`}
      {...rest}
    >
      {props.children}
      <MenuItemIndicator class="ml-auto pl-4">
        <span aria-hidden="true" class="block size-2 rounded-full bg-current" />
      </MenuItemIndicator>
    </MenuRadioItem>
  )
}

export function GlassMenuGroup(rawProps: GlassMenuGroupProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class')
  return (
    <MenuGroup class={`flex flex-col ${props.class}`} {...rest}>
      {props.children}
    </MenuGroup>
  )
}

export function GlassMenuLabel(rawProps: GlassMenuLabelProps) {
  const props = merge({ class: '' }, rawProps)
  return <MenuGroupLabel class={`px-3.5 pt-2 pb-1 text-xs font-medium opacity-55 select-none ${props.class}`}>{props.children}</MenuGroupLabel>
}

export function GlassMenuShortcut(rawProps: GlassMenuShortcutProps) {
  const props = merge({ class: '' }, rawProps)
  return <MenuShortcut class={`ml-auto pl-6 text-[13px] font-normal tracking-wide opacity-50 ${props.class}`}>{props.children}</MenuShortcut>
}

export function GlassMenuSeparator(rawProps: { class?: string; style?: JSX.CSSProperties }) {
  const props = merge({ class: '' }, rawProps)
  return <MenuSeparator data-glass-item="" style={props.style} class={`mx-3.5 my-1 h-px shrink-0 bg-current/15 ${props.class}`} />
}

export function GlassMenuSub(props: MenuSubProps) {
  return <MenuSub {...props} />
}

export function GlassMenuSubTrigger(rawProps: GlassMenuSubTriggerProps) {
  const props = merge({ class: '' }, rawProps)
  const rest = omit(props, 'children', 'class', 'index')
  return (
    <MenuSubTrigger
      data-glass-item=""
      style={props.index !== undefined ? ({ '--glass-i': props.index } as JSX.CSSProperties) : undefined}
      class={`${ROW} data-[open]:bg-current/10 ${props.class}`}
      {...rest}
    >
      {props.children}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ml-auto opacity-50 rtl:-scale-x-100">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </MenuSubTrigger>
  )
}

export function GlassMenuSubContent(rawProps: GlassMenuContentProps) {
  const props = merge({ class: '', sideOffset: 14, alignOffset: -6 }, rawProps)
  const rest = omit(props, 'children', 'class', 'sideOffset', 'alignOffset')
  const tone = 'data-[glass-tone=dark]:[&_[data-destructive]]:text-red-400'
  return (
    <MenuSubContent
      data-glass-skip=""
      sideOffset={props.sideOffset}
      alignOffset={props.alignOffset}
      render={(subProps) => (
        <GlassCard
          {...subProps}
          class={`${SURFACE} overflow-visible! transition-[opacity,scale] duration-150 ease-out data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0 motion-reduce:scale-100! ${tone} ${props.class}`}
        >
          <div class="flex flex-col">{props.children}</div>
        </GlassCard>
      )}
      {...rest}
    />
  )
}

export default GlassMenu
