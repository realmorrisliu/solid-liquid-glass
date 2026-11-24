import { createSignal } from 'solid-js'
import {
  GlassActionButton,
  GlassBadge,
  GlassButton,
  GlassButtonGroup,
  GlassButtonGroupItem,
  GlassButtonGroupSeparator,
  GlassCard,
  GlassDropdownMenu,
  GlassDropdownMenuContent,
  GlassDropdownMenuItem,
  GlassDropdownMenuSeparator,
  GlassDropdownMenuTrigger,
  GlassPopover,
  GlassPopoverClose,
  GlassPopoverContent,
  GlassPopoverDescription,
  GlassPopoverTitle,
  GlassPopoverTrigger,
  GlassSelect,
  GlassSlideToConfirm,
  GlassStyles,
  GlassTabs,
} from '../lib'

export function App() {
  const [tab, setTab] = createSignal<'paperback' | '32kai' | 'trade'>('paperback')
  const [role, setRole] = createSignal<string | null>('editorial')
  const [lastAction, setLastAction] = createSignal('Ready')

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  return (
    <div class="min-h-screen bg-[#ececee] px-6 py-12 text-[#1d1d1f]">
      <GlassStyles />
      <main class="mx-auto flex max-w-4xl flex-col gap-10">
        <header class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-semibold tracking-tight">solid-liquid-glass</h1>
            <GlassBadge class="bg-[#FC7401] text-white">Solid 2.0</GlassBadge>
          </div>
          <p class="max-w-2xl text-[15px] leading-relaxed text-[#55555b]">
            Solid 2.0 + <code class="rounded bg-black/5 px-1.5 py-0.5 text-[13px]">@ui-sdk/solid</code> port of{' '}
            <code class="rounded bg-black/5 px-1.5 py-0.5 text-[13px]">bilalgursen/liquid-glass</code>, powered by one shared WebGL2 refraction engine.
          </p>
          <p class="text-xs text-[#6e6e73]">Status: {lastAction()}</p>
        </header>

        {/* Backdrop band with bold editorial text & color strip to make WebGL2 refraction clearly visible */}
        <section class="relative overflow-hidden rounded-3xl bg-white p-8 shadow-[0_6px_20px_rgba(0,0,0,0.05)]">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-5xl font-bold tracking-tight text-black/15 select-none"
          >
            It is a truth universally acknowledged · 朝花夕拾 · Knuth-Plass
          </div>
          <div
            aria-hidden="true"
            class="pointer-events-none absolute right-10 top-6 h-28 w-28 rounded-full bg-gradient-to-br from-[#F0B267] to-[#D2693C] opacity-80"
          />

          <div class="relative z-10 flex flex-wrap items-center gap-4">
            <GlassButton onClick={() => setLastAction('Clear GlassButton clicked')}>Clear Glass</GlassButton>
            <GlassButton
              material="tinted"
              class="bg-[#1D1D1F] text-white"
              onClick={() => setLastAction('Tinted GlassButton clicked')}
            >
              Tinted Dark
            </GlassButton>
            <GlassActionButton
              material="tinted"
              class="bg-[#FC7401] text-white"
              pendingLabel="Publishing"
              successLabel="Published"
              resetAfter={2200}
              onAction={async () => {
                await wait(700)
                setLastAction('Action button completed')
              }}
            >
              Publish
            </GlassActionButton>
          </div>
        </section>

        <section class="grid gap-6 md:grid-cols-2">
          <div class="flex flex-col gap-4 rounded-2xl bg-white p-6">
            <h2 class="text-sm font-semibold text-[#6e6e73]">Travel &amp; Share</h2>
            <GlassTabs
              aria-label="Trim preset"
              value={tab()}
              onValueChange={(v) => {
                setTab(v)
                setLastAction(`Selected tab: ${v}`)
              }}
              options={[
                { value: '32kai', label: '32开' },
                { value: 'paperback', label: 'Paperback' },
                { value: 'trade', label: 'US Trade' },
              ]}
            />
            <div>
              <GlassButtonGroup aria-label="Reading tools" material="clear">
                <GlassButtonGroupItem onClick={() => setLastAction('Prev page')}>Prev</GlassButtonGroupItem>
                <GlassButtonGroupSeparator />
                <GlassButtonGroupItem onClick={() => setLastAction('Next page')}>Next</GlassButtonGroupItem>
              </GlassButtonGroup>
            </div>
          </div>

          <div class="flex flex-col gap-4 rounded-2xl bg-white p-6">
            <h2 class="text-sm font-semibold text-[#6e6e73]">Popups &amp; Stretch</h2>
            <div class="flex flex-wrap items-center gap-3">
              <GlassPopover>
                <GlassPopoverTrigger>Unfold Popover</GlassPopoverTrigger>
                <GlassPopoverContent>
                  <GlassPopoverTitle>Reading Trim</GlassPopoverTitle>
                  <GlassPopoverDescription>Adjusts page margins without reflow stutter.</GlassPopoverDescription>
                  <GlassPopoverClose variant="solid" onClick={() => setLastAction('Popover confirmed')}>
                    Apply
                  </GlassPopoverClose>
                </GlassPopoverContent>
              </GlassPopover>

              <GlassDropdownMenu>
                <GlassDropdownMenuTrigger>Actions</GlassDropdownMenuTrigger>
                <GlassDropdownMenuContent>
                  <GlassDropdownMenuItem onSelect={() => setLastAction('Menu: Duplicate')}>Duplicate</GlassDropdownMenuItem>
                  <GlassDropdownMenuItem onSelect={() => setLastAction('Menu: Export')}>Export Markdown</GlassDropdownMenuItem>
                  <GlassDropdownMenuSeparator />
                  <GlassDropdownMenuItem destructive onSelect={() => setLastAction('Menu: Delete')}>
                    Remove
                  </GlassDropdownMenuItem>
                </GlassDropdownMenuContent>
              </GlassDropdownMenu>
            </div>

            <GlassSelect
              label="Material mode"
              placeholder="Choose mode"
              value={role()}
              onValueChange={(v) => {
                setRole(v)
                setLastAction(`Select: ${v}`)
              }}
              options={[
                { value: 'editorial', label: 'Editorial Paper' },
                { value: 'clear', label: 'Clear Refraction' },
                { value: 'frosted', label: 'Frosted Chrome' },
              ]}
            />
          </div>
        </section>

        <section class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#F0B267]/35 via-white to-[#5B8DEF]/25 p-8">
          <div class="grid items-center gap-6 md:grid-cols-2">
            <GlassCard live class="p-6">
              <h3 class="text-base font-semibold">Hold — GlassCard</h3>
              <p class="mt-2 text-sm leading-relaxed text-[#55555b]">
                Radial rim bending with frosted backdrop blur and zero content distortion at center.
              </p>
            </GlassCard>
            <div>
              <GlassSlideToConfirm
                pendingLabel="Syncing"
                successLabel="Synced"
                resetAfter={2500}
                fillClass="bg-[#FC7401] text-white"
                onConfirm={async () => {
                  await wait(600)
                  setLastAction('Slide confirmed')
                }}
              >
                Slide to confirm action
              </GlassSlideToConfirm>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
