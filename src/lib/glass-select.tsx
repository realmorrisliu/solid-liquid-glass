// GlassSelect — select whose listbox swells out of its trigger on a stretching glass neck.
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass (MIT).

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectList,
  SelectTrigger,
  SelectValue,
} from '@ui-sdk/solid/select'
import type { JSX } from '@solidjs/web'
import { For, merge } from 'solid-js'

import { GlassPopupAnchor, GlassPopupSurface, useGlassPopup } from './glass-popup'

export type GlassSelectOption = {
  value: string
  label: JSX.Element
  disabled?: boolean
}

export type GlassSelectProps = {
  label: JSX.Element
  options: GlassSelectOption[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  name?: string
  class?: string
}

export function GlassSelect(rawProps: GlassSelectProps) {
  const props = merge({ class: '' }, rawProps)
  const popup = useGlassPopup({ matchWidth: true })

  return (
    <Select
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={(next: unknown) => props.onValueChange?.((next as string | null) ?? null)}
      placeholder={props.placeholder}
      disabled={props.disabled}
      name={props.name}
    >
      <div class={`flex w-64 flex-col gap-2 ${props.class}`}>
        <SelectLabel class="text-sm font-medium text-neutral-900 dark:text-white">{props.label}</SelectLabel>
        <SelectTrigger
          data-glass-host=""
          class="flex h-12 w-full cursor-pointer items-center justify-between rounded-full border border-black/10 bg-white/60 pr-4 pl-5 text-[15px] font-medium text-neutral-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900"
        >
          <GlassPopupAnchor popup={popup} />
          <SelectValue />
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 opacity-60">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </SelectTrigger>
      </div>
      <SelectContent
        data-glass-popup=""
        data-glass-skip=""
        sideOffset={12}
        class="rounded-3xl p-1.5 text-[15px] text-neutral-900 outline-none data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900"
      >
        <GlassPopupSurface popup={popup} />
        <SelectList class="max-h-72 overflow-y-auto rounded-[18px] outline-none">
          <For each={props.options}>
            {(o, i) => (
              <SelectItem
                value={o.value}
                disabled={o.disabled}
                style={{ '--glass-i': i() } as JSX.CSSProperties}
                class="relative flex h-10 cursor-pointer items-center rounded-2xl px-3.5 font-medium outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-black/8 data-[selected]:font-semibold dark:data-[highlighted]:bg-white/12"
              >
                {o.label}
              </SelectItem>
            )}
          </For>
        </SelectList>
      </SelectContent>
    </Select>
  )
}

export default GlassSelect
