/**
 * Type surface for the File System Access permission methods.
 *
 * `FileSystemFileHandle.queryPermission()` / `requestPermission()` are part of
 * the File System Access spec and shipped in Chromium, but TypeScript's
 * `lib.dom.d.ts` still omits them (only `getFile()` / `createWritable()` are
 * declared). The runtime behaviour is fine — this file closes the type gap so
 * the code reads as-what-it-runs instead of scattering `as any` casts.
 *
 * Scope: permission *queries only*. Anything beyond the two methods belongs in
 * the source, not here.
 */

declare global {
  /** Permission name accepted by the File System Access API. */
  interface FileSystemHandlePermissionDescriptor {
    /** Access mode the caller wants; read is the only mode this plugin uses. */
    mode?: 'read' | 'readwrite'
  }

  interface FileSystemHandle {
    /**
     * Report the current permission state without prompting.
     * @param descriptor - access mode; defaults to read.
     * @returns the current state.
     */
    queryPermission: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>
    /**
     * Ask the user for permission; resolves with the resulting state.
     * @param descriptor - access mode; defaults to read.
     * @returns the resulting state.
     */
    requestPermission: (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>
  }
}

export {}
