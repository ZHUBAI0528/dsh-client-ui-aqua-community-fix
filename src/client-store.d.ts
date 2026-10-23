/**
 * Ambient declaration for the platform seed word `@deepseek-ai/dsh-client-store`.
 *
 * The DSH deployment exposes `@deepseek-ai/dsh-client-store` as a *platform
 * seed word*: the browser module table pre-registers it, so no npm package is
 * published or installed for it. The browser loader resolves that specifier at
 * runtime, but TypeScript has no module to resolve types from.
 *
 * Declaring the module here gives the source a real type surface while the
 * emitted bundle keeps requiring the seed word itself.
 *
 * The runtime shape (verified against the live deployment): `defineStore`
 * returns a *declaration* `{ spec, create }`, and `create()` materializes one
 * instance exposing `{ actions, getSnapshot, subscribe, store, clearPersisted }`.
 * The slot registration's `store` option takes such a declaration, optionally
 * with `create` overridden to hand back a shared instance.
 */

/** Mutable draft of a store's state. */
export type StoreDraft<S> = S

/** Baked action surface: each key mutates the draft in place, taking only its own arguments. */
export type BakedActions<A> = { [K in keyof A]: (...args: TailArgs<A[K]>) => void }

/** Drops the leading draft argument from an action's parameter list. */
type TailArgs<F> = F extends (draft: unknown, ...rest: infer R) => unknown ? R : never[]

/** A materialized store instance. */
export interface EngineStoreInstance<S, A extends Record<string, (...args: never[]) => void>> {
  /** Baked action surface; each key mutates the draft in place. */
  actions: BakedActions<A>
  /** Current snapshot of the store state. */
  getSnapshot: () => S
  /** Subscribe to snapshot changes; returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void
}

/** A store declaration: the spec plus a factory that materializes instances. */
export interface EngineStoreHandle<S, A extends Record<string, (...args: never[]) => void>> {
  /** The store's declaration. */
  spec: unknown
  /** Materialize one instance. */
  create: () => EngineStoreInstance<S, A>
}

/** Declaration accepted by `defineStore`. */
export interface StoreDefinition<S, A extends Record<string, (...args: never[]) => void>> {
  /** Builds the initial state snapshot. */
  init: () => S
  /** Action map; each action mutates the draft in place. */
  actions: A
  /** Optional persistence key. */
  persist?: string
}

/**
 * Declare a store over the platform seed word.
 * @param definition - the store's initial state and action map.
 * @returns the store declaration.
 */
export declare function defineStore<S, A extends Record<string, (...args: never[]) => void>>(
  definition: StoreDefinition<S, A>,
): EngineStoreHandle<S, A>
