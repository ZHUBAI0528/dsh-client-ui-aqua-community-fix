/**
 * Emit `SHA256SUMS.txt` for the built bundle.
 *
 * The GitHub-fallback installer (`install.ps1`) downloads a repo snapshot and
 * runs it inside the client, so it needs a way to tell "the bytes the
 * maintainer built" from "the bytes someone served". A digest published next
 * to the source is the smallest thing that closes that gap: the installer
 * fetches the manifest from the same ref it installs and compares it with the
 * file it just unpacked.
 *
 * The manifest covers `lib/client.js` — the one file the plugin actually
 * executes — rather than the archive, so it stays valid regardless of how the
 * archive was packed or named.
 *
 * Format matches `sha256sum` output (`<hex>  <path>`) so the usual tooling can
 * verify it too:
 *
 *   cd <repo> && sha256sum -c SHA256SUMS.txt
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo root (this script lives in `<root>/scripts`). */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Artifacts the installer verifies, relative to the repo root. */
const ARTIFACTS = ['lib/client.js']

const lines = []
for (const artifact of ARTIFACTS) {
  const absolute = join(root, artifact)
  const digest = createHash('sha256').update(await readFile(absolute)).digest('hex')
  lines.push(`${digest}  ${relative(root, absolute).split('\\').join('/')}`)
}

const target = join(root, 'SHA256SUMS.txt')
// Trailing newline so the file is line-oriented and `sha256sum -c` friendly.
await writeFile(target, `${lines.join('\n')}\n`, 'utf8')
console.log(`[checksums] wrote ${relative(root, target)} (${ARTIFACTS.length} file)`)
