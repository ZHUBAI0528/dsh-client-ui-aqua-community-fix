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
 * The shapes below mirror the host contract in
 * `@deepseek-ai/dsh-client-ui-slots/lib/types/store.d.ts` (`StoreSpec`,
 * `StoreHandle`, `StoreInstance`, `ActionsDecl`, `BakedActions`) member for
 * member. Structural identity matters: the slot registration's `store` option
 * is typed `StoreDecl = StoreHandle<any, any> | StoreFactory`, and a loose
 * local shape (e.g. `spec: unknown`) makes that assignment fail — which then
 * collapses the inject factory's inferred parameters down to zero, producing
 * a second, misleading error far from the real cause.
 *
 * NOTE: the whole surface must live inside `declare module`. A top-level
 * `export function` in this file would only declare a *module of this file*,
 * leaving the seed word itself unresolvable (`TS2307: Cannot find module`).
 */
declare module '@deepseek-ai/dsh-client-store' {
  /** Mutable draft of a store's state. */
  export type StoreDraft<S> = S

  /** Action declaration table: pure draft transforms over the store state. */
  export type ActionsDecl<T> = Record<string, (draft: T, ...params: any[]) => void>

  /** Draft-stripped callback form: what components and inject factories receive. */
  export type BakedActions<T, A extends ActionsDecl<T>> = {
    [K in keyof A]: A[K] extends (draft: T, ...params: infer P) => void ? (...params: P) => void : never
  }

  /** Store declaration spec: fresh-state factory, optional persist key, write set. */
  export interface StoreSpec<T, A extends ActionsDecl<T>> {
    /** Builds the initial state snapshot. */
    init: () => T
    /** Optional persistence key. */
    persist?: string
    /** Action map; each action mutates the draft in place. */
    actions: A
  }

  /** A materialized store instance. */
  export interface EngineStoreInstance<T, A extends ActionsDecl<T>> {
    /**
     * Baked action surface; each key mutates the draft in place.
     *
     * The intersection matters: `register` types its `store` seat as
     * `StoreDecl = StoreHandle<any, any>`, and `BakedActions<any, any>`
     * resolves its index signature to `(...params: unknown[]) => void`.
     * Concrete action signatures fail that contravariance check, so the
     * widened member below satisfies the erased form while the mapped type
     * keeps each named action's real parameters.
     */
    readonly actions: BakedActions<T, A> & Record<string, (...params: any[]) => void>
    /** Current snapshot of the store state. */
    getSnapshot: () => T
    /** Subscribe to snapshot changes; returns an unsubscribe function. */
    subscribe: (fn: () => void) => () => void
    /** Drop this instance's persisted value (no-op for non-persist specs). */
    clearPersisted: () => void
  }

  /** A store declaration: the spec plus the instance factory the framework calls. */
  export interface EngineStoreHandle<T, A extends ActionsDecl<T>> {
    /** The store's declaration. */
    readonly spec: StoreSpec<T, A>
    /** Materialize one instance; the framework owns this call. */
    create: (scopeKey?: string) => EngineStoreInstance<T, A>
  }

  /**
   * Declare a store over the platform seed word.
   * @param spec - the store's initial state and action map.
   * @returns the store declaration.
   */
  export function defineStore<T, A extends ActionsDecl<T>>(spec: StoreSpec<T, A>): EngineStoreHandle<T, A>
}
