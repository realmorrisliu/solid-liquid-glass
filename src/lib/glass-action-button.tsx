// GlassActionButton — async action button whose arrow droplet melts into the body.
// Solid 2.0 port of bilalgursen/liquid-glass (MIT).

import type { JSX } from '@solidjs/web'
import { createEffect, createMemo, createSignal, For, merge, omit, onSettled, Show } from 'solid-js'

import { ensureStyleOnce, GlassLayer, type GlassMaterial } from './glass-layer'

export type GlassActionState = 'idle' | 'pending' | 'success'

export type GlassActionButtonProps = {
  children: JSX.Element
  onAction: () => unknown
  onActionError?: (error: unknown) => void
  pendingLabel?: JSX.Element
  successLabel?: JSX.Element
  resetAfter?: number
  resetKey?: unknown
  icon?: JSX.Element
  material?: GlassMaterial
  size?: 'sm' | 'md' | 'lg'
  tint?: number
  disabled?: boolean
  class?: string
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
  title?: string
}

const sizes = {
  sm: { host: 'h-8 pl-4 text-[13px]', drop: 'size-8 [&_svg]:size-3.5', apart: 52, merged: 38, cap: 32 },
  md: { host: 'h-10 pl-5 text-sm', drop: 'size-10 [&_svg]:size-4', apart: 65, merged: 46, cap: 40 },
  lg: { host: 'h-12 pl-6 text-[15px]', drop: 'size-12 [&_svg]:size-[18px]', apart: 78, merged: 55, cap: 48 },
}

const fallback: Record<GlassMaterial, string> = {
  clear:
    'border border-black/10 bg-white/60 text-neutral-900 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white data-[glass-tone=dark]:text-white data-[glass-tone=light]:text-neutral-900',
  tinted: '',
}

const LETTERS_CSS = `
@keyframes glass-letter{from{opacity:0;filter:blur(10px) brightness(0)}}
[data-glass-letter]{animation:glass-letter .4s ease-out both;animation-delay:calc(var(--glass-c,0) * .01s)}
@media (prefers-reduced-motion:reduce){[data-glass-letter]{animation:none}}
`

const ease = 'duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none'

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2">
    <path d="M4 12h14" />
    <path d="m11 5 7 7-7 7" />
  </svg>
)

const Spinner = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5" data-glass-spin="">
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
)

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" stroke-width="2.5">
    <path data-glass-draw="" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
)

export function GlassActionButton(rawProps: GlassActionButtonProps) {
  const props = merge(
    {
      resetAfter: 0,
      material: 'clear' as GlassMaterial,
      size: 'md' as const,
      disabled: false,
      class: '',
      type: 'button' as const,
    },
    rawProps,
  )
  const rest = omit(
    props,
    'children',
    'onAction',
    'onActionError',
    'pendingLabel',
    'successLabel',
    'resetAfter',
    'resetKey',
    'icon',
    'material',
    'size',
    'tint',
    'disabled',
    'class',
    'type',
  )

  ensureStyleOnce('letters', LETTERS_CSS)

  const [state, setState] = createSignal<GlassActionState>('idle')
  const [touched, setTouched] = createSignal(false)
  const [labelWidth, setLabelWidth] = createSignal<number | undefined>(undefined)

  let sizerEl: HTMLSpanElement | undefined
  let alive = true
  let runId = 0

  const s = createMemo(() => sizes[props.size])
  const label = createMemo(() =>
    state() === 'pending' ? (props.pendingLabel ?? props.children) : state() === 'success' ? (props.successLabel ?? props.children) : props.children,
  )

  onSettled(() => {
    alive = true
    const el = sizerEl
    if (!el) {
      return () => {
        alive = false
      }
    }
    setLabelWidth(el.offsetWidth)
    const ro = new ResizeObserver(() => setLabelWidth(el.offsetWidth))
    ro.observe(el)
    return () => {
      alive = false
      ro.disconnect()
    }
  })

  createEffect(
    () => ({ s: state(), resetAfter: props.resetAfter }),
    ({ s: st, resetAfter }) => {
      if (st !== 'success' || !resetAfter) return
      const id = setTimeout(() => setState('idle'), resetAfter)
      return () => clearTimeout(id)
    },
  )

  createEffect(
    () => props.resetKey,
    () => {
      runId++
      setState('idle')
    },
    { defer: true },
  )

  const run = async () => {
    if (state() !== 'idle' || props.disabled) return
    const id = ++runId
    const current = () => alive && id === runId
    setTouched(true)
    setState('pending')
    try {
      await props.onAction()
      if (current()) setState('success')
    } catch (error) {
      if (current()) setState('idle')
      props.onActionError?.(error)
    }
  }

  return (
    <button
      type={props.type}
      data-glass-host=""
      data-state={state()}
      aria-busy={state() === 'pending' ? 'true' : undefined}
      aria-disabled={state() !== 'idle' ? 'true' : undefined}
      disabled={props.disabled}
      onClick={run}
      style={{ 'padding-right': `${s().merged}px` }}
      class={`inline-flex shrink-0 cursor-pointer items-center rounded-full font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-2 focus-visible:ring-[#3291FF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-default ${s().host} ${fallback[props.material]} ${props.class}`}
      {...rest}
    >
      <GlassLayer material={props.material} tint={props.tint} droplet={state() === 'idle' ? 'apart' : 'merged'} />
      <span
        aria-hidden="true"
        class={`relative inline-flex overflow-hidden transition-[width] ${ease}`}
        style={{ width: labelWidth() !== undefined ? `${labelWidth()}px` : undefined }}
      >
        <span
          ref={(el) => {
            sizerEl = el
          }}
          class="invisible absolute whitespace-nowrap"
        >
          {label()}
        </span>
        <Show
          when={typeof label() === 'string'}
          fallback={
            <span data-glass-in={touched() ? '' : undefined}>{label()}</span>
          }
        >
          <For each={[state()]}>
            {() => (
              <span>
                <For each={Array.from(label() as string)}>
                  {(char, i) => (
                    <span
                      data-glass-letter={touched() ? '' : undefined}
                      style={{ '--glass-c': i() } as JSX.CSSProperties}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  )}
                </For>
              </span>
            )}
          </For>
        </Show>
      </span>
      <span
        aria-hidden="true"
        class={`shrink-0 transition-[width] ${ease}`}
        style={{ width: state() === 'idle' ? `${s().apart - s().merged}px` : '0px' }}
      />
      <Show when={state() === 'idle'}>
        <span
          aria-hidden="true"
          data-glass-fallback=""
          class="pointer-events-none absolute inset-y-2 w-px bg-current opacity-20"
          style={{ right: `${s().cap}px` }}
        />
      </Show>
      <span
        aria-hidden="true"
        data-glass-drop=""
        class={`pointer-events-none absolute top-0 right-0 flex items-center justify-center [&_svg]:shrink-0 ${s().drop}`}
      >
        <For each={[state()]}>
          {(st) => (
            <span class="flex" data-glass-in={touched() ? '' : undefined}>
              {st === 'pending' ? <Spinner /> : st === 'success' ? <Check /> : (props.icon ?? <Arrow />)}
            </span>
          )}
        </For>
      </span>
      <span class="sr-only">{props.children}</span>
      <span role="status" class="sr-only">
        {state() === 'pending' ? (props.pendingLabel ?? '') : state() === 'success' ? (props.successLabel ?? '') : ''}
      </span>
    </button>
  )
}

export default GlassActionButton
