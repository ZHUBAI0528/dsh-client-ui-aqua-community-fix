/**
 * SlotMap contribution for the two shell seats this plugin occupies.
 *
 * The shell's own declarations live in the host bundle (`dsh-client-ui-layout`),
 * whose published artifact ships runtime JS only — no `.d.ts`. Without a local
 * declaration the `SlotMap` interface here contains nothing but `root`, so
 * `ctx.slots.register({ name: 'main', ... })` fails to type-check even though
 * the registry accepts the name at runtime.
 *
 * Shapes are taken from the host's own zh/en README (not guessed):
 * - `sidebar.panellist` — root-scoped **list**; entries contribute `id`,
 *   optional `order`, and a `label`. Selected via its own `usePanelInfo`.
 * - `main` — root-scoped **keyed** slot; the same `id` addresses the panel
 *   component, dispatched by `key`.
 *
 * Keep this file script-shaped on the import below: the bare `import type` is
 * what turns `declare module` into an *augmentation* instead of a shadowing
 * re-declaration (which would drop the whole real module surface).
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Sidebar panel entry list: one icon row per registered panel. */
    'sidebar.panellist': { kind: 'list'; scope: 'root' }
    /** Main column: keyed by panel id, renders the panel page for that id. */
    'main': { kind: 'keyed'; scope: 'root' }
  }
}

export {}
