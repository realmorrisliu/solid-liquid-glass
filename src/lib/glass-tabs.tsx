// GlassTabs — segmented control whose selection slides as a liquid glass lens.
// Solid 2.0 + @ui-sdk/solid port of bilalgursen/liquid-glass (MIT).

import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/solid/segmented-control'
import type { JSX } from '@solidjs/web'
import { For, merge, Show } from 'solid-js'

import { GlassLens } from './glass-lens'

export type GlassTabOption<T extends string> = {
  value: T
  label: JSX.Element
  icon?: JSX.Element
  'aria-label'?: string
  disabled?: boolean
}

export type GlassTabsProps<T extends string> = {
  options: readonly GlassTabOption<T>[]
  value: T | null
  onValueChange: (value: T) => void
  'aria-label': string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  highlightClass?: string
  class?: string
}

const sizes = {
  sm: 'h-7 px-3 text-xs gap-1.5 [&_svg]:size-3.5',
  md: 'h-8 px-3.5 text-[13px] gap-1.5 [&_svg]:size-4',
  lg: 'h-10 px-4 text-sm gap-2 [&_svg]:size-4',
}

export function GlassTabs<T extends string>(rawProps: GlassTabsProps<T>) {
  const props = merge(
    {
      size: 'md' as const,
      highlightClass: 'bg-white dark:bg-neutral-700',
      class: '',
    },
    rawProps,
  )

  return (
    <SegmentedControl<T>
      aria-label={props['aria-label']}
      value={props.value}
      onValueChange={(next) => {
        if (next !== null) props.onValueChange(next)
      }}
      name={props.name}
      data-glass-host=""
      class={`relative isolate inline-flex items-center gap-1 rounded-full bg-black/[0.05] p-1 dark:bg-white/[0.08] ${props.class}`}
    >
      <GlassLens value={props.value} />
      <For each={props.options}>
        {(o) => {
          const selected = () => o.value === props.value
          return (
            <SegmentedControlItem
              value={o.value}
              disabled={o.disabled}
              aria-label={o['aria-label']}
              class={() =>
                `relative inline-flex cursor-pointer items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] [&_svg]:shrink-0 ${sizes[props.size]} ${
                  selected()
                    ? 'text-neutral-900 dark:text-white [[data-glass-traveling]_&]:text-neutral-500 dark:[[data-glass-traveling]_&]:text-neutral-400'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`
              }
            >
              <Show when={selected()}>
                <span
                  aria-hidden="true"
                  data-glass-highlight=""
                  class={`absolute inset-0 rounded-full [[data-glass-moving]_&]:opacity-0 ${props.highlightClass}`}
                />
              </Show>
              <Show when={o.icon}>
                <span class="relative z-20 flex">{o.icon}</span>
              </Show>
              <Show when={o.label !== undefined && o.label !== null && o.label !== ''}>
                <span class="relative z-20">{o.label}</span>
              </Show>
            </SegmentedControlItem>
          )
        }}
      </For>
    </SegmentedControl>
  )
}

export default GlassTabs
